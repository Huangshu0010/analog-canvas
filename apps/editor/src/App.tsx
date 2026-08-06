import { useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";

import { DocumentHistory } from "@icm/edit-engine";
import type { EditTransactionResult, SchematicEdit } from "@icm/edit-engine";
import {
  deriveCrossings,
  deriveFlightlines,
  netEndpoints,
  proposeLocalStretch,
  resolveEndpointPoint,
  routePolyline,
} from "@icm/derived";
import {
  CircuitProjectSchema,
  parseProject,
  serializeProject,
} from "@icm/model";
import type {
  CircuitProject,
  Point,
  Rect,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import { buildSvgScene, renderDocumentSvg } from "@icm/render-svg";
import { importSpiceSources } from "@icm/spice";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";

import { createDemoProject } from "./demo-project";
import { createRoutingDemoProject } from "./routing-demo";

const SNAPSHOT_KEY = "icm.phase1.snapshot";
const DEFAULT_VIEWBOX: Rect = { x: 0, y: 0, width: 960, height: 640 };

interface DragPreview {
  instanceId: string;
  originalPosition: Point;
  position: Point;
  pointerId: number;
}

type EditorTool = "select" | "wire" | "junction";

interface WireSource {
  endpoint: RouteEndpoint;
  netId: string;
  point: Point;
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

export function App({ project: initialProject }: AppProps) {
  const resolver = useMemo(
    () => new InMemorySymbolResolver(builtInSymbols),
    [],
  );
  const [project, setProject] = useState(() =>
    CircuitProjectSchema.parse(
      structuredClone(initialProject ?? createDemoProject()),
    ),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState<Rect>(DEFAULT_VIEWBOX);
  const [status, setStatus] = useState("Ready");
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [wireSource, setWireSource] = useState<WireSource | null>(null);
  const [wirePreviewPoint, setWirePreviewPoint] = useState<Point | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const transactionCounter = useRef(0);
  const routeCounter = useRef(0);
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
  const selected = document.instances.find(
    (instance) => instance.id === selectedId,
  );
  const flightlines = deriveFlightlines(document, resolver);
  const crossings = deriveCrossings(document, resolver);
  const visibleEndpoints = document.nets.flatMap((net) =>
    netEndpoints(document, net)
      .map((endpoint) => ({
        endpoint,
        netId: net.id,
        point: resolveEndpointPoint(document, resolver, endpoint),
      }))
      .filter(
        (
          candidate,
        ): candidate is {
          endpoint: RouteEndpoint;
          netId: string;
          point: Point;
        } => candidate.point !== null,
      ),
  );
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

  function applyResult(result: EditTransactionResult): void {
    if (!result.ok) {
      setStatus(`${result.error.code}: ${result.error.message}`);
      return;
    }
    if (result.applied) {
      setProject((current) => replaceDocument(current, result.document));
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
    if (nextTool !== "select") setSelectedRouteId(null);
    setStatus(
      nextTool === "wire"
        ? "Wire: choose a source endpoint"
        : nextTool === "junction"
          ? "Junction: choose a route segment"
          : "Select tool",
    );
  }

  function loadRoutingDemo(): void {
    const demo = createRoutingDemoProject();
    const demoDocument = demo.documents[0]!;
    history.current.reset(demoDocument);
    setProject(demo);
    setSelectedId(null);
    setSelectedRouteId(null);
    setDragPreview(null);
    setWireSource(null);
    setWirePreviewPoint(null);
    setTool("select");
    setViewBox(DEFAULT_VIEWBOX);
    setStatus("Loaded Phase 3 routing demo");
  }

  function handleWireEndpoint(
    event: ReactPointerEvent<SVGCircleElement>,
    candidate: WireSource,
  ): void {
    event.stopPropagation();
    if (tool !== "wire") {
      if (candidate.endpoint.kind === "terminal") {
        setSelectedId(candidate.endpoint.instanceId);
      }
      return;
    }
    if (!wireSource) {
      setWireSource(candidate);
      setWirePreviewPoint(candidate.point);
      setStatus(`Wire source: ${endpointTestId(candidate.endpoint)}`);
      return;
    }
    if (wireSource.netId !== candidate.netId) {
      setStatus("Wire endpoints must belong to the same logical Net");
      return;
    }
    if (
      endpointTestId(wireSource.endpoint) === endpointTestId(candidate.endpoint)
    ) {
      setStatus("Choose a different endpoint");
      return;
    }
    routeCounter.current += 1;
    const diagonal =
      wireSource.point.x !== candidate.point.x &&
      wireSource.point.y !== candidate.point.y;
    const waypoints = diagonal
      ? [{ x: candidate.point.x, y: wireSource.point.y }]
      : [];
    const result = transact([
      {
        kind: "set_route_points",
        routeId: `route-ui-${routeCounter.current}`,
        netId: candidate.netId,
        from: wireSource.endpoint,
        to: candidate.endpoint,
        waypoints,
        segmentModes: Array.from(
          { length: waypoints.length + 1 },
          () => "manual" as const,
        ),
      },
    ]);
    if (result.ok) {
      setWireSource(null);
      setWirePreviewPoint(null);
      setStatus(`Committed route at revision ${result.revision}`);
    }
  }

  function handleRoutePointerDown(
    event: ReactPointerEvent<SVGPolylineElement>,
    routeId: string,
  ): void {
    event.stopPropagation();
    const routeRecord = routePolylines.find(
      (candidate) => candidate.route.id === routeId,
    );
    if (!routeRecord) return;
    if (tool === "select") {
      setSelectedRouteId(routeId);
      setSelectedId(null);
      setStatus(`Selected route ${routeId}`);
      return;
    }
    if (tool !== "junction") return;
    const point = pointFromClient(
      event.clientX,
      event.clientY,
      event.currentTarget.ownerSVGElement!,
    );
    const segmentIndex = segmentAtPoint(routeRecord.polyline.points, point);
    if (segmentIndex === null) {
      setStatus("Junction must be inside a route segment");
      return;
    }
    routeCounter.current += 1;
    const suffix = routeCounter.current;
    const result = transact([
      {
        kind: "add_junction",
        junctionId: `junction-ui-${suffix}`,
        netId: routeRecord.route.netId,
        position: point,
        split: {
          routeId,
          firstRouteId: `${routeId}-a-${suffix}`,
          secondRouteId: `${routeId}-b-${suffix}`,
          segmentIndex,
        },
      },
    ]);
    if (result.ok) {
      setTool("select");
      setStatus(`Committed junction at revision ${result.revision}`);
    }
  }

  function detachSelectedRoute(): void {
    if (!selectedRouteId) return;
    const result = transact([
      { kind: "make_flightline", routeId: selectedRouteId },
    ]);
    if (result.ok) {
      setSelectedRouteId(null);
      setStatus(`Detached route at revision ${result.revision}`);
    }
  }

  function stretchSelectedRoute(): void {
    const selectedRoute = routePolylines.find(
      (candidate) => candidate.route.id === selectedRouteId,
    );
    if (!selectedRoute) return;
    const points = selectedRoute.polyline.points;
    if (points.length !== 2) {
      setStatus("Phase 3 demo Stretch targets a direct branch");
      return;
    }
    const [from, to] = points as [Point, Point];
    let waypoints: Point[];
    if (from.y === to.y) {
      const middle = snap((from.x + to.x) / 2, document.presentation.grid);
      waypoints = [
        { x: middle, y: from.y },
        { x: middle, y: from.y + 40 },
        { x: to.x, y: from.y + 40 },
      ];
    } else {
      const middle = snap((from.y + to.y) / 2, document.presentation.grid);
      waypoints = [
        { x: from.x, y: middle },
        { x: from.x + 40, y: middle },
        { x: from.x + 40, y: to.y },
      ];
    }
    const result = transact([
      {
        kind: "set_route_points",
        routeId: selectedRoute.route.id,
        netId: selectedRoute.route.netId,
        from: selectedRoute.route.from,
        to: selectedRoute.route.to,
        waypoints,
        segmentModes: ["manual", "manual", "manual", "manual"],
      },
    ]);
    if (result.ok) setStatus(`Stretched route at revision ${result.revision}`);
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
    setSelectedId(instanceId);
  }

  function beginMove(
    event: ReactPointerEvent<SVGCircleElement>,
    instanceId: string,
  ): void {
    if (tool !== "select") return;
    event.stopPropagation();
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    if (!instance?.placement) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(instanceId);
    setDragPreview({
      instanceId,
      originalPosition: instance.placement.position,
      pointerId: event.pointerId,
      position: pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget.ownerSVGElement!,
      ),
    });
  }

  function previewMove(event: ReactPointerEvent<SVGCircleElement>): void {
    if (!dragPreview || dragPreview.pointerId !== event.pointerId) {
      return;
    }
    setDragPreview({
      ...dragPreview,
      position: pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget.ownerSVGElement!,
      ),
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
    if (
      position.x !== dragPreview.originalPosition.x ||
      position.y !== dragPreview.originalPosition.y
    ) {
      try {
        const stretchEdits: SchematicEdit[] = proposeLocalStretch(
          document,
          resolver,
          dragPreview.instanceId,
          position,
        ).map((proposal) => {
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
        });
        transact([
          {
            kind: "move_instance",
            instanceId: dragPreview.instanceId,
            position,
          },
          ...stretchEdits,
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
    if (!selected?.placement) {
      return;
    }
    const rotation = ((selected.placement.rotation + 90) % 360) as
      0 | 90 | 180 | 270;
    transact([{ kind: "rotate_instance", instanceId: selected.id, rotation }]);
  }

  function mirrorSelected(): void {
    if (!selected?.placement) {
      return;
    }
    transact([
      {
        kind: "mirror_instance",
        instanceId: selected.id,
        mirror: selected.placement.mirror === "none" ? "x" : "none",
      },
    ]);
  }

  function saveSnapshot(): void {
    localStorage.setItem(SNAPSHOT_KEY, serializeProject(project));
    setStatus(`Saved revision ${document.revision}`);
  }

  function reopenSnapshot(): void {
    const snapshot = localStorage.getItem(SNAPSHOT_KEY);
    if (!snapshot) {
      setStatus("No saved snapshot");
      return;
    }
    try {
      const reopened = parseProject(snapshot);
      const reopenedDocument = reopened.documents.find(
        (candidate) => candidate.id === reopened.topDocumentId,
      )!;
      history.current.reset(reopenedDocument);
      setProject(reopened);
      setSelectedId(null);
      setDragPreview(null);
      setStatus(`Reopened revision ${reopenedDocument.revision}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reopen failed");
    }
  }

  function exportSvg(): void {
    const svg = renderDocumentSvg(document, resolver, { title: project.name });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase()}.svg`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(`Exported revision ${document.revision}`);
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
    const entryCandidates = sourceInputs.filter(
      (input) => input.path.split("/").at(-1)?.toLowerCase() === "circuit.spi",
    );
    if (entryCandidates.length !== 1) {
      setStatus(
        `Select one circuit.spi entry and its local include files; found ${entryCandidates.length}`,
      );
      return;
    }
    setStatus("Importing SPICE sources");
    try {
      const result = await importSpiceSources(
        sourceInputs,
        entryCandidates[0]!.path,
      );
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
      setSelectedId(null);
      setDragPreview(null);
      setViewBox(DEFAULT_VIEWBOX);
      setStatus(
        `Imported ${result.project.documents.length} Documents and ${instanceCount} instances; ${genericCount} generic symbols`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "SPICE import failed");
    }
  }

  function zoom(factor: number): void {
    setViewBox((current) => {
      const width = Math.round(current.width * factor);
      const height = Math.round(current.height * factor);
      return {
        x: current.x + Math.round((current.width - width) / 2),
        y: current.y + Math.round((current.height - height) / 2),
        width,
        height,
      };
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Interactive Circuit Maker</h1>
          <p>{project.name}</p>
        </div>
        <div className="toolbar" aria-label="Edit toolbar">
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
            onClick={rotateSelected}
            disabled={!selected?.placement}
          >
            Rotate
          </button>
          <button
            type="button"
            onClick={mirrorSelected}
            disabled={!selected?.placement}
          >
            Mirror
          </button>
          <button
            type="button"
            aria-pressed={tool === "select"}
            onClick={() => activateTool("select")}
          >
            Select
          </button>
          <button
            type="button"
            aria-pressed={tool === "wire"}
            onClick={() => activateTool("wire")}
          >
            Wire
          </button>
          <button
            type="button"
            aria-pressed={tool === "junction"}
            onClick={() => activateTool("junction")}
          >
            Junction
          </button>
          <button
            type="button"
            onClick={stretchSelectedRoute}
            disabled={!selectedRouteId}
          >
            Stretch
          </button>
          <button
            type="button"
            onClick={detachSelectedRoute}
            disabled={!selectedRouteId}
          >
            Detach
          </button>
          <button type="button" onClick={loadRoutingDemo}>
            Routing demo
          </button>
          <button type="button" onClick={saveSnapshot}>
            Save snapshot
          </button>
          <button type="button" onClick={reopenSnapshot}>
            Reopen snapshot
          </button>
          <button type="button" onClick={exportSvg}>
            Export SVG
          </button>
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
        </div>
      </header>
      <aside className="side-panel" aria-label="Unplaced instances">
        <h2>Unplaced Instances</h2>
        {unplaced.length === 0 ? <p>All instances placed</p> : null}
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
        <dl className="inspector">
          <dt>Selected</dt>
          <dd>{selectedId ?? "None"}</dd>
          <dt>Revision</dt>
          <dd data-testid="revision">{document.revision}</dd>
          <dt>Documents</dt>
          <dd data-testid="document-count">{project.documents.length}</dd>
          <dt>Instances</dt>
          <dd data-testid="instance-count">{projectInstanceCount}</dd>
          <dt>Tool</dt>
          <dd data-testid="active-tool">{tool}</dd>
          <dt>Flightlines</dt>
          <dd data-testid="flightline-count">{flightlines.length}</dd>
          <dt>Crossings</dt>
          <dd data-testid="crossing-count">{crossings.length}</dd>
          <dt>Status</dt>
          <dd data-testid="status">{status}</dd>
        </dl>
      </aside>
      <section className="canvas-panel">
        <div className="viewport-toolbar" aria-label="Viewport toolbar">
          <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom in">
            +
          </button>
          <button
            type="button"
            onClick={() => zoom(1.25)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() =>
              setViewBox((current) => ({ ...current, x: current.x - 50 }))
            }
          >
            Pan left
          </button>
          <button type="button" onClick={() => setViewBox(DEFAULT_VIEWBOX)}>
            Fit
          </button>
        </div>
        <svg
          className="schematic-canvas"
          data-testid="schematic-canvas"
          role="img"
          aria-label="Schematic canvas"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          onClick={() => {
            setSelectedId(null);
            setSelectedRouteId(null);
          }}
          onPointerMove={(event) => {
            if (tool === "wire" && wireSource) {
              setWirePreviewPoint(
                pointFromClient(
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                ),
              );
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
                  selectedRouteId === route.id
                    ? "route-hit selected"
                    : "route-hit"
                }
                points={polylinePoints(polyline.points)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (tool === "select") {
                    setSelectedRouteId(route.id);
                    setSelectedId(null);
                    setStatus(`Selected route ${route.id}`);
                  }
                }}
                onPointerDown={(event) =>
                  handleRoutePointerDown(event, route.id)
                }
              />
            ))}
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
                    selectedId === instance.id
                      ? "hit-target selected"
                      : "hit-target"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(instance.id);
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
                onPointerDown={(event) => handleWireEndpoint(event, candidate)}
              />
            ))}
            {dragPreview ? (
              <circle
                className="drag-preview"
                cx={dragPreview.position.x}
                cy={dragPreview.position.y}
                r="34"
              />
            ) : null}
          </g>
        </svg>
      </section>
    </main>
  );
}
