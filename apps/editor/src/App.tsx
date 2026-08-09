import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";

import { DocumentHistory } from "@icm/edit-engine";
import type { EditTransactionResult, SchematicEdit } from "@icm/edit-engine";
import { createFormalExportSource, safeExportBaseName } from "@icm/exporters";
import {
  exportFormalArtifactsInBrowser,
  rasterizeFormalSvgInBrowser,
} from "@icm/exporters/browser";
import {
  deriveCrossings,
  deriveFlightlines,
  deriveInternalGroupSelection,
  diagnoseVisualQuality,
  endpointKey,
  hasBlockingVisualDiagnostics,
  isVisibleEndpoint,
  moveRouteSegment,
  proposeGroupMove,
  resolveDraftingObjectGeometry,
  routeAttachmentPlacement,
  routePolyline,
} from "@icm/derived";
import {
  CircuitProjectSchema,
  createEmptyProject,
  parseProject,
  serializeProject,
  flattenRichText,
  transformPoint,
} from "@icm/model";
import type {
  Annotation,
  CircuitProject,
  DraftingObject,
  Point,
  Rect,
  RichTextDocument,
  RouteAnnotationAttachment,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import {
  buildSvgScene,
  renderSymbolDefinitionBody,
  resolveSchematicStyleProfile,
  schematicTextDocument,
  schematicTextFontSize,
} from "@icm/render-svg";
import { importSpiceSources } from "@icm/spice";
import type { SpiceDiagnostic } from "@icm/spice";
import { builtInSymbols, createProjectSymbolResolver } from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

import { copySelection, proposePaste } from "./clipboard";
import type { SchematicClipboard } from "./clipboard";
import { proposeConnectedInstanceDeletion } from "./delete-selection";
import { createRoutingDemoProject } from "./routing-demo";
import { createVisualDemoProject } from "./visual-demo";
import { RichTextEditor } from "./rich-text-editor";

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

interface TextEditingSession {
  owner: "annotation" | "drafting";
  id: string;
  content: RichTextDocument;
  sizeScale: number;
}

interface RouteStretchPreview {
  routeId: string;
  segmentIndex: number;
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

interface DraftingDragPreview {
  objectId: string;
  originalPosition: Point;
  pointerStart: Point;
  position: Point;
  pointerId: number;
}

interface DraftingDragSession {
  cancel: () => void;
}

type EditorTool = "pointer" | "wire" | "guide" | "construction-line" | "arrow";

interface WireSource {
  endpoint: RouteEndpoint;
  netId: string | null;
  point: Point;
  preferredAxis?: OrthogonalAxis;
  preludeEdits: SchematicEdit[];
}

type OrthogonalAxis = "horizontal" | "vertical";

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

function referencedDocumentId(
  project: CircuitProject,
  instance: SchematicDocument["instances"][number],
): string | null {
  const target = instance.properties["spice.target"];
  if (typeof target !== "string" || !target.startsWith("subcircuit:")) {
    return null;
  }
  const name = target.slice("subcircuit:".length).toLowerCase();
  return (
    project.documents.find(
      (candidate) =>
        candidate.name.toLowerCase() === name ||
        candidate.sourceBinding?.cellName.toLowerCase() === name,
    )?.id ?? null
  );
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

function extendOrthogonalPath(
  points: readonly Point[],
  target: Point,
  preferredInitialAxis: OrthogonalAxis = "horizontal",
  preferredTargetAxis?: OrthogonalAxis,
): Point[] {
  const result = points.map((point) => ({ ...point }));
  const last = result.at(-1);
  if (!last) return [{ ...target }];
  if (last.x === target.x || last.y === target.y) {
    if (last.x !== target.x || last.y !== target.y) result.push({ ...target });
    return result;
  }
  const previous = result.at(-2);
  const departureAxis: OrthogonalAxis = previous
    ? previous.x === last.x
      ? "horizontal"
      : "vertical"
    : preferredInitialAxis;
  if (!preferredTargetAxis || departureAxis !== preferredTargetAxis) {
    result.push(
      departureAxis === "horizontal"
        ? { x: target.x, y: last.y }
        : { x: last.x, y: target.y },
    );
  } else if (departureAxis === "horizontal") {
    const middleX = snap((last.x + target.x) / 2, 1);
    result.push({ x: middleX, y: last.y }, { x: middleX, y: target.y });
  } else {
    const middleY = snap((last.y + target.y) / 2, 1);
    result.push({ x: last.x, y: middleY }, { x: target.x, y: middleY });
  }
  result.push({ ...target });
  return result;
}

function transformedPinAxis(
  direction: "north" | "east" | "south" | "west",
  rotation: 0 | 90 | 180 | 270,
): OrthogonalAxis {
  const localAxis =
    direction === "east" || direction === "west" ? "horizontal" : "vertical";
  return rotation === 90 || rotation === 270
    ? localAxis === "horizontal"
      ? "vertical"
      : "horizontal"
    : localAxis;
}

function segmentAtPoint(points: readonly Point[], point: Point): number | null {
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    const onVertical =
      from.x === to.x &&
      point.x === from.x &&
      point.y >= Math.min(from.y, to.y) &&
      point.y <= Math.max(from.y, to.y);
    const onHorizontal =
      from.y === to.y &&
      point.y === from.y &&
      point.x >= Math.min(from.x, to.x) &&
      point.x <= Math.max(from.x, to.x);
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

function maxRoutingCounter(document: SchematicDocument): number {
  const ids = [
    ...document.ports.map((item) => item.id),
    ...document.instances.map((item) => item.id),
    ...document.nets.map((item) => item.id),
    ...document.routes.map((item) => item.id),
    ...document.junctions.map((item) => item.id),
    ...document.annotations.map((item) => item.id),
    ...document.layoutGroups.map((item) => item.id),
    ...document.constraints.map((item) => item.id),
  ];
  let maximum = 0;
  for (const id of ids) {
    for (const match of id.matchAll(
      /(?:route-ui|junction-ui|net-ui)-(\d+)/gu,
    )) {
      maximum = Math.max(maximum, Number(match[1]));
    }
  }
  return maximum;
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

const RAZAVI_DEFAULT_SYMBOL_VARIANTS: Readonly<Record<string, string>> = {
  nmos: "textbook-3terminal",
  pmos: "textbook-3terminal",
};

const RAZAVI_RETIRED_PALETTE_SYMBOL_IDS = new Set(["nmos3", "pmos3"]);
const RAZAVI_IMPLICIT_BULK_NET_NAMES = new Set([
  "0",
  "gnd",
  "vss",
  "vdd",
  "vssa",
  "vdda",
  "vgnd",
  "vpwr",
]);

/**
 * Razavi is the sole current presentation family. Canonical MOS definitions
 * retain D/G/S/B electrically, while the textbook variant controls the
 * approved visible three-terminal body and source arrow.
 */
export function defaultRazaviSymbolVariantId(
  symbolId: string,
): string | undefined {
  return RAZAVI_DEFAULT_SYMBOL_VARIANTS[symbolId];
}

function isRazaviImplicitBulkNet(
  document: SchematicDocument,
  instanceId: string,
) {
  const bulkNet = document.nets.find((net) =>
    net.terminals.some(
      (terminal) =>
        terminal.instanceId === instanceId && terminal.pinName === "B",
    ),
  );
  if (!bulkNet) return true;
  return [bulkNet.name, bulkNet.id]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase().replaceAll(/[^a-z0-9]/gu, ""))
    .some((name) => RAZAVI_IMPLICIT_BULK_NET_NAMES.has(name));
}

/**
 * A style application is also a controlled visual migration. Only an absent
 * bulk connection or an explicitly recognized supply connection is implicit;
 * independent body-bias remains visible as a four-terminal MOS.
 */
export function razaviMosPresentationEdits(
  document: SchematicDocument,
): SchematicEdit[] {
  return document.instances.flatMap((instance) => {
    const symbolVariantId = defaultRazaviSymbolVariantId(instance.symbolId);
    if (
      !symbolVariantId ||
      instance.symbolVariantId !== undefined ||
      !isRazaviImplicitBulkNet(document, instance.id)
    ) {
      return [];
    }
    return [
      {
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: instance.symbolId,
        symbolVariantId,
      },
    ];
  });
}

function SymbolThumbnail({ symbol }: { symbol: SymbolDefinition }) {
  const variantId = defaultRazaviSymbolVariantId(symbol.id);
  const variant = symbol.variants.find(
    (candidate) => candidate.id === variantId,
  );
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
          __html: renderSymbolDefinitionBody(
            symbol,
            variant?.hiddenPrimitiveParts,
            variant?.additionalPrimitives,
          ),
        }}
      />
    </svg>
  );
}

export function App({ project: initialProject }: AppProps) {
  const [project, setProject] = useState(() =>
    CircuitProjectSchema.parse(
      structuredClone(
        initialProject ?? createEmptyProject("project-main", "New Circuit"),
      ),
    ),
  );
  const resolver = useMemo(
    () => createProjectSymbolResolver(project, builtInSymbols),
    [project],
  );
  const [activeDocumentId, setActiveDocumentId] = useState(
    () => project.topDocumentId,
  );
  const [documentStack, setDocumentStack] = useState<string[]>([]);
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
  const [draftingDragPreview, setDraftingDragPreview] =
    useState<DraftingDragPreview | null>(null);
  const [draftingCreatePreview, setDraftingCreatePreview] = useState<{
    start: Point;
    end: Point;
    pointerId: number;
  } | null>(null);
  const [tool, setTool] = useState<EditorTool>("pointer");
  const [wireSource, setWireSource] = useState<WireSource | null>(null);
  const [wirePreviewPoint, setWirePreviewPoint] = useState<Point | null>(null);
  const [wireWaypoints, setWireWaypoints] = useState<Point[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedRouteSegmentIndex, setSelectedRouteSegmentIndex] = useState<
    number | null
  >(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WireSource | null>(
    null,
  );
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);
  const [selectedDraftingId, setSelectedDraftingId] = useState<string | null>(
    null,
  );
  const [instanceLabelDraft, setInstanceLabelDraft] = useState("");
  const [netLabelDraft, setNetLabelDraft] = useState("");
  const [textEditing, setTextEditing] = useState<TextEditingSession | null>(
    null,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [pendingSymbolId, setPendingSymbolId] = useState<string | null>(null);
  const transactionCounter = useRef(0);
  const routeCounter = useRef(0);
  // P0-2: live position of an in-progress drafting drag; read in pointerup so
  // the commit runs exactly once (state updaters must stay side-effect free).
  const draftingDragPositionRef = useRef<Point | null>(null);
  const draftingDragSessionRef = useRef<DraftingDragSession | null>(null);
  const instanceCounter = useRef(0);
  const clipboard = useRef<SchematicClipboard | null>(null);
  const pasteCounter = useRef(0);
  const suppressInstanceClick = useRef(false);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const history = useRef(
    new DocumentHistory(
      project.documents.find(
        (candidate) => candidate.id === project.topDocumentId,
      )!,
      { symbolResolver: resolver },
    ),
  );
  const histories = useRef(new Map([[project.topDocumentId, history.current]]));
  const documentViewBoxes = useRef(new Map<string, Rect>());
  const document =
    project.documents.find((candidate) => candidate.id === activeDocumentId) ??
    project.documents.find(
      (candidate) => candidate.id === project.topDocumentId,
    )!;
  const scene = buildSvgScene(document, resolver, { bounds: viewBox });
  const unplaced = document.instances.filter(
    (instance) => instance.placement === null,
  );
  const unplacedPorts = document.ports.filter((port) => port.position === null);
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
  const selectedDrafting = selectedDraftingId
    ? document.drafting?.objects.find(
        (object) => object.id === selectedDraftingId,
      )
    : undefined;
  const styleProfile = resolveSchematicStyleProfile(
    document.presentation.styleProfileId,
  );
  const selectedPortId =
    selectedEndpoint?.endpoint.kind === "port"
      ? selectedEndpoint.endpoint.portId
      : null;
  const flightlines = deriveFlightlines(document, resolver);
  const crossings = deriveCrossings(document, resolver);
  const visualDiagnostics = diagnoseVisualQuality(document, resolver);
  const structuralDiagnostics = visualDiagnostics.filter(
    (diagnostic) => diagnostic.category === "structural",
  );
  const visualObservations = visualDiagnostics.filter(
    (diagnostic) => diagnostic.category === "observation",
  );
  const visibleEndpoints: WireSource[] = [
    ...document.instances.flatMap((instance) => {
      if (!instance.placement) return [];
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) return [];
      return resolved.definition.pins
        .filter((pin) =>
          isVisibleEndpoint(document, resolver, {
            kind: "terminal",
            instanceId: instance.id,
            pinName: pin.name,
          }),
        )
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
            preferredAxis: transformedPinAxis(
              pin.direction,
              instance.placement!.rotation,
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
    ...document.junctions
      .filter((junction) => (junction.role ?? "branch") === "branch")
      .map((junction): WireSource => ({
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
  function attachmentAtPoint(
    candidate: Point,
    routeId?: string,
    normalOffset = -14,
  ): { routeAttachment: RouteAnnotationAttachment; position: Point } | null {
    const candidates = routePolylines
      .filter((record) => !routeId || record.route.id === routeId)
      .flatMap(({ route, polyline }) =>
        polyline.points.slice(0, -1).map((from, segmentIndex) => {
          const to = polyline.points[segmentIndex + 1]!;
          const position = closestPointOnSegment(candidate, from, to);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const lengthSquared = dx * dx + dy * dy;
          const t =
            lengthSquared === 0
              ? 0
              : clamp(
                  ((position.x - from.x) * dx + (position.y - from.y) * dy) /
                    lengthSquared,
                  0,
                  1,
                );
          return {
            routeAttachment: {
              routeId: route.id,
              segmentIndex,
              t,
              direction: "forward" as const,
              normalOffset,
            },
            position,
            distanceSquared:
              (position.x - candidate.x) ** 2 + (position.y - candidate.y) ** 2,
          };
        }),
      )
      .sort((left, right) => left.distanceSquared - right.distanceSquared);
    const closest = candidates[0];
    return closest
      ? {
          routeAttachment: closest.routeAttachment,
          position: closest.position,
        }
      : null;
  }
  // ADR 0010 WP-A3 read-side unification. A route-marker carries its route
  // attachment as a VisualAnchor (kind "route"); the legacy current kind
  // carries it as routeAttachment. This helper returns the legacy
  // RouteAnnotationAttachment shape for either form so the existing geometry
  // code (anchor, hit box, drag, panel) handles both uniformly.
  function effectiveRouteAttachment(
    annotation: Annotation,
  ): RouteAnnotationAttachment | null {
    if (annotation.routeAttachment) return annotation.routeAttachment;
    if (
      annotation.kind === "route-marker" &&
      annotation.anchor?.kind === "route"
    ) {
      const anchor = annotation.anchor;
      return {
        routeId: anchor.routeId,
        segmentIndex: anchor.segmentIndex,
        t: anchor.t,
        direction: anchor.direction,
        normalOffset: anchor.normalOffset,
      };
    }
    return null;
  }

  function isRoutedMarker(annotation: Annotation): boolean {
    return (
      annotation.kind === "route-marker" && annotation.markerKind === "current"
    );
  }

  function annotationAnchor(annotation: Annotation): Point {
    const attachment = effectiveRouteAttachment(annotation);
    if (!isRoutedMarker(annotation) || !attachment) {
      // A route-marker/voltage with a free or object anchor resolves to its
      // fallbackPosition; otherwise the persisted position.
      if (
        annotation.kind === "route-marker" &&
        annotation.anchor?.kind === "object"
      ) {
        return annotation.anchor.fallbackPosition;
      }
      if (
        annotation.kind === "route-marker" &&
        annotation.anchor?.kind === "route"
      ) {
        return annotation.anchor.fallbackPosition;
      }
      return annotation.position;
    }
    const record = routePolylines.find(
      ({ route }) => route.id === attachment.routeId,
    );
    return (
      (record &&
        routeAttachmentPlacement(record.polyline, attachment)?.position) ??
      annotation.position
    );
  }

  function annotationHitBox(annotation: Annotation, anchor: Point): Rect {
    const sizeScale = annotation.sizeScale ?? 1;
    const fontSize =
      schematicTextFontSize(annotation.kind, styleProfile) * sizeScale;
    let labelPosition = anchor;
    let alignment = annotation.alignment;
    let rotation = annotation.rotation;
    let arrowBounds: Rect | null = null;

    if (isRoutedMarker(annotation)) {
      const routeAttachment = effectiveRouteAttachment(annotation);
      const record = routeAttachment
        ? routePolylines.find(
            ({ route }) => route.id === routeAttachment.routeId,
          )
        : undefined;
      const attachment =
        record && routeAttachment
          ? routeAttachmentPlacement(record.polyline, routeAttachment)
          : null;
      rotation = attachment?.rotation ?? annotation.rotation;
      const vertical = rotation === 90 || rotation === 270;
      labelPosition = attachment?.labelPosition ?? {
        x: anchor.x + (vertical ? 15 : 0),
        y: anchor.y + (vertical ? 4 : -7),
      };
      alignment = attachment
        ? "middle"
        : vertical
          ? "start"
          : annotation.alignment;
      const arrowLength =
        styleProfile.id === "textbook-monochrome-v1"
          ? 24
          : styleProfile.annotations.currentArrowLength;
      const halfLength = arrowLength / 2;
      arrowBounds = vertical
        ? {
            x: anchor.x - 6,
            y: anchor.y - halfLength,
            width: 12,
            height: arrowLength,
          }
        : {
            x: anchor.x - halfLength,
            y: anchor.y - 6,
            width: arrowLength,
            height: 12,
          };
    }

    const width = Math.max(
      fontSize * 0.6,
      annotation.text.length * fontSize * 0.6,
    );
    const height = fontSize * 1.35;
    const left =
      alignment === "start"
        ? labelPosition.x
        : alignment === "end"
          ? labelPosition.x - width
          : labelPosition.x - width / 2;
    const textBounds =
      rotation === 90 || rotation === 270
        ? {
            x: labelPosition.x - height / 2,
            y: labelPosition.y - width / 2,
            width: height,
            height: width,
          }
        : { x: left, y: labelPosition.y - fontSize * 1.05, width, height };
    const minimumX = Math.min(textBounds.x, arrowBounds?.x ?? textBounds.x);
    const minimumY = Math.min(textBounds.y, arrowBounds?.y ?? textBounds.y);
    const maximumX = Math.max(
      textBounds.x + textBounds.width,
      arrowBounds
        ? arrowBounds.x + arrowBounds.width
        : textBounds.x + textBounds.width,
    );
    const maximumY = Math.max(
      textBounds.y + textBounds.height,
      arrowBounds
        ? arrowBounds.y + arrowBounds.height
        : textBounds.y + textBounds.height,
    );
    const padding = 6;
    return {
      x: minimumX - padding,
      y: minimumY - padding,
      width: maximumX - minimumX + padding * 2,
      height: maximumY - minimumY + padding * 2,
    };
  }

  const editingAnnotation =
    textEditing?.owner === "annotation"
      ? document.annotations.find(
          (annotation) => annotation.id === textEditing.id,
        )
      : undefined;
  const editingDrafting =
    textEditing?.owner === "drafting"
      ? document.drafting?.objects.find(
          (object) => object.id === textEditing.id,
        )
      : undefined;
  const textEditingBounds = editingAnnotation
    ? annotationHitBox(editingAnnotation, annotationAnchor(editingAnnotation))
    : editingDrafting?.kind === "text"
      ? resolveDraftingObjectGeometry(document, resolver, editingDrafting)
          .bounds
      : null;
  const textEditingLocked = Boolean(
    editingAnnotation?.locked || editingDrafting?.locked,
  );

  function instanceHitBox(
    instance: SchematicDocument["instances"][number],
  ): Rect | null {
    if (!instance.placement) return null;
    const resolved = resolver.resolve(
      instance.symbolId,
      instance.symbolVariantId,
    );
    if (!resolved) return null;
    const viewBox = resolved.definition.viewBox;
    const corners = [
      { x: viewBox.x, y: viewBox.y },
      { x: viewBox.x + viewBox.width, y: viewBox.y },
      { x: viewBox.x, y: viewBox.y + viewBox.height },
      { x: viewBox.x + viewBox.width, y: viewBox.y + viewBox.height },
    ].map((point) =>
      transformPoint(point, instance.placement!.position, instance.placement!),
    );
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const padding = 3;
    const x = Math.min(...xs) - padding;
    const y = Math.min(...ys) - padding;
    return {
      x,
      y,
      width: Math.max(...xs) - x + padding,
      height: Math.max(...ys) - y + padding,
    };
  }
  const internalSelection = deriveInternalGroupSelection(document, selectedIds);
  const selectedInternalRouteIds = new Set(internalSelection.routeIds);
  const wireFixedPoints = wireSource
    ? [wireSource.point, ...wireWaypoints]
    : [];
  const wireDraftPoints =
    wireSource && wirePreviewPoint
      ? extendOrthogonalPath(
          wireFixedPoints,
          wirePreviewPoint,
          wireSource.preferredAxis,
        )
      : wireFixedPoints;
  const projectInstanceCount = project.documents.reduce(
    (count, candidate) => count + candidate.instances.length,
    0,
  );
  const componentSymbols = builtInSymbols.filter(
    (symbol) =>
      symbol.id !== "generic-block" &&
      !RAZAVI_RETIRED_PALETTE_SYMBOL_IDS.has(symbol.id) &&
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
    if (!selectedRouteId) setSelectedRouteSegmentIndex(null);
  }, [selectedRouteId]);

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

  function resetInteractionState(): void {
    setSelectedIds([]);
    setSelectedRouteId(null);
    setSelectedRouteSegmentIndex(null);
    setSelectedAnnotationId(null);
    setTextEditing(null);
    setSelectedEndpoint(null);
    setDragPreview(null);
    setWireSource(null);
    setWirePreviewPoint(null);
    setWireWaypoints([]);
    setTool("pointer");
  }

  function switchDocument(nextDocumentId: string): void {
    if (nextDocumentId === document.id) return;
    const nextDocument = project.documents.find(
      (candidate) => candidate.id === nextDocumentId,
    );
    if (!nextDocument) {
      setStatus(`Document not found: ${nextDocumentId}`);
      return;
    }
    documentViewBoxes.current.set(document.id, viewBox);
    const existingHistory = histories.current.get(nextDocument.id);
    history.current =
      existingHistory?.document.revision === nextDocument.revision
        ? existingHistory
        : new DocumentHistory(nextDocument, { symbolResolver: resolver });
    histories.current.set(nextDocument.id, history.current);
    setActiveDocumentId(nextDocument.id);
    setViewBox(
      documentViewBoxes.current.get(nextDocument.id) ?? DEFAULT_VIEWBOX,
    );
    resetInteractionState();
    setStatus(`Opened Document ${nextDocument.name}`);
  }

  function enterHierarchy(instanceId: string): void {
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    const targetId = instance ? referencedDocumentId(project, instance) : null;
    if (!targetId) {
      setStatus(`${instanceId} has no resolved child Document`);
      return;
    }
    setDocumentStack((current) => [...current, document.id]);
    switchDocument(targetId);
  }

  function returnToParentDocument(): void {
    const parentId = documentStack.at(-1);
    if (!parentId) return;
    setDocumentStack((current) => current.slice(0, -1));
    switchDocument(parentId);
  }

  function returnToTopDocument(): void {
    setDocumentStack([]);
    switchDocument(project.topDocumentId);
  }

  function replaceActiveProject(
    nextProject: CircuitProject,
    nextViewBox: Rect = DEFAULT_VIEWBOX,
  ): SchematicDocument {
    const nextDocument = nextProject.documents.find(
      (candidate) => candidate.id === nextProject.topDocumentId,
    )!;
    const nextResolver = createProjectSymbolResolver(
      nextProject,
      builtInSymbols,
    );
    history.current = new DocumentHistory(nextDocument, {
      symbolResolver: nextResolver,
    });
    histories.current = new Map([[nextDocument.id, history.current]]);
    documentViewBoxes.current = new Map();
    setProject(nextProject);
    setActiveDocumentId(nextDocument.id);
    setDocumentStack([]);
    setViewBox(nextViewBox);
    resetInteractionState();
    return nextDocument;
  }

  function jumpToVisualDiagnostic(
    diagnostic: (typeof visualDiagnostics)[number],
  ): void {
    const ids = diagnostic.objectIds;
    const instanceIds = ids.filter((id) =>
      document.instances.some((instance) => instance.id === id),
    );
    const routeId = ids.find((id) =>
      document.routes.some((route) => route.id === id),
    );
    const annotationId = ids.find((id) =>
      document.annotations.some((annotation) => annotation.id === id),
    );
    setSelectedIds(instanceIds);
    setSelectedRouteId(routeId ?? null);
    setSelectedAnnotationId(annotationId ?? null);
    setSelectedEndpoint(null);
    const target =
      diagnostic.bounds ??
      (diagnostic.point
        ? {
            x: diagnostic.point.x - 60,
            y: diagnostic.point.y - 60,
            width: 120,
            height: 120,
          }
        : null);
    if (target) {
      const padding = 30;
      setViewBox({
        x: target.x - padding,
        y: target.y - padding,
        width: Math.max(160, target.width + padding * 2),
        height: Math.max(120, target.height + padding * 2),
      });
    }
    setStatus(`${diagnostic.code}: ${ids.join(", ") || "Document"}`);
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

  function nextRoutingSuffix(): number {
    routeCounter.current =
      Math.max(routeCounter.current, maxRoutingCounter(document)) + 1;
    return routeCounter.current;
  }

  function activateTool(nextTool: EditorTool): void {
    setTool(nextTool);
    setWireSource(null);
    setWirePreviewPoint(null);
    setWireWaypoints([]);
    if (nextTool !== "pointer") {
      setSelectedRouteId(null);
      setSelectedRouteSegmentIndex(null);
    }
    setStatus(
      nextTool === "wire"
        ? "Wire: choose a pin, junction, route segment, or blank grid point"
        : "Pointer ready",
    );
  }

  function setPresentationStyle(
    styleProfileId: "textbook-monochrome-v1" | "razavi-textbook-v1",
  ): void {
    const mosEdits =
      styleProfileId === "razavi-textbook-v1"
        ? razaviMosPresentationEdits(document)
        : [];
    const edits: SchematicEdit[] = [
      ...(document.presentation.styleProfileId === styleProfileId
        ? []
        : [{ kind: "set_presentation_style" as const, styleProfileId }]),
      ...mosEdits,
    ];
    if (edits.length === 0) return;
    const result = transact(edits);
    if (result.ok) {
      setStatus(
        styleProfileId === "razavi-textbook-v1"
          ? `Applied Razavi textbook style; migrated ${mosEdits.length} MOS view${mosEdits.length === 1 ? "" : "s"}`
          : "Applied monochrome compatibility style to this Document",
      );
    }
  }

  function loadRoutingDemo(): void {
    const demo = createRoutingDemoProject();
    replaceActiveProject(demo);
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
      setWireWaypoints([]);
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
    const suffix = nextRoutingSuffix();
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
    const routedPoints = extendOrthogonalPath(
      [wireSource.point, ...wireWaypoints],
      candidate.point,
      wireSource.preferredAxis,
      candidate.preferredAxis,
    );
    const waypoints = routedPoints.slice(1, -1);
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
      setWireWaypoints([]);
      setTool("pointer");
      setStatus(`Committed route at revision ${result.revision}`);
    }
  }

  function freeWireAnchor(
    point: Point,
    netId: string,
    createNet: boolean,
  ): WireSource {
    const junctionId = `junction-ui-${nextRoutingSuffix()}`;
    return {
      endpoint: { kind: "junction", junctionId },
      netId,
      point,
      preludeEdits: [
        {
          kind: "add_junction",
          junctionId,
          netId,
          position: point,
          ...(createNet ? { createNet: true } : {}),
        },
      ],
    };
  }

  function fixWirePoint(point: Point): void {
    if (!wireSource) {
      const netId = `net-ui-${nextRoutingSuffix()}`;
      const source = freeWireAnchor(point, netId, true);
      setWireSource(source);
      setWirePreviewPoint(point);
      setWireWaypoints([]);
      setStatus("Wire source: free grid point");
      return;
    }
    const fixed = extendOrthogonalPath(
      [wireSource.point, ...wireWaypoints],
      point,
      wireSource.preferredAxis,
    );
    setWireWaypoints(fixed.slice(1));
    setWirePreviewPoint(point);
    setStatus(`Wire bend ${fixed.length - 1}; double-click or Enter to finish`);
  }

  function finishWireAtPoint(point: Point): void {
    if (!wireSource) {
      fixWirePoint(point);
      return;
    }
    const netId = wireSource.netId ?? `net-ui-${nextRoutingSuffix()}`;
    commitWire(freeWireAnchor(point, netId, wireSource.netId === null));
  }

  function routeAnchor(
    routeId: string,
    point: Point,
    segmentIndex: number,
  ): WireSource {
    const route = document.routes.find(
      (candidate) => candidate.id === routeId,
    )!;
    const suffix = nextRoutingSuffix();
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
      setSelectedRouteSegmentIndex(segmentIndex ?? 0);
      setSelectedIds([]);
      setSelectedAnnotationId(null);
      setStatus(
        `Selected route ${routeId}, segment ${(segmentIndex ?? 0) + 1}`,
      );
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
      setWireWaypoints([]);
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
    segmentIndex: number,
  ): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setRouteStretchPreview({
      routeId,
      segmentIndex,
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
    if (!record) {
      setRouteStretchPreview(null);
      return;
    }
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    try {
      const proposal = moveRouteSegment(
        record.polyline,
        routeStretchPreview.segmentIndex,
        point,
      );
      const result = transact([
        {
          kind: "set_route_points",
          routeId: record.route.id,
          netId: record.route.netId,
          from: record.route.from,
          to: record.route.to,
          ...proposal,
        },
      ]);
      if (result.ok) setStatus(`Moved route segment ${record.route.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Route move failed");
    }
    setRouteStretchPreview(null);
  }

  function constrainAnnotationPosition(
    annotation: Annotation,
    candidate: Point,
  ): Point {
    const routeAttachment = effectiveRouteAttachment(annotation);
    if (isRoutedMarker(annotation) && routeAttachment) {
      return (
        attachmentAtPoint(
          candidate,
          routeAttachment.routeId,
          routeAttachment.normalOffset,
        )?.position ?? annotation.position
      );
    }
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
    event: ReactPointerEvent<SVGRectElement>,
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
    event: ReactPointerEvent<SVGRectElement>,
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
    event: ReactPointerEvent<SVGRectElement>,
  ): void {
    if (annotationDragPreview?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const annotation = document.annotations.find(
      (candidate) => candidate.id === annotationDragPreview.annotationId,
    );
    if (annotation) {
      let offset = { ...annotation.offset };
      let routeAttachment = annotation.routeAttachment;
      // For a route-marker the route attachment lives on its VisualAnchor; the
      // drag re-resolves segmentIndex/t while preserving direction/offset.
      let anchor = annotation.anchor;
      const currentAttachment = effectiveRouteAttachment(annotation);
      if (isRoutedMarker(annotation) && currentAttachment) {
        const attached = attachmentAtPoint(
          annotationDragPreview.position,
          currentAttachment.routeId,
          currentAttachment.normalOffset,
        );
        if (attached) {
          if (annotation.kind === "route-marker" && anchor?.kind === "route") {
            anchor = {
              ...anchor,
              segmentIndex: attached.routeAttachment.segmentIndex,
              t: attached.routeAttachment.t,
              fallbackPosition: annotationDragPreview.position,
            };
          } else {
            routeAttachment = {
              ...attached.routeAttachment,
              direction: currentAttachment.direction,
            };
          }
        }
      }
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
            ...(routeAttachment ? { routeAttachment } : {}),
            ...(anchor ? { anchor } : {}),
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
    const symbolVariantId = defaultRazaviSymbolVariantId(symbolId);
    const result = transact([
      {
        kind: "add_instance",
        instance: {
          id,
          symbolId,
          ...(symbolVariantId ? { symbolVariantId } : {}),
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
    event: ReactPointerEvent<SVGRectElement>,
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

  function previewMove(event: ReactPointerEvent<SVGRectElement>): void {
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

  function finishMove(event: ReactPointerEvent<SVGRectElement>): void {
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
    const recoveredDocument = replaceActiveProject(recoveryCandidate);
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
      replaceActiveProject(opened);
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
    replaceActiveProject(next, { x: 20, y: -10, width: 430, height: 350 });
    setStatus("Loaded Phase 5 visual demo");
  }

  // Single entry point for selecting a drafting object. Editing is opened
  // separately (double-click/Enter) so selection and text caret ownership do
  // not fight drag gestures.
  function selectDraftingObject(id: string): void {
    setSelectedDraftingId(id);
    setSelectedAnnotationId(null);
    setSelectedRouteId(null);
    setSelectedIds([]);
  }

  // WP-R5: drag a drafting object by its free anchor. Object/route anchors move
  // with their target by construction; only a free anchor's position changes,
  // and the persisted update goes through a typed edit.
  // P0-2: dragging a drafting object uses a preview and commits ONE typed
  // transaction on pointerup, so a long drag is a single undoable revision
  // (not one revision per mouse sample). Escape/pointercancel discards it.
  function beginDraftingDrag(
    event: ReactPointerEvent<SVGElement>,
    object: Extract<DraftingObject, { kind: "text" }>,
  ): void {
    if (event.button !== 0 || object.locked) return;
    if (object.anchor.kind !== "free") {
      selectDraftingObject(object.id);
      return;
    }
    event.stopPropagation();
    draftingDragSessionRef.current?.cancel();
    const hitTarget = event.currentTarget;
    hitTarget.setPointerCapture(event.pointerId);
    const start = pointFromClient(
      event.clientX,
      event.clientY,
      hitTarget.ownerSVGElement!,
    );
    const original = { ...object.anchor.position };
    draftingDragPositionRef.current = original;
    selectDraftingObject(object.id);
    setDraftingDragPreview({
      objectId: object.id,
      originalPosition: original,
      pointerStart: start,
      position: original,
      pointerId: event.pointerId,
    });

    const move = (moveEvent: PointerEvent): void => {
      const point = pointFromClient(
        moveEvent.clientX,
        moveEvent.clientY,
        hitTarget.ownerSVGElement!,
      );
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const position = {
        x: Math.round(original.x + dx),
        y: Math.round(original.y + dy),
      };
      draftingDragPositionRef.current = position;
      setDraftingDragPreview((current) =>
        current ? { ...current, position } : current,
      );
    };

    const cancel = (): void => {
      draftingDragPositionRef.current = null;
      setDraftingDragPreview(null);
      draftingDragSessionRef.current = null;
      if (hitTarget.hasPointerCapture(event.pointerId)) {
        hitTarget.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };

    const up = (): void => {
      // Commit exactly once from the ref (state updaters must not have side
      // effects; React may invoke them twice in Strict Mode). A click without
      // movement does not commit, so selection does not add a revision.
      const position = draftingDragPositionRef.current;
      draftingDragPositionRef.current = null;
      setDraftingDragPreview(null);
      draftingDragSessionRef.current = null;
      if (
        position &&
        (position.x !== original.x || position.y !== original.y)
      ) {
        const latest = document.drafting?.objects.find(
          (item) => item.id === object.id,
        );
        if (latest?.kind === "text" && latest.anchor.kind === "free") {
          transact([
            {
              kind: "upsert_drafting_object",
              object: {
                ...latest,
                anchor: { kind: "free", position },
              },
            },
          ]);
        }
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };

    draftingDragSessionRef.current = { cancel };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  function addPlainText(): void {
    transactionCounter.current += 1;
    const id = `note-${transactionCounter.current}`;
    const position = {
      x: Math.round(viewBox.x + viewBox.width / 2),
      y: Math.round(viewBox.y + viewBox.height - 20),
    };
    const textObject: Extract<DraftingObject, { kind: "text" }> = {
      id,
      kind: "text",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position },
      content: { runs: [{ kind: "text", value: "Design note" }] },
      alignment: "middle",
      rotation: 0,
    };
    const result = transact([
      {
        kind: "upsert_drafting_object",
        object: textObject,
      },
    ]);
    if (result.ok) {
      beginDraftingTextEditing(textObject);
      setStatus(`Added drafting text ${id}`);
    }
  }

  function addConstructionLine(): void {
    transactionCounter.current += 1;
    const id = `construction-${transactionCounter.current}`;
    const center = {
      x: Math.round(viewBox.x + viewBox.width / 2),
      y: Math.round(viewBox.y + viewBox.height / 2),
    };
    const result = transact([
      {
        kind: "upsert_drafting_object",
        object: {
          id,
          kind: "construction-line",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: center },
          points: [
            { x: center.x - 80, y: center.y },
            { x: center.x + 80, y: center.y },
          ],
          lineStyle: "dashed",
        },
      },
    ]);
    if (result.ok) setStatus(`Added construction line ${id}`);
  }

  function addFreeArrow(): void {
    transactionCounter.current += 1;
    const id = `arrow-${transactionCounter.current}`;
    const center = {
      x: Math.round(viewBox.x + viewBox.width / 2),
      y: Math.round(viewBox.y + viewBox.height / 2),
    };
    const result = transact([
      {
        kind: "upsert_drafting_object",
        object: {
          id,
          kind: "arrow",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: center },
          from: { kind: "free", position: { x: center.x - 60, y: center.y } },
          to: { kind: "free", position: { x: center.x + 60, y: center.y } },
        },
      },
    ]);
    if (result.ok) setStatus(`Added free arrow ${id}`);
  }

  function addFloatingSymbol(): void {
    transactionCounter.current += 1;
    const id = `floating-${transactionCounter.current}`;
    const position = {
      x: Math.round(viewBox.x + viewBox.width / 2),
      y: Math.round(viewBox.y + viewBox.height / 2),
    };
    const result = transact([
      {
        kind: "upsert_drafting_object",
        object: {
          id,
          kind: "floating-symbol",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position },
          symbolId: "decorative-note-box",
          transform: { rotation: 0, mirror: "none" },
        },
      },
    ]);
    if (result.ok) {
      setStatus(`Added floating symbol ${id}`);
    } else {
      setStatus("Floating symbol requires a decorative catalog entry");
    }
  }

  function addCurrentArrow(): void {
    if (!selectedRoute) {
      setStatus("Select a wire segment before adding a current arrow");
      return;
    }
    const segmentIndex = Math.min(
      selectedRouteSegmentIndex ?? 0,
      selectedRoute.segmentModes.length - 1,
    );
    const record = routePolylines.find(
      ({ route }) => route.id === selectedRoute.id,
    );
    const from = record?.polyline.points[segmentIndex];
    const to = record?.polyline.points[segmentIndex + 1];
    if (!from || !to) {
      setStatus("Selected wire segment cannot accept a current arrow");
      return;
    }
    transactionCounter.current += 1;
    const id = `current-${transactionCounter.current}`;
    const fallbackPosition = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const result = transact([
      {
        kind: "upsert_schematic_annotation",
        annotation: {
          id,
          kind: "route-marker",
          markerKind: "current",
          text: "I_x",
          position: fallbackPosition,
          anchor: {
            kind: "route",
            routeId: selectedRoute.id,
            segmentIndex,
            t: 0.5,
            normalOffset: -14,
            direction: "forward",
            orientation: "follow",
            fallbackPosition,
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
      setStatus(`Added current arrow on ${selectedRoute.id}`);
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

  function setSelectedMosTerminalPresentation(
    presentation: "three-terminal" | "four-terminal",
  ): void {
    if (!selectedInstance) return;
    const textbookVariantId = defaultRazaviSymbolVariantId(
      selectedInstance.symbolId,
    );
    if (!textbookVariantId) return;
    const symbolVariantId =
      presentation === "three-terminal" ? textbookVariantId : null;
    if (
      (presentation === "three-terminal" &&
        selectedInstance.symbolVariantId === textbookVariantId) ||
      (presentation === "four-terminal" &&
        selectedInstance.symbolVariantId === undefined)
    ) {
      return;
    }
    const result = transact([
      {
        kind: "set_instance_symbol",
        instanceId: selectedInstance.id,
        symbolId: selectedInstance.symbolId,
        symbolVariantId,
      },
    ]);
    if (result.ok) {
      setStatus(
        presentation === "three-terminal"
          ? `Set ${selectedInstance.id} to Razavi three-terminal view`
          : `Set ${selectedInstance.id} to four-terminal Bulk-visible view`,
      );
    }
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

  function richTextEqual(
    left: { runs: unknown[] },
    right: { runs: unknown[] },
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function annotationRichText(annotation: Annotation): RichTextDocument {
    return annotation.content
      ? (annotation.content as unknown as RichTextDocument)
      : schematicTextDocument(annotation.text, annotation.kind);
  }

  function beginAnnotationTextEditing(annotation: Annotation): void {
    setSelectedAnnotationId(annotation.id);
    setSelectedDraftingId(null);
    setSelectedRouteId(null);
    setSelectedIds([]);
    setTextEditing({
      owner: "annotation",
      id: annotation.id,
      content: annotationRichText(annotation),
      sizeScale: annotation.sizeScale ?? 1,
    });
  }

  function beginDraftingTextEditing(
    object: Extract<DraftingObject, { kind: "text" }>,
  ): void {
    selectDraftingObject(object.id);
    setTextEditing({
      owner: "drafting",
      id: object.id,
      content: object.content as unknown as RichTextDocument,
      sizeScale: object.styleOverride?.sizeScale ?? 1,
    });
  }

  function updateTextEditing(
    change: Partial<Pick<TextEditingSession, "content" | "sizeScale">>,
  ): void {
    setTextEditing((current) => (current ? { ...current, ...change } : null));
  }

  function deleteTextEditing(): void {
    if (!textEditing) return;
    const result =
      textEditing.owner === "annotation"
        ? transact([
            { kind: "remove_annotation", annotationId: textEditing.id },
          ])
        : transact([
            { kind: "remove_drafting_object", objectId: textEditing.id },
          ]);
    if (result.ok) {
      setSelectedAnnotationId(null);
      setSelectedDraftingId(null);
      setTextEditing(null);
      setStatus(`Deleted text ${textEditing.id}`);
    }
  }

  function commitTextEditing(): void {
    if (!textEditing) return;
    const plainText = flattenRichText(
      textEditing.content as unknown as Parameters<typeof flattenRichText>[0],
    ).trim();
    if (!plainText) {
      deleteTextEditing();
      return;
    }
    if (textEditing.owner === "annotation") {
      const annotation = document.annotations.find(
        (candidate) => candidate.id === textEditing.id,
      );
      if (!annotation || annotation.locked) return;
      const next = {
        ...annotation,
        text: plainText,
        content: textEditing.content,
        sizeScale: textEditing.sizeScale,
      };
      if (
        annotation.text === next.text &&
        annotation.sizeScale === next.sizeScale &&
        annotation.content &&
        richTextEqual(annotation.content, next.content)
      ) {
        setTextEditing(null);
        return;
      }
      const result = transact([
        { kind: "upsert_annotation", annotation: next },
      ]);
      if (result.ok) {
        setTextEditing(null);
        setStatus(`Updated text ${annotation.id}`);
      }
      return;
    }
    const object = document.drafting?.objects.find(
      (candidate) => candidate.id === textEditing.id,
    );
    if (!object || object.kind !== "text" || object.locked) return;
    const next = {
      ...object,
      content: textEditing.content,
      styleOverride: {
        ...object.styleOverride,
        sizeScale: textEditing.sizeScale,
      },
    };
    if (
      object.styleOverride?.sizeScale === next.styleOverride.sizeScale &&
      richTextEqual(object.content, next.content)
    ) {
      setTextEditing(null);
      return;
    }
    const result = transact([{ kind: "upsert_drafting_object", object: next }]);
    if (result.ok) {
      setTextEditing(null);
      setStatus(`Updated text ${object.id}`);
    }
  }

  // WP-R3: editing is lossless — the markup string round-trips through
  // parseMarkup(serializeMarkup(ast)). If the parsed AST equals the stored
  // AST, do not generate a revision.
  // --- ADR 0010 Guide tool ------------------------------------------------
  function addGuide(axis: "horizontal" | "vertical"): void {
    const coordinate =
      axis === "vertical"
        ? Math.round(viewBox.x + viewBox.width / 2)
        : Math.round(viewBox.y + viewBox.height / 2);
    const id = `guide-${++transactionCounter.current}`;
    const result = transact([
      {
        kind: "set_guide",
        guide: {
          id,
          axis,
          coordinate,
          locked: false,
          visible: true,
        },
      },
    ]);
    if (result.ok) setStatus(`Added ${axis} guide ${id}`);
  }

  function toggleGuideLock(guideId: string): void {
    const guide = document.drafting?.guides.find(
      (candidate) => candidate.id === guideId,
    );
    if (!guide) return;
    transact([
      {
        kind: "set_guide",
        guide: { ...guide, locked: !guide.locked },
      },
    ]);
  }

  function deleteGuide(guideId: string): void {
    const guide = document.drafting?.guides.find(
      (candidate) => candidate.id === guideId,
    );
    if (guide?.locked) {
      setStatus("Guide is locked; unlock it before deleting");
      return;
    }
    transact([{ kind: "remove_guide", guideId }]);
  }

  function toggleGuidesVisible(): void {
    const guides = document.drafting?.guides ?? [];
    const allVisible = guides.every((guide) => guide.visible);
    const edits = guides.map((guide): SchematicEdit => ({
      kind: "set_guide",
      guide: { ...guide, visible: !allVisible },
    }));
    if (edits.length > 0) transact(edits);
  }

  function clearUnlockedGuides(): void {
    const guides = document.drafting?.guides ?? [];
    const edits = guides
      .filter((guide) => !guide.locked)
      .map((guide): SchematicEdit => ({
        kind: "remove_guide",
        guideId: guide.id,
      }));
    if (edits.length > 0) transact(edits);
  }

  function beginGuideDrag(
    event: ReactPointerEvent<SVGLineElement>,
    guide: { id: string; axis: "horizontal" | "vertical"; locked: boolean },
  ): void {
    if (guide.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget.ownerSVGElement;
    if (!element) return;
    const move = (moveEvent: PointerEvent): void => {
      const point = pointFromClient(
        moveEvent.clientX,
        moveEvent.clientY,
        element,
      );
      const current = document.drafting?.guides.find(
        (candidate) => candidate.id === guide.id,
      );
      if (!current) return;
      transact([
        {
          kind: "set_guide",
          guide: {
            ...current,
            coordinate: Math.round(
              guide.axis === "vertical" ? point.x : point.y,
            ),
          },
        },
      ]);
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function deleteSelectedAnnotation(): void {
    if (!selectedAnnotation) return;
    const result = transact([
      { kind: "remove_annotation", annotationId: selectedAnnotation.id },
    ]);
    if (result.ok) setSelectedAnnotationId(null);
  }

  function reverseSelectedCurrentArrow(): void {
    if (!selectedAnnotation || !isRoutedMarker(selectedAnnotation)) {
      return;
    }
    const attachment = effectiveRouteAttachment(selectedAnnotation);
    if (!attachment) return;
    const direction: "forward" | "reverse" =
      attachment.direction === "forward" ? "reverse" : "forward";
    // A route-marker stores direction on its route VisualAnchor.
    const anchor =
      selectedAnnotation.kind === "route-marker" &&
      selectedAnnotation.anchor?.kind === "route"
        ? { ...selectedAnnotation.anchor, direction }
        : selectedAnnotation.anchor;
    const result = transact([
      {
        kind: "upsert_annotation",
        annotation: {
          ...selectedAnnotation,
          ...(anchor ? { anchor } : {}),
        },
      },
    ]);
    if (result.ok) setStatus(`Current arrow points ${direction}`);
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
        const png = await rasterizeFormalSvgInBrowser(source);
        download(png.bytes as BlobPart, png.mediaType, "png");
      } else {
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
      const instanceCount = result.project.documents.reduce(
        (count, candidate) => count + candidate.instances.length,
        0,
      );
      const genericCount = result.project.documents
        .flatMap((candidate) => candidate.instances)
        .filter((instance) =>
          instance.symbolId.startsWith("generic-block-"),
        ).length;
      replaceActiveProject(result.project);
      stageRecovery(result.project);
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

  function placePortAtViewCenter(portId: string): void {
    const port = document.ports.find((candidate) => candidate.id === portId);
    if (!port) return;
    const position = {
      x: snap(viewBox.x + viewBox.width / 2, document.presentation.grid),
      y: snap(viewBox.y + viewBox.height / 2, document.presentation.grid),
    };
    const result = transact([
      {
        kind: port.position ? "move_port" : "place_port",
        portId,
        position,
      },
    ]);
    if (result.ok)
      setStatus(`${port.position ? "Moved" : "Placed"} ${port.name}`);
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
    if (tool === "guide") {
      // ADR 0010: clicking with the Guide tool adds a vertical guide at the
      // click x (the toolbar offers horizontal/vertical and clear/lock
      // actions). Guides are editor aids; they never enter formal export.
      const id = `guide-${++transactionCounter.current}`;
      const result = transact([
        {
          kind: "set_guide",
          guide: {
            id,
            axis: "vertical",
            coordinate: Math.round(point.x),
            locked: false,
            visible: true,
          },
        },
      ]);
      if (result.ok) {
        setTool("pointer");
        setStatus(`Added guide ${id}`);
      }
      return;
    }
    if (tool === "construction-line" || tool === "arrow") {
      // P1: drag from the start point to the end point to create the object.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraftingCreatePreview({
        start: point,
        end: point,
        pointerId: event.pointerId,
      });
      return;
    }
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
    if (draftingCreatePreview?.pointerId === event.pointerId) {
      setDraftingCreatePreview({ ...draftingCreatePreview, end: point });
    }
    if (tool === "wire" && wireSource) setWirePreviewPoint(point);
  }

  function finishCanvasGesture(event: ReactPointerEvent<SVGSVGElement>): void {
    if (panPreview?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setPanPreview(null);
      return;
    }
    if (draftingCreatePreview?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      const { start, end } = draftingCreatePreview;
      setDraftingCreatePreview(null);
      commitDraftingCreate(tool, start, end);
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

  // P1: commit a drag-created drafting object at the final end point.
  function commitDraftingCreate(
    activeTool: EditorTool,
    start: Point,
    end: Point,
  ): void {
    transactionCounter.current += 1;
    if (activeTool === "construction-line") {
      const id = `construction-${transactionCounter.current}`;
      const result = transact([
        {
          kind: "upsert_drafting_object",
          object: {
            id,
            kind: "construction-line",
            locked: false,
            zIndex: 0,
            anchor: { kind: "free", position: start },
            points: [
              { x: Math.round(start.x), y: Math.round(start.y) },
              { x: Math.round(end.x), y: Math.round(end.y) },
            ],
            lineStyle: "dashed",
          },
        },
      ]);
      if (result.ok) setStatus(`Added construction line ${id}`);
    } else if (activeTool === "arrow") {
      const id = `arrow-${transactionCounter.current}`;
      const result = transact([
        {
          kind: "upsert_drafting_object",
          object: {
            id,
            kind: "arrow",
            locked: false,
            zIndex: 0,
            anchor: { kind: "free", position: start },
            from: {
              kind: "free",
              position: { x: Math.round(start.x), y: Math.round(start.y) },
            },
            to: {
              kind: "free",
              position: { x: Math.round(end.x), y: Math.round(end.y) },
            },
          },
        },
      ]);
      if (result.ok) setStatus(`Added free arrow ${id}`);
    }
    setTool("pointer");
  }

  function deleteSelection(): void {
    if (selectedEndpoint?.endpoint.kind === "junction") {
      deleteSelectedJunction();
      return;
    }
    if (selectedAnnotationId) {
      deleteSelectedAnnotation();
      return;
    }
    if (selectedDraftingId) {
      const object = document.drafting?.objects.find(
        (candidate) => candidate.id === selectedDraftingId,
      );
      if (object?.locked) {
        setStatus("Drafting object is locked; unlock it before deleting");
        return;
      }
      const result = transact([
        { kind: "remove_drafting_object", objectId: selectedDraftingId },
      ]);
      if (result.ok) {
        setSelectedDraftingId(null);
        setStatus(`Deleted drafting object ${selectedDraftingId}`);
      }
      return;
    }
    if (selectedRouteId) {
      removeSelectedRouteGeometry();
      return;
    }
    if (selectedIds.length === 0) return;
    transactionCounter.current += 1;
    try {
      const result = transact(
        proposeConnectedInstanceDeletion(
          document,
          resolver,
          selectedIds,
          transactionCounter.current,
        ),
      );
      if (result.ok) {
        setSelectedIds([]);
        setStatus(
          "Deleted component selection; connected wires remain dangling",
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function deleteSelectedJunction(): void {
    if (selectedEndpoint?.endpoint.kind !== "junction") return;
    const junctionId = selectedEndpoint.endpoint.junctionId;
    const attachedRouteEdits = document.routes
      .filter(
        (route) =>
          (route.from.kind === "junction" &&
            route.from.junctionId === junctionId) ||
          (route.to.kind === "junction" && route.to.junctionId === junctionId),
      )
      .map((route): SchematicEdit => ({
        kind: "make_flightline",
        routeId: route.id,
      }));
    const result = transact([
      ...attachedRouteEdits,
      { kind: "remove_junction", junctionId },
    ]);
    if (result.ok) {
      setSelectedEndpoint(null);
      setStatus(
        `Deleted junction and ${attachedRouteEdits.length} attached routes`,
      );
    }
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
      } else if (!event.ctrlKey && key === "g") {
        event.preventDefault();
        activateTool("guide");
      } else if (!event.ctrlKey && key === "f") {
        event.preventDefault();
        fitView();
      } else if (event.key === "Enter" && wireSource && wirePreviewPoint) {
        event.preventDefault();
        finishWireAtPoint(wirePreviewPoint);
      } else if (event.key === "Escape") {
        setTool("pointer");
        setWireSource(null);
        setWirePreviewPoint(null);
        setWireWaypoints([]);
        setPendingSymbolId(null);
        setBoxPreview(null);
        // P0-2: Escape cancels an in-progress drafting drag without committing.
        if (draftingDragSessionRef.current) {
          draftingDragSessionRef.current.cancel();
          setStatus("Cancelled drafting drag");
          return;
        }
        setStatus("Cancelled");
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (wireSource && wireWaypoints.length > 0) {
          setWireWaypoints(wireWaypoints.slice(0, -1));
          setStatus("Removed last wire bend");
        } else {
          deleteSelection();
        }
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
          <p>
            {project.name} /{" "}
            <span data-testid="active-document-name">{document.name}</span>
          </p>
        </div>
        <nav className="toolbar" aria-label="Editor commands">
          <div className="document-nav" aria-label="Document navigation">
            <button
              type="button"
              onClick={returnToParentDocument}
              disabled={documentStack.length === 0}
            >
              Back
            </button>
            <button
              type="button"
              onClick={returnToTopDocument}
              disabled={document.id === project.topDocumentId}
            >
              Top
            </button>
            <select
              aria-label="Current Document"
              data-testid="document-selector"
              value={document.id}
              onChange={(event) => {
                setDocumentStack([]);
                switchDocument(event.currentTarget.value);
              }}
            >
              {project.documents.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                selectedInstance && enterHierarchy(selectedInstance.id)
              }
              disabled={
                !selectedInstance ||
                referencedDocumentId(project, selectedInstance) === null
              }
            >
              Enter
            </button>
          </div>
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
              <span>
                {structuralDiagnostics.length} structural,{" "}
                {visualObservations.length} observations
              </span>
            </div>
          </details>
          <details className="command-menu" name="editor-command-menu">
            <summary>Style</summary>
            <div className="command-popover">
              <button
                type="button"
                aria-pressed={
                  document.presentation.styleProfileId === "razavi-textbook-v1"
                }
                onClick={() => setPresentationStyle("razavi-textbook-v1")}
              >
                Razavi textbook
              </button>
              <button
                type="button"
                aria-pressed={
                  document.presentation.styleProfileId ===
                  "textbook-monochrome-v1"
                }
                onClick={() => setPresentationStyle("textbook-monochrome-v1")}
              >
                Monochrome compatibility
              </button>
              <small>Changes the active Document and can be undone.</small>
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
              <button type="button" onClick={addCurrentArrow}>
                Add current arrow
              </button>
              <span className="command-group-label">Markup</span>
              <button
                type="button"
                onClick={() => activateTool("construction-line")}
              >
                Construction line tool (drag)
              </button>
              <button type="button" onClick={() => activateTool("arrow")}>
                Arrow tool (drag)
              </button>
              <button type="button" onClick={addFloatingSymbol}>
                Add floating symbol
              </button>
              <span className="command-group-label">Guides</span>
              <button type="button" onClick={() => addGuide("vertical")}>
                Add vertical guide
              </button>
              <button type="button" onClick={() => addGuide("horizontal")}>
                Add horizontal guide
              </button>
              <button type="button" onClick={toggleGuidesVisible}>
                Show/hide guides
              </button>
              <button type="button" onClick={clearUnlockedGuides}>
                Clear unlocked guides
              </button>
              <button type="button" onClick={() => activateTool("guide")}>
                Guide tool (G)
              </button>
              <button type="button" onClick={loadRoutingDemo}>
                Open routing example
              </button>
              <button type="button" onClick={loadVisualDemo}>
                Open visual example
              </button>
              <small>
                Ctrl+C/V copy/paste · R rotate · W wire · G guide · F fit ·
                Ctrl+wheel zoom · middle-drag pan · wire click=bend ·
                Enter=finish
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
            onClick={() => {
              setSelectedIds([instance.id]);
              setSelectedRouteId(null);
              setSelectedAnnotationId(null);
              setStatus(`Selected ${instance.id}`);
            }}
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
        {unplacedPorts.length > 0 ? <h3>Unplaced Ports</h3> : null}
        {unplacedPorts.map((port) => (
          <button
            type="button"
            data-testid={`unplaced-port-${port.id}`}
            key={port.id}
            onClick={() => placePortAtViewCenter(port.id)}
          >
            Place {port.name}
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
            {defaultRazaviSymbolVariantId(selectedInstance.symbolId) ? (
              <fieldset className="mos-terminal-presentation">
                <legend>MOS terminal view</legend>
                <button
                  type="button"
                  aria-pressed={
                    selectedInstance.symbolVariantId === "textbook-3terminal"
                  }
                  onClick={() =>
                    setSelectedMosTerminalPresentation("three-terminal")
                  }
                >
                  Textbook 3-terminal
                </button>
                <button
                  type="button"
                  aria-pressed={selectedInstance.symbolVariantId === undefined}
                  onClick={() =>
                    setSelectedMosTerminalPresentation("four-terminal")
                  }
                >
                  Show Bulk (4-terminal)
                </button>
              </fieldset>
            ) : null}
          </section>
        ) : null}
        {selectedRouteId ? (
          <section className="context-actions" aria-label="Route actions">
            <h2>Route</h2>
            <p>Segment {(selectedRouteSegmentIndex ?? 0) + 1} selected</p>
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
            <button type="button" onClick={addCurrentArrow}>
              Add current arrow
            </button>
            <button type="button" onClick={removeSelectedRouteGeometry}>
              Remove route geometry
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
            {selectedPortId ? (
              <button
                type="button"
                onClick={() => placePortAtViewCenter(selectedPortId)}
              >
                Move port to view center
              </button>
            ) : null}
          </section>
        ) : null}
        {selectedEndpoint?.endpoint.kind === "junction" ? (
          <section className="context-actions" aria-label="Junction actions">
            <h2>Junction</h2>
            <button type="button" onClick={deleteSelectedJunction}>
              Delete junction and attached wires
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
          <dt>Current Document</dt>
          <dd data-testid="active-document-id">{document.id}</dd>
          <dt>Document instances</dt>
          <dd data-testid="active-instance-count">
            {document.instances.length}
          </dd>
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
          <dt>Structural diagnostics</dt>
          <dd data-testid="structural-diagnostic-count">
            {structuralDiagnostics.length}
          </dd>
          <dt>Visual observations</dt>
          <dd data-testid="visual-diagnostic-count">
            {visualObservations.length}
          </dd>
          <dt>Blocking diagnostics</dt>
          <dd data-testid="blocking-diagnostic-count">
            {
              visualDiagnostics.filter((diagnostic) =>
                hasBlockingVisualDiagnostics([diagnostic]),
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
        <section aria-label="Visual diagnostics" className="diagnostics">
          <h2>Diagnostics</h2>
          {visualDiagnostics.length === 0 ? <p>No visual diagnostics</p> : null}
          {structuralDiagnostics.length > 0 ? <h3>Structural issues</h3> : null}
          <ul data-testid="visual-diagnostics">
            {visualDiagnostics.map((diagnostic, index) => (
              <li
                key={`${diagnostic.code}-${diagnostic.objectIds.join("-")}-${index}`}
                data-severity={diagnostic.severity}
                data-category={diagnostic.category}
                data-confidence={diagnostic.confidence}
                hidden={diagnostic.category !== "structural"}
              >
                <button
                  type="button"
                  data-testid={`diagnostic-${index}`}
                  onClick={() => jumpToVisualDiagnostic(diagnostic)}
                >
                  <strong>{diagnostic.code}</strong>
                  {diagnostic.objectIds.length > 0
                    ? `: ${diagnostic.objectIds.join(", ")}`
                    : ""}
                </button>
              </li>
            ))}
          </ul>
          {visualObservations.length > 0 ? <h3>Visual observations</h3> : null}
          <ul data-testid="visual-observations">
            {visualDiagnostics.map((diagnostic, index) => (
              <li
                key={`observation-${diagnostic.code}-${diagnostic.objectIds.join("-")}-${index}`}
                data-severity={diagnostic.severity}
                data-category={diagnostic.category}
                data-confidence={diagnostic.confidence}
                hidden={diagnostic.category !== "observation"}
              >
                <button
                  type="button"
                  data-testid={`observation-${index}`}
                  onClick={() => jumpToVisualDiagnostic(diagnostic)}
                >
                  <strong>{diagnostic.code}</strong>
                  {diagnostic.objectIds.length > 0
                    ? `: ${diagnostic.objectIds.join(", ")}`
                    : ""}
                  {` (${diagnostic.confidence} confidence)`}
                </button>
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
          onClick={(event) => {
            const target = event.target as Element;
            if (
              tool !== "wire" ||
              event.detail !== 1 ||
              (target !== event.currentTarget && target.tagName !== "rect")
            )
              return;
            fixWirePoint(
              pointFromClient(
                event.clientX,
                event.clientY,
                event.currentTarget,
              ),
            );
          }}
          onDoubleClick={(event) => {
            const target = event.target as Element;
            if (
              tool !== "wire" ||
              (target !== event.currentTarget && target.tagName !== "rect")
            )
              return;
            const point = pointFromClient(
              event.clientX,
              event.clientY,
              event.currentTarget,
            );
            if (
              wireSource?.endpoint.kind === "junction" &&
              wireSource.preludeEdits.some(
                (edit) => edit.kind === "add_junction" && edit.createNet,
              ) &&
              wireSource.point.x === point.x &&
              wireSource.point.y === point.y
            ) {
              setStatus("Choose a different point to finish the wire");
              return;
            }
            finishWireAtPoint(point);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            if (wireSource) {
              setWireSource(null);
              setWirePreviewPoint(null);
              setWireWaypoints([]);
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
            {(document.drafting?.guides ?? [])
              .filter((guide) => guide.visible)
              .map((guide) => (
                <line
                  key={guide.id}
                  data-testid={`guide-${guide.id}`}
                  className={guide.locked ? "guide guide-locked" : "guide"}
                  x1={guide.axis === "vertical" ? guide.coordinate : viewBox.x}
                  y1={
                    guide.axis === "horizontal" ? guide.coordinate : viewBox.y
                  }
                  x2={
                    guide.axis === "vertical"
                      ? guide.coordinate
                      : viewBox.x + viewBox.width
                  }
                  y2={
                    guide.axis === "horizontal"
                      ? guide.coordinate
                      : viewBox.y + viewBox.height
                  }
                  onPointerDown={(event) => beginGuideDrag(event, guide)}
                  onDoubleClick={() => toggleGuideLock(guide.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Delete" || event.key === "Backspace") {
                      event.stopPropagation();
                      deleteGuide(guide.id);
                    }
                  }}
                  tabIndex={0}
                />
              ))}
            {routePolylines
              .filter(({ route }) => route.id === selectedRouteId)
              .map(({ route, polyline }) => {
                const segmentIndex = Math.min(
                  selectedRouteSegmentIndex ?? 0,
                  polyline.points.length - 2,
                );
                const from = polyline.points[segmentIndex]!;
                const to = polyline.points[segmentIndex + 1]!;
                const preview =
                  routeStretchPreview?.routeId === route.id
                    ? routeStretchPreview.point
                    : null;
                return (
                  <circle
                    key={`handle-${route.id}`}
                    data-testid={`route-handle-${route.id}`}
                    className="route-handle"
                    cx={
                      from.y === to.y
                        ? (from.x + to.x) / 2
                        : (preview?.x ?? (from.x + to.x) / 2)
                    }
                    cy={
                      from.x === to.x
                        ? (from.y + to.y) / 2
                        : (preview?.y ?? (from.y + to.y) / 2)
                    }
                    r="6"
                    onPointerDown={(event) =>
                      beginRouteStretch(event, route.id, segmentIndex)
                    }
                    onPointerMove={previewRouteStretch}
                    onPointerUp={finishRouteStretch}
                  />
                );
              })}
            {document.instances
              .filter((instance) => instance.placement !== null)
              .map((instance) => {
                const hitBox = instanceHitBox(instance);
                if (!hitBox) return null;
                return (
                  <rect
                    key={instance.id}
                    data-testid={`hit-${instance.id}`}
                    {...hitBox}
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
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      enterHierarchy(instance.id);
                    }}
                    onPointerDown={(event) => beginMove(event, instance.id)}
                    onPointerMove={previewMove}
                    onPointerUp={finishMove}
                  />
                );
              })}
            {visibleEndpoints.map((candidate) => (
              <circle
                key={`${candidate.netId}:${endpointTestId(candidate.endpoint)}`}
                data-testid={endpointTestId(candidate.endpoint)}
                className={
                  tool === "wire" ||
                  (selectedEndpoint?.endpoint.kind === "junction" &&
                    candidate.endpoint.kind === "junction" &&
                    selectedEndpoint.endpoint.junctionId ===
                      candidate.endpoint.junctionId)
                    ? "endpoint-hit active"
                    : "endpoint-hit"
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
                onPointerDown={(event) => {
                  if (
                    tool === "pointer" &&
                    candidate.endpoint.kind === "junction"
                  ) {
                    event.stopPropagation();
                    setSelectedEndpoint(candidate);
                    setSelectedRouteId(null);
                    setSelectedIds([]);
                    setSelectedAnnotationId(null);
                    setStatus(`Selected ${endpointTestId(candidate.endpoint)}`);
                    return;
                  }
                  handleWireEndpoint(event, candidate);
                }}
              />
            ))}
            {document.annotations.map((annotation) => {
              const anchor = annotationAnchor(annotation);
              const preview =
                annotationDragPreview?.annotationId === annotation.id
                  ? annotationDragPreview.position
                  : anchor;
              const hitBox = annotationHitBox(annotation, preview);
              return (
                <rect
                  key={`annotation-hit-${annotation.id}`}
                  data-testid={`annotation-hit-${annotation.id}`}
                  className={
                    selectedAnnotationId === annotation.id
                      ? "annotation-hit selected"
                      : "annotation-hit"
                  }
                  {...hitBox}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) =>
                    beginAnnotationDrag(event, annotation)
                  }
                  onPointerMove={previewAnnotationDrag}
                  onPointerUp={finishAnnotationDrag}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    beginAnnotationTextEditing(annotation);
                  }}
                />
              );
            })}
            {(document.drafting?.objects ?? []).map((object) => {
              // WP-R5/P1: every drafting object gets a selectable/deletable hit
              // shape derived from the shared geometry. P1: use the object's
              // actual shape (stroke polyline/line for lines and arrows) instead
              // of a full bounding rect, so large leader/callout boxes do not
              // block the canvas underneath.
              const geometry = resolveDraftingObjectGeometry(
                document,
                resolver,
                object,
              );
              const isText = object.kind === "text";
              const draggableText =
                isText && object.anchor.kind === "free" && !object.locked;
              const drag =
                draftingDragPreview?.objectId === object.id
                  ? draftingDragPreview
                  : null;
              const selected =
                selectedDraftingId === object.id
                  ? "annotation-hit selected"
                  : "annotation-hit";
              const onDown = (event: ReactPointerEvent<SVGElement>): void => {
                if (draggableText) {
                  beginDraftingDrag(
                    event,
                    object as Extract<DraftingObject, { kind: "text" }>,
                  );
                } else {
                  event.stopPropagation();
                  selectDraftingObject(object.id);
                }
              };
              if (object.kind === "construction-line") {
                const points = object.points
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ");
                return (
                  <polyline
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    className={selected}
                    points={points}
                    fill="none"
                    onPointerDown={onDown}
                  />
                );
              }
              if (object.kind === "arrow" && geometry.kind === "arrow") {
                return (
                  <line
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    className={selected}
                    x1={geometry.from.x}
                    y1={geometry.from.y}
                    x2={geometry.to.x}
                    y2={geometry.to.y}
                    onPointerDown={onDown}
                  />
                );
              }
              if (object.kind === "leader" && geometry.kind === "leader") {
                return (
                  <line
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    className={selected}
                    x1={geometry.anchor.x}
                    y1={geometry.anchor.y}
                    x2={geometry.target.x}
                    y2={geometry.target.y}
                    onPointerDown={onDown}
                  />
                );
              }
              if (object.kind === "callout" && geometry.kind === "callout") {
                return (
                  <g
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    onPointerDown={onDown}
                  >
                    <line
                      className={selected}
                      x1={geometry.textPosition.x}
                      y1={geometry.textPosition.y}
                      x2={geometry.target.x}
                      y2={geometry.target.y}
                    />
                    <rect className={selected} {...geometry.textBounds} />
                  </g>
                );
              }
              const hitBounds = drag
                ? {
                    ...geometry.bounds,
                    x:
                      geometry.bounds.x +
                      (drag.position.x - drag.originalPosition.x),
                    y:
                      geometry.bounds.y +
                      (drag.position.y - drag.originalPosition.y),
                  }
                : geometry.bounds;
              return (
                <rect
                  key={`drafting-hit-${object.id}`}
                  data-testid={`drafting-hit-${object.id}`}
                  className={selected}
                  {...hitBounds}
                  onPointerDown={onDown}
                  onDoubleClick={(event) => {
                    if (object.kind !== "text") return;
                    event.stopPropagation();
                    beginDraftingTextEditing(object);
                  }}
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
            {draftingCreatePreview ? (
              <line
                data-testid="drafting-create-preview"
                className="drafting-create-preview"
                x1={draftingCreatePreview.start.x}
                y1={draftingCreatePreview.start.y}
                x2={draftingCreatePreview.end.x}
                y2={draftingCreatePreview.end.y}
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
            {textEditing && textEditingBounds ? (
              <foreignObject
                data-testid="canvas-text-editor"
                x={textEditingBounds.x - 6}
                y={textEditingBounds.y - 58}
                width={Math.max(300, textEditingBounds.width + 12)}
                height={Math.max(110, textEditingBounds.height + 68)}
              >
                <RichTextEditor
                  targetKey={`${textEditing.owner}:${textEditing.id}`}
                  content={textEditing.content}
                  disabled={textEditingLocked}
                  sizeScale={textEditing.sizeScale}
                  onChange={(content) => updateTextEditing({ content })}
                  onSizeChange={(sizeScale) => updateTextEditing({ sizeScale })}
                  onCommit={commitTextEditing}
                  onCancel={() => setTextEditing(null)}
                  onDelete={deleteTextEditing}
                  {...(editingAnnotation &&
                  isRoutedMarker(editingAnnotation) &&
                  effectiveRouteAttachment(editingAnnotation)
                    ? { onReverseCurrentArrow: reverseSelectedCurrentArrow }
                    : {})}
                />
              </foreignObject>
            ) : null}
          </g>
        </svg>
      </section>
    </main>
  );
}
