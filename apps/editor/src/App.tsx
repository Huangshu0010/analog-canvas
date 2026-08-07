import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";

import { DocumentHistory } from "@icm/edit-engine";
import type { EditTransactionResult, SchematicEdit } from "@icm/edit-engine";
import { createFormalExportSource, safeExportBaseName } from "@icm/exporters";
import {
  deriveCrossings,
  deriveFlightlines,
  deriveInternalGroupSelection,
  diagnoseVisualQuality,
  endpointKey,
  proposeGroupMove,
  routePolyline,
} from "@icm/derived";
import {
  CircuitProjectSchema,
  createEmptyProject,
  parseProject,
  serializeProject,
  transformPoint,
} from "@icm/model";
import type {
  Annotation,
  CircuitProject,
  Point,
  Rect,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import { buildSvgScene, renderSymbolDefinitionBody } from "@icm/render-svg";
import { importSpiceSources } from "@icm/spice";
import type { SpiceDiagnostic } from "@icm/spice";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

import { copySelection, proposePaste } from "./clipboard";
import type { SchematicClipboard } from "./clipboard";
import { createRoutingDemoProject } from "./routing-demo";
import { createVisualDemoProject } from "./visual-demo";

const RECOVERY_KEY = "icm.recovery.v1";
const DEFAULT_VIEWBOX: Rect = { x: 0, y: 0, width: 960, height: 640 };

interface DragPreview {
  instanceIds: string[];
  originalPositions: Record<string, Point>;
  pointerStart: Point;
  position: Point;
  pointerId: number;
}

interface BoxPreview {
  start: Point;
  end: Point;
  pointerId: number;
}

interface PanPreview {
  clientStart: Point;
  viewBoxStart: Rect;
  pointerId: number;
}

interface RouteStretchPreview {
  routeId: string;
  point: Point;
  pointerId: number;
}

interface AnnotationDragPreview {
  annotationId: string;
  originalPosition: Point;
  pointerStart: Point;
  position: Point;
  pointerId: number;
}

type EditorTool = "pointer" | "wire";

interface WireSource {
  endpoint: RouteEndpoint;
  netId: string | null;
  point: Point;
  preludeEdits: SchematicEdit[];
}

export interface AppProps {
  project?: CircuitProject;
}

function replaceDocument(
  project: CircuitProject,
  document: SchematicDocument,
): CircuitProject {
  return CircuitProjectSchema.parse({
    ...project,
    documents: project.documents.map((candidate) =>
      candidate.id === document.id ? document : candidate,
    ),
  });
}

function snap(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

function endpointTestId(endpoint: RouteEndpoint): string {
  switch (endpoint.kind) {
    case "terminal":
      return `terminal-${endpoint.instanceId}-${endpoint.pinName}`;
    case "port":
      return `port-${endpoint.portId}`;
    case "junction":
      return `junction-${endpoint.junctionId}`;
  }
}

function polylinePoints(points: readonly Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function segmentAtPoint(points: readonly Point[], point: Point): number | null {
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const onVertical =
      from.x === to.x &&
      point.x === from.x &&
      point.y > Math.min(from.y, to.y) &&
      point.y < Math.max(from.y, to.y);
    const onHorizontal =
      from.y === to.y &&
      point.y === from.y &&
      point.x > Math.min(from.x, to.x) &&
      point.x < Math.max(from.x, to.x);
    if (onVertical || onHorizontal) return index;
  }
  return null;
}

function endpointNetId(
  document: SchematicDocument,
  endpoint: RouteEndpoint,
): string | null {
  if (endpoint.kind === "junction") {
    return (
      document.junctions.find((junction) => junction.id === endpoint.junctionId)
        ?.netId ?? null
    );
  }
  return (
    document.nets.find((net) =>
      endpoint.kind === "terminal"
        ? net.terminals.some(
            (terminal) =>
              terminal.instanceId === endpoint.instanceId &&
              terminal.pinName === endpoint.pinName,
          )
        : net.ports.includes(endpoint.portId),
    )?.id ?? null
  );
}

function normalizedRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(1, Math.abs(end.x - start.x)),
    height: Math.max(1, Math.abs(end.y - start.y)),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function closestPointOnSegment(point: Point, from: Point, to: Point): Point {
  if (from.x === to.x) {
    return {
      x: from.x,
      y: clamp(point.y, Math.min(from.y, to.y), Math.max(from.y, to.y)),
    };
  }
  return {
    x: clamp(point.x, Math.min(from.x, to.x), Math.max(from.x, to.x)),
    y: from.y,
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest("input, textarea, select, [contenteditable='true']"),
  );
}

function symbolCategory(symbolId: string): string {
  if (["nmos", "pmos", "nmos3", "pmos3", "npn", "pnp"].includes(symbolId)) {
    return "Transistors";
  }
  if (
    ["resistor", "capacitor", "inductor", "crystal", "transformer"].includes(
      symbolId,
    )
  ) {
    return "Passives";
  }
  if (
    [
      "voltage-source",
      "current-source",
      "ac-voltage-source",
      "pulse-voltage-source",
    ].includes(symbolId)
  ) {
    return "Sources";
  }
  if (["diode", "zener", "schottky", "led"].includes(symbolId)) {
    return "Diodes";
  }
  if (["opamp", "switch-open", "switch-closed"].includes(symbolId)) {
    return "Functional";
  }
  return "Power and Ports";
}

function SymbolThumbnail({ symbol }: { symbol: SymbolDefinition }) {
  const { x, y, width, height } = symbol.viewBox;
  const padding = Math.max(width, height) * 0.12;
  return (
    <svg
      className="palette-symbol-preview"
      viewBox={`${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`}
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="#000"
        strokeWidth="1"
        strokeLinecap="square"
        strokeLinejoin="miter"
        dangerouslySetInnerHTML={{
          __html: renderSymbolDefinitionBody(symbol),
        }}
      />
    </svg>
  );
}

export function App({ project: initialProject }: AppProps) {
  const resolver = useMemo(
    () => new InMemorySymbolResolver(builtInSymbols),
    [],
  );
  const [project, setProject] = useState(() =>
    CircuitProjectSchema.parse(
      structuredClone(
        initialProject ?? createEmptyProject("project-main", "New Circuit"),
      ),
    ),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewBox, setViewBox] = useState<Rect>(DEFAULT_VIEWBOX);
  const [status, setStatus] = useState("Ready");
  const [recoveryCandidate, setRecoveryCandidate] =
    useState<CircuitProject | null>(null);
  const [importDiagnostics, setImportDiagnostics] = useState<SpiceDiagnostic[]>(
    [],
  );
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [boxPreview, setBoxPreview] = useState<BoxPreview | null>(null);
  const [panPreview, setPanPreview] = useState<PanPreview | null>(null);
  const [routeStretchPreview, setRouteStretchPreview] =
    useState<RouteStretchPreview | null>(null);
  const [annotationDragPreview, setAnnotationDragPreview] =
    useState<AnnotationDragPreview | null>(null);
  const [tool, setTool] = useState<EditorTool>("pointer");
  const [wireSource, setWireSource] = useState<WireSource | null>(null);
  const [wirePreviewPoint, setWirePreviewPoint] = useState<Point | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WireSource | null>(
    null,
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);
  const [instanceLabelDraft, setInstanceLabelDraft] = useState("");
  const [netLabelDraft, setNetLabelDraft] = useState("");
  const [annotationTextDraft, setAnnotationTextDraft] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [pendingSymbolId, setPendingSymbolId] = useState<string | null>(null);
  const transactionCounter = useRef(0);
  const routeCounter = useRef(0);
  const instanceCounter = useRef(0);
  const clipboard = useRef<SchematicClipboard | null>(null);
  const pasteCounter = useRef(0);
  const suppressInstanceClick = useRef(false);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const history = useRef(
    new DocumentHistory(project.documents[0]!, { symbolResolver: resolver }),
  );
  const document = project.documents.find(
    (candidate) => candidate.id === project.topDocumentId,
  )!;
  const scene = buildSvgScene(document, resolver, { bounds: viewBox });
  const unplaced = document.instances.filter(
    (instance) => instance.placement === null,
  );
  const selectedId = selectedIds.at(-1) ?? null;
  const selectedInstance =
    selectedIds.length === 1
      ? document.instances.find((instance) => instance.id === selectedId)
      : undefined;
  const selectedRoute = selectedRouteId
    ? document.routes.find((route) => route.id === selectedRouteId)
    : undefined;
  const selectedAnnotation = selectedAnnotationId
    ? document.annotations.find(
        (annotation) => annotation.id === selectedAnnotationId,
      )
    : undefined;
  const flightlines = deriveFlightlines(document, resolver);
  const crossings = deriveCrossings(document, resolver);
  const visualDiagnostics = diagnoseVisualQuality(document, resolver);
  const visibleEndpoints: WireSource[] = [
    ...document.instances.flatMap((instance) => {
      if (!instance.placement) return [];
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) return [];
      const hidden = new Set(resolved.variant?.hiddenPinNames ?? []);
      return resolved.definition.pins
        .filter((pin) => !hidden.has(pin.name))
        .map((pin): WireSource => {
          const endpoint: RouteEndpoint = {
            kind: "terminal",
            instanceId: instance.id,
            pinName: pin.name,
          };
          return {
            endpoint,
            netId: endpointNetId(document, endpoint),
            point: transformPoint(
              pin.at,
              instance.placement!.position,
              instance.placement!,
            ),
            preludeEdits: [],
          };
        });
    }),
    ...document.ports.flatMap((port): WireSource[] =>
      port.position
        ? [
            {
              endpoint: { kind: "port", portId: port.id },
              netId: endpointNetId(document, {
                kind: "port",
                portId: port.id,
              }),
              point: port.position,
              preludeEdits: [],
            },
          ]
        : [],
    ),
    ...document.junctions.map((junction): WireSource => ({
      endpoint: { kind: "junction", junctionId: junction.id },
      netId: junction.netId,
      point: junction.position,
      preludeEdits: [],
    })),
  ];
  const routePolylines = document.routes
    .map((route) => ({
      route,
      polyline: routePolyline(document, resolver, route),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        route: SchematicDocument["routes"][number];
        polyline: NonNullable<ReturnType<typeof routePolyline>>;
      } => candidate.polyline !== null,
    );
  const internalSelection = deriveInternalGroupSelection(document, selectedIds);
  const selectedInternalRouteIds = new Set(internalSelection.routeIds);
  const wireDraftPoints =
    wireSource && wirePreviewPoint
      ? wireSource.point.x === wirePreviewPoint.x ||
        wireSource.point.y === wirePreviewPoint.y
        ? [wireSource.point, wirePreviewPoint]
        : [
            wireSource.point,
            { x: wirePreviewPoint.x, y: wireSource.point.y },
            wirePreviewPoint,
          ]
      : [];
  const projectInstanceCount = project.documents.reduce(
    (count, candidate) => count + candidate.instances.length,
    0,
  );
  const componentSymbols = builtInSymbols.filter(
    (symbol) =>
      symbol.id !== "generic-block" &&
      `${symbol.name} ${symbol.id} ${symbol.aliases.join(" ")}`
        .toLowerCase()
        .includes(paletteQuery.trim().toLowerCase()),
  );
  const componentGroups = [
    ...new Set(componentSymbols.map((symbol) => symbolCategory(symbol.id))),
  ].map((category) => ({
    category,
    symbols: componentSymbols.filter(
      (symbol) => symbolCategory(symbol.id) === category,
    ),
  }));
  const contentScene = buildSvgScene(document, resolver);

  useEffect(() => {
    if (!selectedInstance) {
      setInstanceLabelDraft("");
      return;
    }
    const label = document.annotations.find(
      (annotation) =>
        annotation.kind === "instance-label" &&
        annotation.attachedObjectId === selectedInstance.id,
    );
    setInstanceLabelDraft(label?.text ?? selectedInstance.id);
  }, [document.annotations, selectedInstance]);

  useEffect(() => {
    if (!selectedRoute) {
      setNetLabelDraft("");
      return;
    }
    const net = document.nets.find(
      (candidate) => candidate.id === selectedRoute.netId,
    );
    setNetLabelDraft(net?.name ?? "");
  }, [document.nets, selectedRoute]);

  useEffect(() => {
    setAnnotationTextDraft(selectedAnnotation?.text ?? "");
  }, [selectedAnnotation]);

  useEffect(() => {
    const serialized = localStorage.getItem(RECOVERY_KEY);
    if (!serialized) return;
    try {
      setRecoveryCandidate(parseProject(serialized));
      setStatus("Unsaved recovery is available");
    } catch (error) {
      localStorage.removeItem(RECOVERY_KEY);
      setStatus(
        `Discarded corrupt recovery: ${error instanceof Error ? error.message : "invalid data"}`,
      );
    }
  }, []);

  function stageRecovery(nextProject: CircuitProject): void {
    localStorage.setItem(RECOVERY_KEY, serializeProject(nextProject));
  }

  function applyResult(result: EditTransactionResult): void {
    if (!result.ok) {
      setStatus(`${result.error.code}: ${result.error.message}`);
      return;
    }
    if (result.applied) {
      setProject((current) => {
        const next = replaceDocument(current, result.document);
        stageRecovery(next);
        return next;
      });
    }
    setStatus(
      result.applied
        ? `Committed revision ${result.revision}`
        : `Dry run for revision ${result.proposedRevision}`,
    );
  }

  function transact(edits: SchematicEdit[]): EditTransactionResult {
    transactionCounter.current += 1;
    const result = history.current.transact({
      transactionId: `transaction-ui-${transactionCounter.current}`,
      documentId: document.id,
      expectedRevision: history.current.document.revision,
      actor: { kind: "human", id: "human-local" },
      edits,
    });
    applyResult(result);
    return result;
  }

  function activateTool(nextTool: EditorTool): void {
    setTool(nextTool);
    setWireSource(null);
    setWirePreviewPoint(null);
    if (nextTool !== "pointer") setSelectedRouteId(null);
    setStatus(
      nextTool === "wire"
        ? "Wire: choose a pin, junction, or route segment"
        : "Pointer ready",
    );
  }

  function loadRoutingDemo(): void {
    const demo = createRoutingDemoProject();
    const demoDocument = demo.documents[0]!;
    history.current.reset(demoDocument);
    setProject(demo);
    setSelectedIds([]);
    setSelectedRouteId(null);
    setDragPreview(null);
    setWireSource(null);
    setWirePreviewPoint(null);
    setTool("pointer");
    setViewBox(DEFAULT_VIEWBOX);
    setStatus("Loaded Phase 3 routing demo");
  }

  function handleWireEndpoint(
    event: ReactPointerEvent<SVGCircleElement>,
    candidate: WireSource,
  ): void {
    event.stopPropagation();
    if (event.altKey) {
      setStatus("Snap suppressed while Alt is held");
      return;
    }
    setTool("wire");
    if (!wireSource) {
      setWireSource(candidate);
      setWirePreviewPoint(candidate.point);
      setStatus(`Wire source: ${endpointTestId(candidate.endpoint)}`);
      return;
    }
    if (endpointKey(wireSource.endpoint) === endpointKey(candidate.endpoint)) {
      setStatus("Choose a different endpoint");
      return;
    }
    commitWire(candidate);
  }

  function commitWire(candidate: WireSource): void {
    if (!wireSource) return;
    routeCounter.current += 1;
    const suffix = routeCounter.current;
    const edits: SchematicEdit[] = [
      ...wireSource.preludeEdits,
      ...candidate.preludeEdits,
    ];
    let netId = wireSource.netId ?? candidate.netId;
    if (
      wireSource.netId &&
      candidate.netId &&
      wireSource.netId !== candidate.netId
    ) {
      netId = wireSource.netId;
      edits.push({
        kind: "merge_nets",
        targetNetId: wireSource.netId,
        sourceNetId: candidate.netId,
      });
    }
    if (!netId) netId = `net-ui-${suffix}`;
    edits.push({
      kind: "connect_endpoints",
      from: wireSource.endpoint,
      to: candidate.endpoint,
      ...(!wireSource.netId && !candidate.netId ? { newNetId: netId } : {}),
    });
    const diagonal =
      wireSource.point.x !== candidate.point.x &&
      wireSource.point.y !== candidate.point.y;
    const waypoints = diagonal
      ? [{ x: candidate.point.x, y: wireSource.point.y }]
      : [];
    edits.push({
      kind: "set_route_points",
      routeId: `route-ui-${suffix}`,
      netId,
      from: wireSource.endpoint,
      to: candidate.endpoint,
      waypoints,
      segmentModes: Array.from(
        { length: waypoints.length + 1 },
        () => "manual" as const,
      ),
    });
    const result = transact(edits);
    if (result.ok) {
      setWireSource(null);
      setWirePreviewPoint(null);
      setTool("pointer");
      setStatus(`Committed route at revision ${result.revision}`);
    }
  }

  function routeAnchor(
    routeId: string,
    point: Point,
    segmentIndex: number,
  ): WireSource {
    const route = document.routes.find(
      (candidate) => candidate.id === routeId,
    )!;
    routeCounter.current += 1;
    const suffix = routeCounter.current;
    const junctionId = `junction-ui-${suffix}`;
    return {
      endpoint: { kind: "junction", junctionId },
      netId: route.netId,
      point,
      preludeEdits: [
        {
          kind: "add_junction",
          junctionId,
          netId: route.netId,
          position: point,
          split: {
            routeId,
            firstRouteId: `${routeId}-a-${suffix}`,
            secondRouteId: `${routeId}-b-${suffix}`,
            segmentIndex,
          },
        },
      ],
    };
  }

  function handleRoutePointerDown(
    event: ReactPointerEvent<SVGPolylineElement>,
    routeId: string,
  ): void {
    event.stopPropagation();
    if (event.altKey) {
      setStatus("Snap suppressed while Alt is held");
      return;
    }
    const routeRecord = routePolylines.find(
      (candidate) => candidate.route.id === routeId,
    );
    if (!routeRecord) return;
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    const segmentIndex = segmentAtPoint(routeRecord.polyline.points, point);
    if (tool === "pointer") {
      setSelectedRouteId(routeId);
      setSelectedIds([]);
      setSelectedAnnotationId(null);
      setStatus(`Selected route ${routeId}`);
      return;
    }
    if (segmentIndex === null) {
      setStatus("Wire must start or end inside a route segment");
      return;
    }
    const overlappingTargets = routePolylines.filter(
      (candidate) => segmentAtPoint(candidate.polyline.points, point) !== null,
    );
    if (overlappingTargets.length > 1) {
      setStatus(
        "Ambiguous intersection: choose one conductor away from the crossing",
      );
      return;
    }
    const anchor = routeAnchor(routeId, point, segmentIndex);
    if (!wireSource) {
      setWireSource(anchor);
      setWirePreviewPoint(point);
      setStatus(`Wire source: route ${routeId}`);
    } else {
      commitWire(anchor);
    }
  }

  function removeSelectedRouteGeometry(): void {
    if (!selectedRouteId) return;
    const result = transact([
      { kind: "make_flightline", routeId: selectedRouteId },
    ]);
    if (result.ok) {
      setSelectedRouteId(null);
      setStatus(`Removed route geometry at revision ${result.revision}`);
    }
  }

  function beginRouteStretch(
    event: ReactPointerEvent<SVGCircleElement>,
    routeId: string,
  ): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setRouteStretchPreview({
      routeId,
      pointerId: event.pointerId,
      point: pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget.ownerSVGElement!,
      ),
    });
  }

  function previewRouteStretch(
    event: ReactPointerEvent<SVGCircleElement>,
  ): void {
    if (routeStretchPreview?.pointerId !== event.pointerId) return;
    setRouteStretchPreview({
      ...routeStretchPreview,
      point: pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget.ownerSVGElement!,
      ),
    });
  }

  function finishRouteStretch(
    event: ReactPointerEvent<SVGCircleElement>,
  ): void {
    if (routeStretchPreview?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const record = routePolylines.find(
      (candidate) => candidate.route.id === routeStretchPreview.routeId,
    );
    if (!record || record.polyline.points.length !== 2) {
      setRouteStretchPreview(null);
      return;
    }
    const [from, to] = record.polyline.points as [Point, Point];
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    const waypoints =
      from.y === to.y
        ? [
            { x: from.x, y: point.y },
            { x: to.x, y: point.y },
          ]
        : [
            { x: point.x, y: from.y },
            { x: point.x, y: to.y },
          ];
    const result = transact([
      {
        kind: "set_route_points",
        routeId: record.route.id,
        netId: record.route.netId,
        from: record.route.from,
        to: record.route.to,
        waypoints,
        segmentModes: ["manual", "manual", "manual"],
      },
    ]);
    if (result.ok) setStatus(`Adjusted route ${record.route.id}`);
    setRouteStretchPreview(null);
  }

  function constrainAnnotationPosition(
    annotation: Annotation,
    candidate: Point,
  ): Point {
    if (annotation.kind === "instance-label" && annotation.attachedObjectId) {
      const instance = document.instances.find(
        (item) => item.id === annotation.attachedObjectId,
      );
      if (instance?.placement) {
        const resolved = resolver.resolve(
          instance.symbolId,
          instance.symbolVariantId,
        );
        const radius = Math.ceil(
          Math.max(
            resolved?.definition.viewBox.width ?? 60,
            resolved?.definition.viewBox.height ?? 60,
          ) /
            2 +
            30,
        );
        return {
          x: Math.round(
            clamp(
              candidate.x,
              instance.placement.position.x - radius,
              instance.placement.position.x + radius,
            ),
          ),
          y: Math.round(
            clamp(
              candidate.y,
              instance.placement.position.y - radius,
              instance.placement.position.y + radius,
            ),
          ),
        };
      }
    }
    if (annotation.kind === "net-label" && annotation.attachedObjectId) {
      const candidates = routePolylines
        .filter(({ route }) => route.netId === annotation.attachedObjectId)
        .flatMap(({ polyline }) =>
          polyline.points
            .slice(0, -1)
            .map((from, index) =>
              closestPointOnSegment(
                candidate,
                from,
                polyline.points[index + 1]!,
              ),
            ),
        );
      const closest = candidates.sort((left, right) => {
        const leftDistance =
          (left.x - candidate.x) ** 2 + (left.y - candidate.y) ** 2;
        const rightDistance =
          (right.x - candidate.x) ** 2 + (right.y - candidate.y) ** 2;
        return leftDistance - rightDistance;
      })[0];
      if (closest) {
        return {
          x: Math.round(clamp(candidate.x, closest.x - 30, closest.x + 30)),
          y: Math.round(clamp(candidate.y, closest.y - 30, closest.y + 30)),
        };
      }
    }
    return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
  }

  function beginAnnotationDrag(
    event: ReactPointerEvent<SVGCircleElement>,
    annotation: Annotation,
  ): void {
    if (event.button !== 0 || annotation.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointerStart = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    setSelectedAnnotationId(annotation.id);
    setSelectedIds([]);
    setSelectedRouteId(null);
    setSelectedEndpoint(null);
    setAnnotationDragPreview({
      annotationId: annotation.id,
      originalPosition: { ...annotation.position },
      pointerStart,
      position: { ...annotation.position },
      pointerId: event.pointerId,
    });
  }

  function previewAnnotationDrag(
    event: ReactPointerEvent<SVGCircleElement>,
  ): void {
    if (annotationDragPreview?.pointerId !== event.pointerId) return;
    const pointer = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    const annotation = document.annotations.find(
      (candidate) => candidate.id === annotationDragPreview.annotationId,
    );
    if (!annotation) return;
    setAnnotationDragPreview({
      ...annotationDragPreview,
      position: constrainAnnotationPosition(annotation, {
        x:
          annotationDragPreview.originalPosition.x +
          pointer.x -
          annotationDragPreview.pointerStart.x,
        y:
          annotationDragPreview.originalPosition.y +
          pointer.y -
          annotationDragPreview.pointerStart.y,
      }),
    });
  }

  function finishAnnotationDrag(
    event: ReactPointerEvent<SVGCircleElement>,
  ): void {
    if (annotationDragPreview?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const annotation = document.annotations.find(
      (candidate) => candidate.id === annotationDragPreview.annotationId,
    );
    if (annotation) {
      let offset = { ...annotation.offset };
      if (annotation.attachedObjectId) {
        const instance = document.instances.find(
          (candidate) => candidate.id === annotation.attachedObjectId,
        );
        if (instance?.placement) {
          offset = {
            x: annotationDragPreview.position.x - instance.placement.position.x,
            y: annotationDragPreview.position.y - instance.placement.position.y,
          };
        }
      }
      transact([
        {
          kind: "upsert_annotation",
          annotation: {
            ...annotation,
            position: annotationDragPreview.position,
            offset,
          },
        },
      ]);
    }
    setAnnotationDragPreview(null);
  }

  function pointFromClient(
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
  ): Point {
    const grid = document.presentation.grid;
    const matrix = svg.getScreenCTM();
    if (matrix) {
      const clientPoint = svg.createSVGPoint();
      clientPoint.x = clientX;
      clientPoint.y = clientY;
      const localPoint = clientPoint.matrixTransform(matrix.inverse());
      return {
        x: snap(localPoint.x, grid),
        y: snap(localPoint.y, grid),
      };
    }
    const bounds = svg.getBoundingClientRect();
    return {
      x: snap(
        viewBox.x + ((clientX - bounds.left) / bounds.width) * viewBox.width,
        grid,
      ),
      y: snap(
        viewBox.y + ((clientY - bounds.top) / bounds.height) * viewBox.height,
        grid,
      ),
    };
  }

  function handleDrop(event: DragEvent<SVGSVGElement>): void {
    event.preventDefault();
    const instanceId = event.dataTransfer.getData("application/x-icm-instance");
    if (!instanceId) {
      return;
    }
    transact([
      {
        kind: "place_instance",
        instanceId,
        placement: {
          position: pointFromClient(
            event.clientX,
            event.clientY,
            event.currentTarget,
          ),
          rotation: 0,
          mirror: "none",
        },
      },
    ]);
    setSelectedIds([instanceId]);
  }

  function placeNewComponent(symbolId: string, position: Point): void {
    instanceCounter.current += 1;
    const prefix: Record<string, string> = {
      resistor: "R",
      capacitor: "C",
      inductor: "L",
      nmos: "M",
      pmos: "M",
      nmos3: "M",
      pmos3: "M",
      npn: "Q",
      pnp: "Q",
      diode: "D",
      zener: "D",
      schottky: "D",
      led: "D",
      "voltage-source": "V",
      "current-source": "I",
      "ac-voltage-source": "V",
      "pulse-voltage-source": "V",
      opamp: "U",
      "switch-open": "S",
      "switch-closed": "S",
      crystal: "Y",
      transformer: "T",
      ground: "GND",
      port: "P",
    };
    let id = `${prefix[symbolId] ?? "X"}${instanceCounter.current}`;
    while (document.instances.some((instance) => instance.id === id)) {
      instanceCounter.current += 1;
      id = `${prefix[symbolId] ?? "X"}${instanceCounter.current}`;
    }
    const result = transact([
      {
        kind: "add_instance",
        instance: {
          id,
          symbolId,
          placement: { position, rotation: 0, mirror: "none" },
          properties: {},
        },
      },
    ]);
    if (result.ok) {
      setSelectedIds([id]);
      setPendingSymbolId(null);
      setStatus(`Added ${id} (${symbolId})`);
    }
  }

  function selectInstance(instanceId: string, additive: boolean): void {
    setSelectedRouteId(null);
    setSelectedEndpoint(null);
    setSelectedAnnotationId(null);
    setSelectedIds((current) => {
      if (!additive) return [instanceId];
      return current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : [...current, instanceId];
    });
  }

  function beginMove(
    event: ReactPointerEvent<SVGCircleElement>,
    instanceId: string,
  ): void {
    if (tool !== "pointer" || event.button !== 0) return;
    event.stopPropagation();
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    if (!instance?.placement) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressInstanceClick.current = false;
    const movingIds = selectedIds.includes(instanceId)
      ? selectedIds
      : [instanceId];
    if (!selectedIds.includes(instanceId)) setSelectedIds([instanceId]);
    const pointerStart = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    setDragPreview({
      instanceIds: movingIds,
      originalPositions: Object.fromEntries(
        movingIds.map((id) => {
          const candidate = document.instances.find((item) => item.id === id)!;
          return [id, { ...candidate.placement!.position }];
        }),
      ),
      pointerStart,
      pointerId: event.pointerId,
      position: pointerStart,
    });
  }

  function previewMove(event: ReactPointerEvent<SVGCircleElement>): void {
    if (!dragPreview || dragPreview.pointerId !== event.pointerId) {
      return;
    }
    const position = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    if (
      position.x !== dragPreview.pointerStart.x ||
      position.y !== dragPreview.pointerStart.y
    ) {
      suppressInstanceClick.current = true;
    }
    setDragPreview({
      ...dragPreview,
      position,
    });
  }

  function finishMove(event: ReactPointerEvent<SVGCircleElement>): void {
    if (!dragPreview || dragPreview.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    const position = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    const delta = {
      x: position.x - dragPreview.pointerStart.x,
      y: position.y - dragPreview.pointerStart.y,
    };
    if (delta.x !== 0 || delta.y !== 0) {
      try {
        const moves = dragPreview.instanceIds.map((instanceId) => {
          const original = dragPreview.originalPositions[instanceId]!;
          return {
            instanceId,
            position: { x: original.x + delta.x, y: original.y + delta.y },
          };
        });
        const groupMove = proposeGroupMove(document, resolver, moves);
        const stretchEdits: SchematicEdit[] = groupMove.routes.map(
          (proposal) => {
            const route = document.routes.find(
              (candidate) => candidate.id === proposal.routeId,
            )!;
            return {
              kind: "set_route_points" as const,
              routeId: route.id,
              netId: route.netId,
              from: route.from,
              to: route.to,
              waypoints: proposal.waypoints,
              segmentModes: proposal.segmentModes,
            };
          },
        );
        transact([
          ...moves.map((move): SchematicEdit => ({
            kind: "move_instance",
            ...move,
          })),
          ...groupMove.junctions.map((move): SchematicEdit => ({
            kind: "move_junction",
            ...move,
          })),
          ...stretchEdits,
          ...groupMove.annotations.flatMap((move): SchematicEdit[] => {
            const annotation = document.annotations.find(
              (candidate) => candidate.id === move.annotationId,
            );
            return annotation
              ? [
                  {
                    kind: "upsert_annotation",
                    annotation: { ...annotation, position: move.position },
                  },
                ]
              : [];
          }),
        ]);
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Local stretch failed",
        );
      }
    }
    setDragPreview(null);
  }

  function rotateSelected(): void {
    const edits = selectedIds.flatMap((id): SchematicEdit[] => {
      const instance = document.instances.find(
        (candidate) => candidate.id === id,
      );
      if (!instance?.placement) return [];
      return [
        {
          kind: "rotate_instance",
          instanceId: instance.id,
          rotation: ((instance.placement.rotation + 90) % 360) as
            0 | 90 | 180 | 270,
        },
      ];
    });
    if (edits.length > 0) transact(edits);
  }

  function mirrorSelected(): void {
    const edits = selectedIds.flatMap((id): SchematicEdit[] => {
      const instance = document.instances.find(
        (candidate) => candidate.id === id,
      );
      if (!instance?.placement) return [];
      return [
        {
          kind: "mirror_instance",
          instanceId: instance.id,
          mirror: instance.placement.mirror === "none" ? "x" : "none",
        },
      ];
    });
    if (edits.length > 0) transact(edits);
  }

  function download(
    bytes: BlobPart,
    mediaType: string,
    extension: string,
  ): void {
    const url = URL.createObjectURL(new Blob([bytes], { type: mediaType }));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeExportBaseName(project.name)}.${extension}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function saveProjectFile(): void {
    download(serializeProject(project), "application/json", "icproj.json");
    localStorage.removeItem(RECOVERY_KEY);
    setRecoveryCandidate(null);
    setStatus(`Saved formal Project revision ${document.revision}`);
  }

  function restoreRecovery(): void {
    if (!recoveryCandidate) return;
    const recoveredDocument = recoveryCandidate.documents.find(
      (candidate) => candidate.id === recoveryCandidate.topDocumentId,
    )!;
    history.current.reset(recoveredDocument);
    setProject(recoveryCandidate);
    setRecoveryCandidate(null);
    setStatus(`Restored recovery revision ${recoveredDocument.revision}`);
  }

  function discardRecovery(): void {
    localStorage.removeItem(RECOVERY_KEY);
    setRecoveryCandidate(null);
    setStatus("Discarded recovery");
  }

  async function openProjectFile(file: File | null): Promise<void> {
    if (!file) return;
    try {
      const opened = parseProject(await file.text());
      const openedDocument = opened.documents.find(
        (candidate) => candidate.id === opened.topDocumentId,
      )!;
      history.current.reset(openedDocument);
      setProject(opened);
      setSelectedIds([]);
      setSelectedRouteId(null);
      setImportDiagnostics([]);
      localStorage.removeItem(RECOVERY_KEY);
      setRecoveryCandidate(null);
      setStatus(`Opened ${file.name} at revision ${openedDocument.revision}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project open failed");
    }
  }

  function loadVisualDemo(): void {
    const next = createVisualDemoProject();
    const nextDocument = next.documents.find(
      (candidate) => candidate.id === next.topDocumentId,
    )!;
    history.current.reset(nextDocument);
    setProject(next);
    setSelectedIds([]);
    setSelectedRouteId(null);
    setViewBox({ x: 20, y: -10, width: 430, height: 350 });
    setStatus("Loaded Phase 5 visual demo");
  }

  function addPlainText(): void {
    transactionCounter.current += 1;
    const id = `note-${transactionCounter.current}`;
    const result = transact([
      {
        kind: "upsert_annotation",
        annotation: {
          id,
          kind: "plain-text",
          text: "Design note",
          position: {
            x: Math.round(viewBox.x + viewBox.width / 2),
            y: Math.round(viewBox.y + viewBox.height - 20),
          },
          offset: { x: 0, y: 0 },
          alignment: "middle",
          rotation: 0,
          locked: false,
        },
      },
    ]);
    if (result.ok) {
      setSelectedAnnotationId(id);
      setSelectedIds([]);
      setSelectedRouteId(null);
      setStatus(`Added annotation ${id}`);
    }
  }

  function applyInstanceLabel(): void {
    if (!selectedInstance?.placement) return;
    const existing = document.annotations.find(
      (annotation) =>
        annotation.kind === "instance-label" &&
        annotation.attachedObjectId === selectedInstance.id,
    );
    const text = instanceLabelDraft.trim();
    if (!text) {
      if (existing)
        transact([{ kind: "remove_annotation", annotationId: existing.id }]);
      return;
    }
    const resolved = resolver.resolve(
      selectedInstance.symbolId,
      selectedInstance.symbolVariantId,
    );
    const distance = Math.ceil(
      Math.max(
        resolved?.definition.viewBox.width ?? 60,
        resolved?.definition.viewBox.height ?? 60,
      ) /
        2 +
        14,
    );
    const position = existing?.position ?? {
      x: selectedInstance.placement.position.x,
      y: selectedInstance.placement.position.y + distance,
    };
    const result = transact([
      {
        kind: "upsert_annotation",
        annotation: {
          id: existing?.id ?? `instance-label-${selectedInstance.id}`,
          kind: "instance-label",
          text,
          position,
          attachedObjectId: selectedInstance.id,
          offset: {
            x: position.x - selectedInstance.placement.position.x,
            y: position.y - selectedInstance.placement.position.y,
          },
          alignment: existing?.alignment ?? "middle",
          rotation: existing?.rotation ?? 0,
          locked: false,
        },
      },
    ]);
    if (result.ok) setStatus(`Renamed displayed instance label to ${text}`);
  }

  function applyNetLabel(): void {
    if (!selectedRoute) return;
    const net = document.nets.find(
      (candidate) => candidate.id === selectedRoute.netId,
    );
    if (!net) return;
    const labelId = `net-label-${selectedRoute.id}`;
    const existingLabel = document.annotations.find(
      (annotation) => annotation.id === labelId,
    );
    const name = netLabelDraft.trim();
    if (!name) {
      if (existingLabel) {
        transact([
          { kind: "remove_annotation", annotationId: existingLabel.id },
        ]);
      }
      return;
    }
    const sameNameNet = document.nets.find(
      (candidate) => candidate.id !== net.id && candidate.name === name,
    );
    const targetNetId = sameNameNet?.id ?? net.id;
    const polyline = routePolyline(document, resolver, selectedRoute);
    if (!polyline) return;
    const segment = Math.max(0, Math.floor((polyline.points.length - 1) / 2));
    const from = polyline.points[segment]!;
    const to = polyline.points[segment + 1] ?? from;
    const position = existingLabel?.position ?? {
      x: Math.round((from.x + to.x) / 2),
      y: Math.round((from.y + to.y) / 2 - 8),
    };
    const edits: SchematicEdit[] = sameNameNet
      ? [
          {
            kind: "merge_nets",
            targetNetId,
            sourceNetId: net.id,
          },
        ]
      : [{ kind: "set_net_name", netId: net.id, name }];
    edits.push({
      kind: "upsert_annotation",
      annotation: {
        id: labelId,
        kind: "net-label",
        text: name,
        position,
        attachedObjectId: targetNetId,
        offset: { x: 0, y: -8 },
        alignment: "middle",
        rotation: 0,
        locked: false,
      },
    });
    const result = transact(edits);
    if (result.ok) {
      setSelectedAnnotationId(labelId);
      setStatus(
        sameNameNet
          ? `Connected Nets through label ${name}`
          : `Named Net ${name}`,
      );
    }
  }

  function applyAnnotationText(): void {
    if (!selectedAnnotation) return;
    const text = annotationTextDraft.trim();
    if (!text) {
      transact([
        { kind: "remove_annotation", annotationId: selectedAnnotation.id },
      ]);
      setSelectedAnnotationId(null);
      return;
    }
    transact([
      {
        kind: "upsert_annotation",
        annotation: { ...selectedAnnotation, text },
      },
    ]);
  }

  function deleteSelectedAnnotation(): void {
    if (!selectedAnnotation) return;
    const result = transact([
      { kind: "remove_annotation", annotationId: selectedAnnotation.id },
    ]);
    if (result.ok) setSelectedAnnotationId(null);
  }

  function alignFirstLayoutGroup(): void {
    const group = document.layoutGroups[0];
    if (!group) {
      setStatus("No multi-instance layout group is available");
      return;
    }
    const instanceIds = group.objectIds.filter((id) =>
      document.instances.some((instance) => instance.id === id),
    );
    if (instanceIds.length < 2) {
      setStatus("No multi-instance layout group is available");
      return;
    }
    const result = transact([
      { kind: "align_instances", instanceIds, axis: "y" },
    ]);
    if (result.ok) setStatus(`Aligned layout group ${group.id}`);
  }

  function exportSvg(): void {
    const source = createFormalExportSource(document, resolver, {
      title: project.name,
    });
    download(source.svg, "image/svg+xml", "svg");
    setStatus(`Exported revision ${document.revision}`);
  }

  async function exportRaster(format: "png" | "pdf"): Promise<void> {
    setStatus(`Preparing ${format.toUpperCase()} export`);
    try {
      const source = createFormalExportSource(document, resolver, {
        title: project.name,
      });
      if (format === "png") {
        const { rasterizeFormalSvgInBrowser } =
          await import("@icm/exporters/browser");
        const png = await rasterizeFormalSvgInBrowser(source);
        download(png.bytes as BlobPart, png.mediaType, "png");
      } else {
        const { exportFormalArtifactsInBrowser } =
          await import("@icm/exporters/browser");
        const { pdf } = await exportFormalArtifactsInBrowser(source);
        download(pdf as BlobPart, "application/pdf", "pdf");
      }
      setStatus(
        `Exported ${format.toUpperCase()} revision ${document.revision}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function importSpiceFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) {
      return;
    }
    const selectedFiles = [...files];
    const sourceInputs = await Promise.all(
      selectedFiles.map(async (file) => ({
        path: file.webkitRelativePath || file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    const conventionalEntries = sourceInputs.filter((input) =>
      /\.(?:cir|sp|spi)$/iu.test(input.path),
    );
    const namedCircuitEntries = conventionalEntries.filter(
      (input) => input.path.split("/").at(-1)?.toLowerCase() === "circuit.spi",
    );
    const entryCandidates =
      namedCircuitEntries.length === 1
        ? namedCircuitEntries
        : conventionalEntries;
    if (entryCandidates.length !== 1) {
      setStatus(
        `Select one unambiguous .cir, .sp, or .spi entry and its local include files; found ${entryCandidates.length}`,
      );
      return;
    }
    setStatus("Importing SPICE sources");
    try {
      const result = await importSpiceSources(
        sourceInputs,
        entryCandidates[0]!.path,
      );
      setImportDiagnostics(result.diagnostics);
      if (!result.project || !result.successful) {
        const firstError = result.diagnostics.find(
          (item) => item.severity === "error",
        );
        setStatus(firstError?.message ?? "SPICE import failed");
        return;
      }
      const importedDocument = result.project.documents.find(
        (candidate) => candidate.id === result.project!.topDocumentId,
      )!;
      const instanceCount = result.project.documents.reduce(
        (count, candidate) => count + candidate.instances.length,
        0,
      );
      const genericCount = result.project.documents
        .flatMap((candidate) => candidate.instances)
        .filter((instance) =>
          instance.symbolId.startsWith("generic-block-"),
        ).length;
      history.current.reset(importedDocument);
      setProject(result.project);
      stageRecovery(result.project);
      setSelectedIds([]);
      setDragPreview(null);
      setViewBox(DEFAULT_VIEWBOX);
      setStatus(
        `Imported ${result.project.documents.length} Documents and ${instanceCount} instances; ${genericCount} generic symbols`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "SPICE import failed");
    }
  }

  function fitView(): void {
    const box = contentScene.viewBox;
    setViewBox({ ...box });
    setStatus("Fit Document");
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratioX = (event.clientX - bounds.left) / bounds.width;
    const ratioY = (event.clientY - bounds.top) / bounds.height;
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
    setViewBox((current) => {
      const width = Math.max(
        120,
        Math.min(5000, Math.round(current.width * factor)),
      );
      const height = Math.max(
        80,
        Math.min(3500, Math.round(current.height * factor)),
      );
      const cursorX = current.x + ratioX * current.width;
      const cursorY = current.y + ratioY * current.height;
      return {
        x: Math.round(cursorX - ratioX * width),
        y: Math.round(cursorY - ratioY * height),
        width,
        height,
      };
    });
  }

  function beginCanvasGesture(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.button === 1) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanPreview({
        clientStart: { x: event.clientX, y: event.clientY },
        viewBoxStart: viewBox,
        pointerId: event.pointerId,
      });
      return;
    }
    if (
      event.button !== 0 ||
      (event.target !== event.currentTarget &&
        (event.target as Element).tagName !== "rect")
    )
      return;
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
    if (pendingSymbolId) {
      placeNewComponent(pendingSymbolId, point);
      return;
    }
    if (tool === "wire") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setBoxPreview({ start: point, end: point, pointerId: event.pointerId });
  }

  function continueCanvasGesture(
    event: ReactPointerEvent<SVGSVGElement>,
  ): void {
    if (panPreview?.pointerId === event.pointerId) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const dx =
        ((event.clientX - panPreview.clientStart.x) / bounds.width) *
        panPreview.viewBoxStart.width;
      const dy =
        ((event.clientY - panPreview.clientStart.y) / bounds.height) *
        panPreview.viewBoxStart.height;
      setViewBox({
        ...panPreview.viewBoxStart,
        x: Math.round(panPreview.viewBoxStart.x - dx),
        y: Math.round(panPreview.viewBoxStart.y - dy),
      });
      return;
    }
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
    if (boxPreview?.pointerId === event.pointerId) {
      setBoxPreview({ ...boxPreview, end: point });
    }
    if (tool === "wire" && wireSource) setWirePreviewPoint(point);
  }

  function finishCanvasGesture(event: ReactPointerEvent<SVGSVGElement>): void {
    if (panPreview?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setPanPreview(null);
      return;
    }
    if (boxPreview?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const rect = normalizedRect(boxPreview.start, boxPreview.end);
    const clicked =
      rect.width <= document.presentation.grid &&
      rect.height <= document.presentation.grid;
    const ids = clicked
      ? []
      : document.instances
          .filter(
            (instance) =>
              instance.placement &&
              instance.placement.position.x >= rect.x &&
              instance.placement.position.x <= rect.x + rect.width &&
              instance.placement.position.y >= rect.y &&
              instance.placement.position.y <= rect.y + rect.height,
          )
          .map((instance) => instance.id);
    setSelectedIds(ids);
    setSelectedRouteId(null);
    setSelectedAnnotationId(null);
    setBoxPreview(null);
    setStatus(
      ids.length > 0 ? `Selected ${ids.length} instances` : "Selection cleared",
    );
  }

  function deleteSelection(): void {
    if (selectedAnnotationId) {
      deleteSelectedAnnotation();
      return;
    }
    if (selectedRouteId) {
      removeSelectedRouteGeometry();
      return;
    }
    if (selectedIds.length === 0) return;
    const result = transact(
      selectedIds.map((instanceId): SchematicEdit => ({
        kind: "remove_instance",
        instanceId,
      })),
    );
    if (result.ok) setSelectedIds([]);
  }

  function disconnectSelectedEndpoint(removeRoutes: boolean): void {
    if (!selectedEndpoint || selectedEndpoint.endpoint.kind === "junction") {
      return;
    }
    const routeEdits = removeRoutes
      ? document.routes
          .filter(
            (route) =>
              endpointKey(route.from) ===
                endpointKey(selectedEndpoint.endpoint) ||
              endpointKey(route.to) === endpointKey(selectedEndpoint.endpoint),
          )
          .map((route): SchematicEdit => ({
            kind: "make_flightline",
            routeId: route.id,
          }))
      : [];
    const result = transact([
      ...routeEdits,
      { kind: "disconnect_endpoint", endpoint: selectedEndpoint.endpoint },
    ]);
    if (result.ok) {
      setSelectedEndpoint(null);
      setStatus(
        removeRoutes ? "Deleted endpoint connection" : "Disconnected endpoint",
      );
    }
  }

  function copySelected(): void {
    const copied = copySelection(document, selectedIds);
    if (!copied) {
      setStatus("Select at least one component to copy");
      return;
    }
    clipboard.current = copied;
    pasteCounter.current = 0;
    setStatus(
      `Copied ${copied.instances.length} components and ${copied.routes.length} internal routes`,
    );
  }

  function pasteCopied(): void {
    if (!clipboard.current) {
      setStatus("Clipboard is empty");
      return;
    }
    pasteCounter.current += 1;
    const distance = document.presentation.grid * 2 * pasteCounter.current;
    const proposal = proposePaste(
      document,
      clipboard.current,
      { x: distance, y: distance },
      pasteCounter.current,
    );
    const result = transact(proposal.edits);
    if (result.ok) {
      setSelectedIds(proposal.instanceIds);
      setSelectedRouteId(null);
      setStatus(`Pasted ${proposal.instanceIds.length} components`);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey && key === "z") {
        event.preventDefault();
        transact([{ kind: event.shiftKey ? "redo" : "undo" }]);
      } else if (event.ctrlKey && key === "y") {
        event.preventDefault();
        transact([{ kind: "redo" }]);
      } else if (event.ctrlKey && key === "c") {
        event.preventDefault();
        copySelected();
      } else if (event.ctrlKey && key === "v") {
        event.preventDefault();
        pasteCopied();
      } else if (event.ctrlKey && key === "s") {
        event.preventDefault();
        saveProjectFile();
      } else if (event.ctrlKey && key === "o") {
        event.preventDefault();
        projectInputRef.current?.click();
      } else if (event.ctrlKey && key === "a") {
        event.preventDefault();
        setSelectedIds(
          document.instances
            .filter((instance) => instance.placement)
            .map((instance) => instance.id),
        );
      } else if (!event.ctrlKey && key === "r") {
        event.preventDefault();
        rotateSelected();
      } else if (!event.ctrlKey && key === "w") {
        event.preventDefault();
        activateTool("wire");
      } else if (!event.ctrlKey && key === "f") {
        event.preventDefault();
        fitView();
      } else if (event.key === "Escape") {
        setTool("pointer");
        setWireSource(null);
        setWirePreviewPoint(null);
        setPendingSymbolId(null);
        setBoxPreview(null);
        setStatus("Cancelled");
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Interactive Circuit Maker</h1>
          <p>{project.name}</p>
        </div>
        <nav className="toolbar" aria-label="Editor commands">
          <button type="button" onClick={() => setPaletteOpen(true)}>
            + Component
          </button>
          <button
            type="button"
            aria-pressed={tool === "wire"}
            onClick={() => activateTool("wire")}
          >
            Wire
          </button>
          <details className="command-menu" name="editor-command-menu">
            <summary>File</summary>
            <div className="command-popover">
              <button type="button" onClick={saveProjectFile}>
                Save Project
              </button>
              <label className="file-import">
                Open Project
                <input
                  ref={projectInputRef}
                  data-testid="project-file"
                  type="file"
                  accept=".json,.icproj.json,application/json"
                  onChange={(event) =>
                    void openProjectFile(event.currentTarget.files?.[0] ?? null)
                  }
                />
              </label>
              <label className="file-import">
                Import SPICE
                <input
                  data-testid="spice-files"
                  type="file"
                  accept=".spi,.cir,.sp,.inc,.lib"
                  multiple
                  onChange={(event) =>
                    void importSpiceFiles(event.currentTarget.files)
                  }
                />
              </label>
              {recoveryCandidate ? (
                <>
                  <button type="button" onClick={restoreRecovery}>
                    Restore recovery
                  </button>
                  <button type="button" onClick={discardRecovery}>
                    Discard recovery
                  </button>
                </>
              ) : null}
            </div>
          </details>
          <details className="command-menu" name="editor-command-menu">
            <summary>Edit</summary>
            <div className="command-popover">
              <button
                type="button"
                onClick={() => transact([{ kind: "undo" }])}
                disabled={!history.current.canUndo}
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => transact([{ kind: "redo" }])}
                disabled={!history.current.canRedo}
              >
                Redo
              </button>
              <button
                type="button"
                onClick={copySelected}
                disabled={selectedIds.length === 0}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={pasteCopied}
                disabled={!clipboard.current}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={deleteSelection}
                disabled={
                  !selectedRouteId &&
                  !selectedAnnotationId &&
                  selectedIds.length === 0
                }
              >
                Delete
              </button>
              <button
                type="button"
                onClick={rotateSelected}
                disabled={selectedIds.length === 0}
              >
                Rotate
              </button>
              <button
                type="button"
                onClick={mirrorSelected}
                disabled={selectedIds.length === 0}
              >
                Mirror
              </button>
              {selectedIds.length > 1 ? (
                <button type="button" onClick={alignFirstLayoutGroup}>
                  Align
                </button>
              ) : null}
            </div>
          </details>
          <details className="command-menu" name="editor-command-menu">
            <summary>View</summary>
            <div className="command-popover">
              <button type="button" onClick={fitView}>
                Fit
              </button>
              <span>{visualDiagnostics.length} diagnostics</span>
            </div>
          </details>
          <details className="command-menu" name="editor-command-menu">
            <summary>Export</summary>
            <div className="command-popover">
              <button type="button" aria-label="Export SVG" onClick={exportSvg}>
                SVG
              </button>
              <button
                type="button"
                aria-label="Export PNG"
                onClick={() => void exportRaster("png")}
              >
                PNG
              </button>
              <button
                type="button"
                aria-label="Export PDF"
                onClick={() => void exportRaster("pdf")}
              >
                PDF
              </button>
            </div>
          </details>
          <details className="command-menu" name="editor-command-menu">
            <summary>More</summary>
            <div className="command-popover">
              <button type="button" onClick={addPlainText}>
                Add text
              </button>
              <button type="button" onClick={loadRoutingDemo}>
                Open routing example
              </button>
              <button type="button" onClick={loadVisualDemo}>
                Open visual example
              </button>
              <small>
                Ctrl+C/V copy/paste · R rotate · W wire · F fit · Ctrl+wheel
                zoom · middle-drag pan
              </small>
            </div>
          </details>
        </nav>
      </header>
      {paletteOpen ? (
        <section className="component-palette" aria-label="Component palette">
          <div className="palette-header">
            <h2>Add Component</h2>
            <button
              type="button"
              onClick={() => setPaletteOpen(false)}
              aria-label="Close component palette"
            >
              ×
            </button>
          </div>
          <input
            autoFocus
            value={paletteQuery}
            onChange={(event) => setPaletteQuery(event.currentTarget.value)}
            placeholder="Search symbols"
            aria-label="Search components"
          />
          {componentGroups.map((group) => (
            <section key={group.category} className="palette-group">
              <h3>{group.category}</h3>
              <div className="palette-grid">
                {group.symbols.map((symbol) => (
                  <button
                    type="button"
                    key={symbol.id}
                    data-testid={`add-component-${symbol.id}`}
                    onClick={() => {
                      setPendingSymbolId(symbol.id);
                      setPaletteOpen(false);
                      setTool("pointer");
                      setStatus(`Place ${symbol.name} on the canvas`);
                    }}
                  >
                    <SymbolThumbnail symbol={symbol} />
                    <strong>{symbol.name}</strong>
                    <span>{symbol.id}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : null}
      <aside className="side-panel" aria-label="Project inspector">
        <h2>Project</h2>
        {unplaced.length > 0 ? <h3>Unplaced Instances</h3> : null}
        {unplaced.map((instance) => (
          <button
            type="button"
            draggable
            data-testid={`unplaced-${instance.id}`}
            key={instance.id}
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/x-icm-instance",
                instance.id,
              );
              event.dataTransfer.effectAllowed = "move";
            }}
          >
            {instance.id} · {instance.symbolId}
          </button>
        ))}
        {selectedInstance ? (
          <section className="context-actions" aria-label="Instance text">
            <h2>Instance text</h2>
            <label>
              Displayed name
              <input
                aria-label="Displayed instance name"
                value={instanceLabelDraft}
                onChange={(event) =>
                  setInstanceLabelDraft(event.currentTarget.value)
                }
              />
            </label>
            <button type="button" onClick={applyInstanceLabel}>
              Apply name
            </button>
          </section>
        ) : null}
        {selectedRouteId ? (
          <section className="context-actions" aria-label="Route actions">
            <h2>Route</h2>
            <label>
              Electrical Net label
              <input
                aria-label="Electrical Net label"
                value={netLabelDraft}
                onChange={(event) =>
                  setNetLabelDraft(event.currentTarget.value)
                }
              />
            </label>
            <button type="button" onClick={applyNetLabel}>
              Apply Net label
            </button>
            <button type="button" onClick={removeSelectedRouteGeometry}>
              Remove route geometry
            </button>
          </section>
        ) : null}
        {selectedAnnotation ? (
          <section className="context-actions" aria-label="Text actions">
            <h2>Text</h2>
            <label>
              Content
              <input
                aria-label="Selected text content"
                value={annotationTextDraft}
                onChange={(event) =>
                  setAnnotationTextDraft(event.currentTarget.value)
                }
              />
            </label>
            <button type="button" onClick={applyAnnotationText}>
              Apply text
            </button>
            <button type="button" onClick={deleteSelectedAnnotation}>
              Delete text
            </button>
          </section>
        ) : null}
        {selectedEndpoint && selectedEndpoint.endpoint.kind !== "junction" ? (
          <section className="context-actions" aria-label="Endpoint actions">
            <h2>Endpoint</h2>
            <button
              type="button"
              onClick={() => disconnectSelectedEndpoint(false)}
            >
              Disconnect endpoint
            </button>
            <button
              type="button"
              onClick={() => disconnectSelectedEndpoint(true)}
            >
              Delete connection
            </button>
          </section>
        ) : null}
        <dl className="inspector">
          <dt>Selected</dt>
          <dd>
            {selectedIds.length > 0
              ? selectedIds.join(", ")
              : (selectedRouteId ?? selectedAnnotationId ?? "None")}
          </dd>
          <dt>Internal routes</dt>
          <dd data-testid="selected-internal-route-count">
            {internalSelection.routeIds.length}
          </dd>
          <dt>Revision</dt>
          <dd data-testid="revision">{document.revision}</dd>
          <dt>Source status</dt>
          <dd data-testid="source-status">{document.sourceStatus}</dd>
          <dt>Documents</dt>
          <dd data-testid="document-count">{project.documents.length}</dd>
          <dt>Instances</dt>
          <dd data-testid="instance-count">{projectInstanceCount}</dd>
          <dt>Nets</dt>
          <dd data-testid="net-count">{document.nets.length}</dd>
          <dt>Tool</dt>
          <dd data-testid="active-tool">{tool}</dd>
          <dt>Flightlines</dt>
          <dd data-testid="flightline-count">{flightlines.length}</dd>
          <dt>Crossings</dt>
          <dd data-testid="crossing-count">{crossings.length}</dd>
          <dt>Annotations</dt>
          <dd data-testid="annotation-count">{document.annotations.length}</dd>
          <dt>Visual diagnostics</dt>
          <dd data-testid="visual-diagnostic-count">
            {visualDiagnostics.length}
          </dd>
          <dt>Blocking diagnostics</dt>
          <dd data-testid="blocking-diagnostic-count">
            {
              visualDiagnostics.filter(
                (diagnostic) => diagnostic.severity === "error",
              ).length
            }
          </dd>
          <dt>Status</dt>
          <dd data-testid="status" aria-live="polite">
            {status}
          </dd>
        </dl>
        <section aria-label="Import diagnostics" className="diagnostics">
          <h2>Import Diagnostics</h2>
          {importDiagnostics.length === 0 ? <p>No import diagnostics</p> : null}
          <ul data-testid="import-diagnostics">
            {importDiagnostics.map((diagnostic, index) => (
              <li
                key={`${diagnostic.code}-${index}`}
                data-severity={diagnostic.severity}
              >
                <strong>{diagnostic.code}</strong>: {diagnostic.message}
              </li>
            ))}
          </ul>
        </section>
      </aside>
      <section className="canvas-panel">
        <svg
          className="schematic-canvas"
          data-testid="schematic-canvas"
          role="img"
          aria-label="Schematic canvas"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          onWheel={handleWheel}
          onPointerDown={beginCanvasGesture}
          onPointerMove={continueCanvasGesture}
          onPointerUp={finishCanvasGesture}
          onPointerCancel={finishCanvasGesture}
          onContextMenu={(event) => {
            event.preventDefault();
            if (wireSource) {
              setWireSource(null);
              setWirePreviewPoint(null);
              setTool("pointer");
              setStatus("Wire cancelled");
            }
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <defs>
            <pattern
              id="grid"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="0" cy="0" r="0.7" fill="#d8d8d2" />
            </pattern>
          </defs>
          <rect
            x={viewBox.x}
            y={viewBox.y}
            width={viewBox.width}
            height={viewBox.height}
            fill="url(#grid)"
          />
          <g dangerouslySetInnerHTML={{ __html: scene.formalBody }} />
          <g data-layer="editor-overlay">
            {flightlines.map((flightline) => (
              <line
                key={flightline.id}
                data-testid="flightline"
                className="flightline"
                x1={flightline.fromPoint.x}
                y1={flightline.fromPoint.y}
                x2={flightline.toPoint.x}
                y2={flightline.toPoint.y}
              />
            ))}
            {wireDraftPoints.length >= 2 ? (
              <polyline
                data-testid="wire-preview"
                className="wire-preview"
                points={polylinePoints(wireDraftPoints)}
              />
            ) : null}
            {routePolylines.map(({ route, polyline }) => (
              <polyline
                key={route.id}
                data-testid={`route-hit-${route.id}`}
                className={
                  selectedRouteId === route.id ||
                  selectedInternalRouteIds.has(route.id)
                    ? "route-hit selected"
                    : "route-hit"
                }
                points={polylinePoints(polyline.points)}
                onPointerDown={(event) =>
                  handleRoutePointerDown(event, route.id)
                }
              />
            ))}
            {routePolylines
              .filter(
                ({ route, polyline }) =>
                  route.id === selectedRouteId && polyline.points.length === 2,
              )
              .map(({ route, polyline }) => {
                const from = polyline.points[0]!;
                const to = polyline.points[1]!;
                const preview =
                  routeStretchPreview?.routeId === route.id
                    ? routeStretchPreview.point
                    : null;
                return (
                  <circle
                    key={`handle-${route.id}`}
                    data-testid={`route-handle-${route.id}`}
                    className="route-handle"
                    cx={preview?.x ?? (from.x + to.x) / 2}
                    cy={preview?.y ?? (from.y + to.y) / 2}
                    r="6"
                    onPointerDown={(event) =>
                      beginRouteStretch(event, route.id)
                    }
                    onPointerMove={previewRouteStretch}
                    onPointerUp={finishRouteStretch}
                  />
                );
              })}
            {document.instances
              .filter((instance) => instance.placement !== null)
              .map((instance) => (
                <circle
                  key={instance.id}
                  data-testid={`hit-${instance.id}`}
                  cx={instance.placement!.position.x}
                  cy={instance.placement!.position.y}
                  r="36"
                  className={
                    selectedIds.includes(instance.id)
                      ? "hit-target selected"
                      : "hit-target"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (suppressInstanceClick.current) {
                      suppressInstanceClick.current = false;
                      return;
                    }
                    selectInstance(
                      instance.id,
                      event.shiftKey || event.ctrlKey,
                    );
                  }}
                  onPointerDown={(event) => beginMove(event, instance.id)}
                  onPointerMove={previewMove}
                  onPointerUp={finishMove}
                />
              ))}
            {visibleEndpoints.map((candidate) => (
              <circle
                key={`${candidate.netId}:${endpointTestId(candidate.endpoint)}`}
                data-testid={endpointTestId(candidate.endpoint)}
                className={
                  tool === "wire" ? "endpoint-hit active" : "endpoint-hit"
                }
                cx={candidate.point.x}
                cy={candidate.point.y}
                r="8"
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedEndpoint(candidate);
                  setSelectedRouteId(null);
                  setSelectedIds([]);
                  setSelectedAnnotationId(null);
                  setStatus(
                    `Endpoint actions: ${endpointTestId(candidate.endpoint)}`,
                  );
                }}
                onPointerDown={(event) => handleWireEndpoint(event, candidate)}
              />
            ))}
            {document.annotations.map((annotation) => {
              const preview =
                annotationDragPreview?.annotationId === annotation.id
                  ? annotationDragPreview.position
                  : annotation.position;
              return (
                <circle
                  key={`annotation-hit-${annotation.id}`}
                  data-testid={`annotation-hit-${annotation.id}`}
                  className={
                    selectedAnnotationId === annotation.id
                      ? "annotation-hit selected"
                      : "annotation-hit"
                  }
                  cx={preview.x}
                  cy={preview.y - 4}
                  r="10"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) =>
                    beginAnnotationDrag(event, annotation)
                  }
                  onPointerMove={previewAnnotationDrag}
                  onPointerUp={finishAnnotationDrag}
                />
              );
            })}
            {annotationDragPreview ? (
              <text
                className="annotation-drag-preview"
                x={annotationDragPreview.position.x}
                y={annotationDragPreview.position.y}
                textAnchor="middle"
              >
                {document.annotations.find(
                  (annotation) =>
                    annotation.id === annotationDragPreview.annotationId,
                )?.text ?? ""}
              </text>
            ) : null}
            {dragPreview
              ? dragPreview.instanceIds.map((instanceId) => {
                  const original = dragPreview.originalPositions[instanceId]!;
                  return (
                    <circle
                      key={instanceId}
                      className="drag-preview"
                      cx={
                        original.x +
                        dragPreview.position.x -
                        dragPreview.pointerStart.x
                      }
                      cy={
                        original.y +
                        dragPreview.position.y -
                        dragPreview.pointerStart.y
                      }
                      r="34"
                    />
                  );
                })
              : null}
            {boxPreview ? (
              <rect
                data-testid="selection-box"
                className="selection-box"
                {...normalizedRect(boxPreview.start, boxPreview.end)}
              />
            ) : null}
            {tool === "wire" && wirePreviewPoint ? (
              <circle
                className="snap-preview"
                cx={wirePreviewPoint.x}
                cy={wirePreviewPoint.y}
                r="4"
              />
            ) : null}
          </g>
        </svg>
      </section>
    </main>
  );
}
