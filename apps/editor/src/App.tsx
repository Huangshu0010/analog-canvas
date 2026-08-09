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
  measureRichTextDocument,
  isVisibleEndpoint,
  moveRouteSegment,
  proposeGroupMove,
  richTextMetrics,
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
  VisualAnchor,
} from "@icm/model";
import {
  buildSvgScene,
  renderSymbolDefinitionBody,
  resolveSchematicStyleProfile,
  schematicTextDocument,
  schematicTextFontSize,
} from "@icm/render-svg";
import type { SchematicStyleProfile } from "@icm/render-svg";
import { importSpiceSources } from "@icm/spice";
import type { SpiceDiagnostic } from "@icm/spice";
import {
  builtInSymbols,
  createProjectSymbolResolver,
  razaviReferencePaletteSymbols,
} from "@icm/symbols";
import type { SymbolDefinition } from "@icm/symbols";

import { copySelection, proposePaste } from "./clipboard";
import type { SchematicClipboard } from "./clipboard";
import {
  explicitAnnotationRemovals,
  proposeConnectedInstanceDeletion,
} from "./delete-selection";
import { createRoutingDemoProject } from "./routing-demo";
import { createVisualDemoProject } from "./visual-demo";
import {
  clearVisualSelectionKinds,
  EMPTY_VISUAL_SELECTION,
  hasVisualSelection,
  normalizeVisualSelection,
  replaceVisualSelectionKind,
} from "./visual-selection";
import type { VisualSelection, VisualSelectionKind } from "./visual-selection";
import { createRecoveryScheduler } from "./recovery-scheduler";
import type { RecoveryScheduler } from "./recovery-scheduler";
import { RichTextEditor } from "./rich-text-editor";

const RECOVERY_KEY = "icm.recovery.v1";
// Coalesce bursts of edits into one recovery write so a large schematic does
// not serialize and block on every transaction. Not a product contract; tuned
// only if real measurement shows it is too coarse. See recovery-scheduler.ts.
const RECOVERY_DELAY_MS = 400;
const DEFAULT_VIEWBOX: Rect = { x: 0, y: 0, width: 960, height: 640 };
const DIRECT_PIN_SNAP_RADIUS = 4;
// Drafting creation snap radius (logical units). Slightly more generous than
// pin-snap so an arrow/construction-line endpoint finds a nearby pin/port/
// junction without requiring pixel-perfect aiming.
const DRAFTING_SNAP_RADIUS = 8;

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

type SupplementalSelection = Omit<VisualSelection, "instanceIds">;

const EMPTY_SUPPLEMENTAL_SELECTION: SupplementalSelection = {
  routeIds: [],
  junctionIds: [],
  annotationIds: [],
  draftingIds: [],
};

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
  const stableChildDocumentId = instance.properties["spice.childDocumentId"];
  if (
    typeof stableChildDocumentId === "string" &&
    project.documents.some(
      (candidate) => candidate.id === stableChildDocumentId,
    )
  ) {
    return stableChildDocumentId;
  }

  // Projects saved before imported hierarchy links were stabilized retain the
  // original SPICE target string. Keep this compatibility path read-only; new
  // imports always write spice.childDocumentId.
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

function dismissOpenCommandMenus(): boolean {
  const openMenus = Array.from(
    globalThis.document.querySelectorAll<HTMLDetailsElement>(
      ".command-menu[open]",
    ),
  );
  for (const menu of openMenus) menu.open = false;
  return openMenus.length > 0;
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

interface RouteTap {
  segmentIndex: number;
  point: Point;
  distanceSquared: number;
}

/**
 * Resolve a pointer position to the nearest point on an orthogonal route.
 *
 * SVG gives the route a wide transparent hit stroke in screen pixels. The old
 * code threw that tolerance away by demanding exact logical-coordinate
 * equality after grid snapping, so a click that visibly hit a wire often could
 * not make a junction. Keep the hit and topology layers consistent: project
 * to the segment, retain the closest in-tolerance candidate, and use that
 * exact projected point for a subsequent route split.
 */
function resolveRouteTap(
  points: readonly Point[],
  pointer: Point,
  tolerance: number,
): RouteTap | null {
  // A geometric bend is a virtual snap target. Prefer it before projecting
  // onto either of its two segments, otherwise an off-axis click near a corner
  // becomes a point beside the bend and yields a visibly skewed branch.
  let nearestVertex: RouteTap | null = null;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const dx = pointer.x - point.x;
    const dy = pointer.y - point.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > tolerance * tolerance) continue;
    if (
      !nearestVertex ||
      distanceSquared < nearestVertex.distanceSquared ||
      (distanceSquared === nearestVertex.distanceSquared &&
        index - 1 < nearestVertex.segmentIndex)
    ) {
      nearestVertex = {
        segmentIndex: index - 1,
        point: { ...point },
        distanceSquared,
      };
    }
  }
  if (nearestVertex) return nearestVertex;

  let best: RouteTap | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]!;
    const to = points[index + 1]!;
    if (from.x !== to.x && from.y !== to.y) continue;
    const point =
      from.x === to.x
        ? {
            x: from.x,
            y: Math.max(
              Math.min(pointer.y, Math.max(from.y, to.y)),
              Math.min(from.y, to.y),
            ),
          }
        : {
            x: Math.max(
              Math.min(pointer.x, Math.max(from.x, to.x)),
              Math.min(from.x, to.x),
            ),
            y: from.y,
          };
    const dx = pointer.x - point.x;
    const dy = pointer.y - point.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > tolerance * tolerance) continue;
    if (
      !best ||
      distanceSquared < best.distanceSquared ||
      (distanceSquared === best.distanceSquared && index < best.segmentIndex)
    ) {
      best = { segmentIndex: index, point, distanceSquared };
    }
  }
  return best;
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

function rectsIntersect(left: Rect, right: Rect): boolean {
  return (
    left.x <= right.x + right.width &&
    left.x + left.width >= right.x &&
    left.y <= right.y + right.height &&
    left.y + left.height >= right.y
  );
}

function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function polylineBounds(points: readonly Point[]): Rect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
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

export function razaviHiddenBulkRisk(
  document: SchematicDocument,
  instanceId: string,
): SchematicDocument["nets"][number] | undefined {
  const bulkNet = document.nets.find((net) =>
    net.terminals.some(
      (terminal) =>
        terminal.instanceId === instanceId && terminal.pinName === "B",
    ),
  );
  if (!bulkNet) return undefined;
  const isImplicitSupply = [bulkNet.name, bulkNet.id]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase().replaceAll(/[^a-z0-9]/gu, ""))
    .some((name) => RAZAVI_IMPLICIT_BULK_NET_NAMES.has(name));
  return isImplicitSupply ? undefined : bulkNet;
}

/**
 * Razavi presentation is fixed to the three-terminal visual variant. The B
 * terminal stays in electrical/SPICE data; non-supply B connections are
 * surfaced to the user as hidden-bulk risks instead of changing the artwork.
 */
export function razaviMosPresentationEdits(
  document: SchematicDocument,
): SchematicEdit[] {
  return document.instances.flatMap((instance) => {
    const symbolVariantId = defaultRazaviSymbolVariantId(instance.symbolId);
    if (!symbolVariantId || instance.symbolVariantId === symbolVariantId) {
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

// Rotate a free drafting anchor 90°/−90° about a pivot. Non-free anchors (route
// or object-attached) are returned unchanged: their position is derived from
// the thing they attach to, so a free-rotation must not detach them. Only free
// arrows/leaders created by the editor tools are freely rotatable this way.
function rotateFreePoint(
  anchor: Extract<VisualAnchor, { kind: "free" }>,
  pivot: Point,
  deltaDegrees: 90 | -90,
): Extract<VisualAnchor, { kind: "free" }> {
  const cos = deltaDegrees === 90 ? 0 : 0; // cos(±90°) = 0
  const sin = deltaDegrees === 90 ? 1 : -1; // sin(90°)=1, sin(-90°)=-1
  const dx = anchor.position.x - pivot.x;
  const dy = anchor.position.y - pivot.y;
  return {
    ...anchor,
    position: {
      x: Math.round(pivot.x + dx * cos - dy * sin),
      y: Math.round(pivot.y + dx * sin + dy * cos),
    },
  };
}

function centerOfBounds(bounds: Rect): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

// Step a bounded scale value to the next allowed entry (up or down). Used by the
// [/] and Shift+[/] shortcuts for stroke width and arrow-head size.
function stepScale<T extends number>(
  current: T,
  steps: readonly T[],
  increase: boolean,
): T {
  const index = steps.indexOf(current);
  const next = increase ? index + 1 : index - 1;
  const clamped = Math.max(0, Math.min(steps.length - 1, next < 0 ? 0 : next));
  return steps[clamped]!;
}

// Two-phase drafting creation preview (editor overlay only, never exported).
// Renders the start anchor, the accumulated path, the live hover end, an arrow
// head preview for arrows, a snap marker, and a length/angle readout. Mirrors
// the wire tool's snap-preview affordance.
interface DraftingCreatePreviewProps {
  tool: EditorTool;
  start: Point;
  waypoints: Point[];
  hover: Point;
  snap: Point | null;
  styleProfile: SchematicStyleProfile;
}

function DraftingCreatePreview({
  tool,
  start,
  waypoints,
  hover,
  snap,
  styleProfile,
}: DraftingCreatePreviewProps) {
  const path = [start, ...waypoints, hover];
  const dx = hover.x - start.x;
  const dy = hover.y - start.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const showHead = tool === "arrow" && length > 1;
  const head = styleProfile.annotations.arrowHeadLength;
  const halfHeadWidth = styleProfile.annotations.arrowHeadWidth / 2;
  const nx = length === 0 ? 0 : (-dy / length) * halfHeadWidth;
  const ny = length === 0 ? 0 : (dx / length) * halfHeadWidth;
  const baseX = length === 0 ? hover.x : hover.x - (dx / length) * head;
  const baseY = length === 0 ? hover.y : hover.y - (dy / length) * head;
  const labelX = start.x + dx / 2;
  const labelY = start.y + dy / 2 - 8;
  return (
    <g data-testid="drafting-create-preview" pointerEvents="none">
      <polyline
        className="drafting-create-preview"
        points={polylinePoints(path)}
        fill="none"
      />
      {/* start anchor (filled) */}
      <circle
        className="drafting-create-anchor"
        cx={start.x}
        cy={start.y}
        r="3"
      />
      {/* hover end (hollow) */}
      <circle
        className="drafting-create-anchor draft-create-anchor-end"
        cx={hover.x}
        cy={hover.y}
        r="3"
      />
      {/* accumulated vertices */}
      {waypoints.map((point, index) => (
        <circle
          key={`draft-preview-vx-${index}`}
          className="drafting-create-anchor draft-create-anchor-vx"
          cx={point.x}
          cy={point.y}
          r="2.5"
        />
      ))}
      {showHead ? (
        <polygon
          className="drafting-create-head"
          points={`${hover.x},${hover.y} ${baseX + nx},${baseY + ny} ${baseX - nx},${baseY - ny}`}
        />
      ) : null}
      {snap ? (
        <circle
          className="drafting-create-snap"
          cx={snap.x}
          cy={snap.y}
          r="6"
        />
      ) : null}
      <text
        className="drafting-create-readout"
        x={labelX}
        y={labelY}
        textAnchor="middle"
      >
        {Math.round(length)} · {Math.round(angle)}°
      </text>
    </g>
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
  const [visualSelection, setVisualSelection] = useState<VisualSelection>(
    EMPTY_VISUAL_SELECTION,
  );
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
  // Two-phase drafting creation state (mirrors the wire tool's
  // wireSource / wirePreviewPoint / wireWaypoints model). The first click fixes
  // the start (and a snap candidate), hover updates the preview, the next click
  // commits one upsert_drafting_object transaction. Construction lines append a
  // vertex per click; arrows commit on the second click. See commitDraftingCreate.
  const [draftingSource, setDraftingSource] = useState<Point | null>(null);
  const [draftingHover, setDraftingHover] = useState<Point | null>(null);
  const [draftingWaypoints, setDraftingWaypoints] = useState<Point[]>([]);
  const [draftingSnapPoint, setDraftingSnapPoint] = useState<Point | null>(
    null,
  );
  const [tool, setTool] = useState<EditorTool>("pointer");
  const [wireSource, setWireSource] = useState<WireSource | null>(null);
  const [wirePreviewPoint, setWirePreviewPoint] = useState<Point | null>(null);
  const [wireWaypoints, setWireWaypoints] = useState<Point[]>([]);
  const [selectedRouteSegmentIndex, setSelectedRouteSegmentIndex] = useState<
    number | null
  >(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WireSource | null>(
    null,
  );
  const [netLabelDraft, setNetLabelDraft] = useState("");
  const [textEditing, setTextEditing] = useState<TextEditingSession | null>(
    null,
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [pendingSymbolId, setPendingSymbolId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
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
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
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
  // Coalesces recovery writes. Created once; `stageRecovery` schedules, the
  // pagehide/visibilitychange effect flushes, and whole-project replacements
  // cancel so a stale pending write for an old project cannot revive.
  const [recoveryScheduler] = useState<RecoveryScheduler>(() =>
    createRecoveryScheduler({
      delayMs: RECOVERY_DELAY_MS,
      write: (project) =>
        localStorage.setItem(
          RECOVERY_KEY,
          serializeProject(project as CircuitProject),
        ),
    }),
  );
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
  const selectedIds = visualSelection.instanceIds;
  const supplementalSelection: SupplementalSelection = {
    routeIds: visualSelection.routeIds,
    junctionIds: visualSelection.junctionIds,
    annotationIds: visualSelection.annotationIds,
    draftingIds: visualSelection.draftingIds,
  };
  const selectedRouteId = visualSelection.routeIds.at(-1) ?? null;
  const selectedAnnotationId = visualSelection.annotationIds.at(-1) ?? null;
  const selectedDraftingId = visualSelection.draftingIds.at(-1) ?? null;
  const selectedId = selectedIds.at(-1) ?? null;
  const selectedInstance =
    selectedIds.length === 1
      ? document.instances.find((instance) => instance.id === selectedId)
      : undefined;
  const hasImportedHierarchy = useMemo(
    () =>
      project.documents.some((candidate) =>
        candidate.instances.some(
          (instance) => referencedDocumentId(project, instance) !== null,
        ),
      ),
    [project],
  );
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
  const hasInspectableSelection = Boolean(
    selectedInstance ||
    selectedRoute ||
    selectedAnnotation ||
    selectedDrafting ||
    selectedEndpoint,
  );
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

  function directPinSnap(
    moves: readonly { instanceId: string; position: Point }[],
  ):
    | {
        moves: { instanceId: string; position: Point }[];
        from: WireSource;
        to: WireSource;
      }
    | undefined {
    const moveById = new Map(moves.map((move) => [move.instanceId, move]));
    const movingEndpoints = document.instances.flatMap((instance) => {
      const move = moveById.get(instance.id);
      if (!move || !instance.placement) return [];
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) return [];
      const placement = { ...instance.placement, position: move.position };
      return resolved.definition.pins
        .filter((pin) =>
          isVisibleEndpoint(document, resolver, {
            kind: "terminal",
            instanceId: instance.id,
            pinName: pin.name,
          }),
        )
        .map((pin): WireSource => ({
          endpoint: {
            kind: "terminal",
            instanceId: instance.id,
            pinName: pin.name,
          },
          netId: endpointNetId(document, {
            kind: "terminal",
            instanceId: instance.id,
            pinName: pin.name,
          }),
          point: transformPoint(pin.at, move.position, placement),
          preferredAxis: transformedPinAxis(pin.direction, placement.rotation),
          preludeEdits: [],
        }));
    });
    const targets = visibleEndpoints.filter(
      (candidate) =>
        candidate.endpoint.kind !== "terminal" ||
        !moveById.has(candidate.endpoint.instanceId),
    );
    const candidates = movingEndpoints.flatMap((from) =>
      targets.flatMap((to) => {
        if (
          (from.netId && to.netId && from.netId !== to.netId) ||
          endpointKey(from.endpoint) === endpointKey(to.endpoint)
        ) {
          return [];
        }
        const distanceSquared =
          (from.point.x - to.point.x) ** 2 + (from.point.y - to.point.y) ** 2;
        return distanceSquared <= DIRECT_PIN_SNAP_RADIUS ** 2
          ? [{ from, to, distanceSquared }]
          : [];
      }),
    );
    const closest = candidates.sort(
      (left, right) => left.distanceSquared - right.distanceSquared,
    )[0];
    if (!closest) return undefined;
    const delta = {
      x: closest.to.point.x - closest.from.point.x,
      y: closest.to.point.y - closest.from.point.y,
    };
    return {
      moves: moves.map((move) => ({
        ...move,
        position: {
          x: move.position.x + delta.x,
          y: move.position.y + delta.y,
        },
      })),
      from: closest.from,
      to: closest.to,
    };
  }
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
    const textLayout = measureRichTextDocument(
      annotation.content ??
        schematicTextDocument(annotation.text, annotation.kind),
      richTextMetrics(styleProfile, "label", sizeScale),
    );
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

    // This matches the RichText composition used by the formal renderer, so a
    // Razavi subscript is selectable where it is painted instead of by an
    // inaccurate character-count estimate.
    const width = Math.max(fontSize * 0.6, textLayout.width);
    const height = Math.max(fontSize * 1.35, textLayout.height);
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
  const selectedHiddenBulkNet = selectedInstance
    ? razaviHiddenBulkRisk(document, selectedInstance.id)
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

  function defaultInstanceLabel(
    instance: SchematicDocument["instances"][number],
  ): Annotation | null {
    if (!instance.placement) return null;
    if (
      document.annotations.some(
        (annotation) =>
          annotation.kind === "instance-label" &&
          annotation.attachedObjectId === instance.id,
      )
    ) {
      return null;
    }
    const resolved = resolver.resolve(
      instance.symbolId,
      instance.symbolVariantId,
    );
    if (!resolved || resolved.definition.labelVisibility === "hidden") {
      return null;
    }
    const viewBox = resolved.definition.viewBox;
    const corners = [
      { x: viewBox.x, y: viewBox.y },
      { x: viewBox.x + viewBox.width, y: viewBox.y },
      { x: viewBox.x, y: viewBox.y + viewBox.height },
      { x: viewBox.x + viewBox.width, y: viewBox.y + viewBox.height },
    ].map((point) =>
      transformPoint(point, instance.placement!.position, instance.placement!),
    );
    const minimumX = Math.min(...corners.map((point) => point.x));
    const maximumX = Math.max(...corners.map((point) => point.x));
    const maximumY = Math.max(...corners.map((point) => point.y));
    const position = {
      x: Math.round((minimumX + maximumX) / 2),
      y: Math.round(
        document.presentation.styleProfileId === "textbook-monochrome-v1"
          ? maximumY + 14
          : maximumY +
              styleProfile.typography.labelGap +
              styleProfile.typography.instanceFontSize,
      ),
    };
    return {
      id: `instance-label-${instance.id}`,
      kind: "instance-label",
      text: instance.id,
      position,
      attachedObjectId: instance.id,
      offset: {
        x: position.x - instance.placement.position.x,
        y: position.y - instance.placement.position.y,
      },
      alignment: "middle",
      rotation: 0,
      locked: false,
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
  const paletteSource =
    document.presentation.styleProfileId === "razavi-textbook-v1"
      ? razaviReferencePaletteSymbols
      : builtInSymbols;
  const componentSymbols = paletteSource.filter(
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

  // Flush a coalesced recovery write before the tab is hidden or unloaded, so
  // the last edit is never lost to a timer that did not fire. `flush()` is
  // idempotent when nothing is pending.
  useEffect(() => {
    const flushWhenHidden = () => {
      if (window.document.visibilityState === "hidden") flushRecovery();
    };
    const flushOnPageHide = () => flushRecovery();
    window.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      window.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flushOnPageHide);
      // On unmount (distinct from page hide — e.g. StrictMode remount or a
      // future routed shell) cancel rather than write, so a stale timer cannot
      // fire against a React session that no longer owns the project.
      recoveryScheduler.dispose();
    };
  }, []);

  function replaceSelectionIds(
    kind: VisualSelectionKind,
    next: string[] | ((current: string[]) => string[]),
  ): void {
    setVisualSelection((current) => {
      const property = `${kind}Ids` as keyof VisualSelection;
      const currentIds = current[property] as string[];
      const ids = typeof next === "function" ? next(currentIds) : next;
      return replaceVisualSelectionKind(current, kind, ids);
    });
  }

  function setSelectedIds(
    next: string[] | ((current: string[]) => string[]),
  ): void {
    replaceSelectionIds("instance", next);
  }

  function setSelectedRouteId(id: string | null): void {
    replaceSelectionIds("route", id ? [id] : []);
  }

  function setSelectedAnnotationId(id: string | null): void {
    replaceSelectionIds("annotation", id ? [id] : []);
  }

  function setSelectedDraftingId(id: string | null): void {
    replaceSelectionIds("drafting", id ? [id] : []);
  }

  function stageRecovery(nextProject: CircuitProject): void {
    // Coalesced: a burst of edits becomes one delayed write. The lifecycle
    // effect flushes before the tab hides, and cancelRecovery() clears any
    // pending write before a whole-project replacement.
    recoveryScheduler.schedule(nextProject);
  }

  function cancelRecovery(): void {
    recoveryScheduler.cancel();
  }

  function flushRecovery(): void {
    recoveryScheduler.flush();
  }

  function resetInteractionState(): void {
    setVisualSelection(EMPTY_VISUAL_SELECTION);
    setSelectedRouteSegmentIndex(null);
    setTextEditing(null);
    setSelectedEndpoint(null);
    setDragPreview(null);
    setWireSource(null);
    setWirePreviewPoint(null);
    setWireWaypoints([]);
    setTool("pointer");
  }

  function clearSupplementalSelection(): void {
    setVisualSelection((current) =>
      clearVisualSelectionKinds(current, [
        "route",
        "junction",
        "annotation",
        "drafting",
      ]),
    );
  }

  function selectEndpoint(candidate: WireSource): void {
    setSelectedEndpoint(candidate);
    setVisualSelection(
      candidate.endpoint.kind === "junction"
        ? {
            ...EMPTY_VISUAL_SELECTION,
            junctionIds: [candidate.endpoint.junctionId],
          }
        : EMPTY_VISUAL_SELECTION,
    );
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
    setStatus(`Opened Cell ${nextDocument.name}`);
  }

  function enterHierarchy(instanceId: string): void {
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    const targetId = instance ? referencedDocumentId(project, instance) : null;
    if (!targetId) {
      setStatus(`${instanceId} has no imported child Cell`);
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
    // Drop any pending recovery write for the outgoing project so it cannot
    // revive after Save/Discard/Open/Import/Restore/demo-load swaps the project.
    // Callers that also remove the recovery key do so after this cancels.
    cancelRecovery();
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
      const detail = result.diagnostics[0]?.message;
      setStatus(
        detail && detail !== result.error.message
          ? `${result.error.code}: ${result.error.message} — ${detail}`
          : `${result.error.code}: ${result.error.message}`,
      );
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
    // Route taps are persisted geometry. Snap the projected screen hit back to
    // the document grid before splitRoute validates it, avoiding sub-pixel SVG
    // transform residue at an otherwise exact corner.
    const splitPoint = {
      x: snap(point.x, document.presentation.grid),
      y: snap(point.y, document.presentation.grid),
    };
    return {
      endpoint: { kind: "junction", junctionId },
      netId: route.netId,
      point: splitPoint,
      preludeEdits: [
        {
          kind: "add_junction",
          junctionId,
          netId: route.netId,
          position: splitPoint,
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
    const svg = event.currentTarget.ownerSVGElement!;
    const pointer = pointFromClient(event.clientX, event.clientY, svg, false);
    const tap = resolveRouteTap(
      routeRecord.polyline.points,
      pointer,
      logicalRadiusForPixels(svg, 7),
    );
    if (tool === "pointer") {
      clearSupplementalSelection();
      setSelectedRouteId(routeId);
      setSelectedRouteSegmentIndex(tap?.segmentIndex ?? 0);
      setSelectedIds([]);
      setSelectedAnnotationId(null);
      setStatus(
        `Selected route ${routeId}, segment ${(tap?.segmentIndex ?? 0) + 1}`,
      );
      return;
    }
    if (!tap) {
      setStatus("Wire must start or end inside a route segment");
      return;
    }
    const overlappingTargets = routePolylines.filter((candidate) =>
      resolveRouteTap(
        candidate.polyline.points,
        pointer,
        logicalRadiusForPixels(svg, 7),
      ),
    );
    if (overlappingTargets.length > 1) {
      setStatus(
        "Ambiguous intersection: choose one conductor away from the crossing",
      );
      return;
    }
    const anchor = routeAnchor(routeId, tap.point, tap.segmentIndex);
    if (!wireSource) {
      setWireSource(anchor);
      setWirePreviewPoint(tap.point);
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
      setStatus(`Unrouted ${selectedRouteId}; electrical Net retained`);
    }
  }

  function deleteSelectedRouteConnection(): void {
    if (!selectedRouteId) return;
    const route = document.routes.find(
      (candidate) => candidate.id === selectedRouteId,
    );
    if (!route) return;
    if (route.from.kind === "junction" || route.to.kind === "junction") {
      setStatus(
        "Cannot safely delete a branched route yet; use Unroute to retain the Net, or delete the selected endpoint connection",
      );
      return;
    }
    const attachedRouteCount = (endpoint: RouteEndpoint): number =>
      document.routes.filter(
        (candidate) =>
          endpointKey(candidate.from) === endpointKey(endpoint) ||
          endpointKey(candidate.to) === endpointKey(endpoint),
      ).length;
    if (
      attachedRouteCount(route.from) !== 1 ||
      attachedRouteCount(route.to) !== 1
    ) {
      setStatus(
        "Cannot safely delete a shared route yet; use Unroute to retain the Net, or disconnect a selected endpoint",
      );
      return;
    }
    const result = transact([
      { kind: "make_flightline", routeId: route.id },
      { kind: "disconnect_endpoint", endpoint: route.from },
      { kind: "disconnect_endpoint", endpoint: route.to },
    ]);
    if (result.ok) {
      setSelectedRouteId(null);
      setStatus(`Deleted electrical connection ${route.id}`);
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
    clearSupplementalSelection();
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

  // Renderer defaults have no persisted object until the user gives the label
  // an independent placement. Materialize the standard semantic annotation at
  // pointer-down, then continue through the same drag protocol as every other
  // electrical label. No text edit is required.
  function beginDefaultInstanceLabelDrag(
    event: ReactPointerEvent<SVGRectElement>,
    instance: SchematicDocument["instances"][number],
  ): void {
    const annotation = defaultInstanceLabel(instance);
    if (!annotation) return;
    const result = transact([{ kind: "upsert_annotation", annotation }]);
    if (result.ok) beginAnnotationDrag(event, annotation);
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
    snapToGrid = true,
  ): Point {
    const grid = document.presentation.grid;
    const matrix = svg.getScreenCTM();
    if (matrix) {
      const clientPoint = svg.createSVGPoint();
      clientPoint.x = clientX;
      clientPoint.y = clientY;
      const localPoint = clientPoint.matrixTransform(matrix.inverse());
      return {
        x: snapToGrid ? snap(localPoint.x, grid) : localPoint.x,
        y: snapToGrid ? snap(localPoint.y, grid) : localPoint.y,
      };
    }
    const bounds = svg.getBoundingClientRect();
    const x =
      viewBox.x + ((clientX - bounds.left) / bounds.width) * viewBox.width;
    const y =
      viewBox.y + ((clientY - bounds.top) / bounds.height) * viewBox.height;
    return {
      x: snapToGrid ? snap(x, grid) : x,
      y: snapToGrid ? snap(y, grid) : y,
    };
  }

  function logicalRadiusForPixels(svg: SVGSVGElement, pixels: number): number {
    const matrix = svg.getScreenCTM();
    if (!matrix) return pixels;
    const xScale = Math.hypot(matrix.a, matrix.b);
    const yScale = Math.hypot(matrix.c, matrix.d);
    const scale = (xScale + yScale) / 2;
    return scale > 0 ? pixels / scale : pixels;
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
      vdd: "VDD",
      port: "P",
    };
    let id = `${prefix[symbolId] ?? "X"}${instanceCounter.current}`;
    while (document.instances.some((instance) => instance.id === id)) {
      instanceCounter.current += 1;
      id = `${prefix[symbolId] ?? "X"}${instanceCounter.current}`;
    }
    const symbolVariantId = defaultRazaviSymbolVariantId(symbolId);
    const instance = {
      id,
      symbolId,
      ...(symbolVariantId ? { symbolVariantId } : {}),
      placement: { position, rotation: 0 as const, mirror: "none" as const },
      properties: {},
    };
    // New authoring never relies on the renderer-only default label. The
    // explicit annotation is the one editable text object for all ordinary
    // components, including independent voltage sources.
    const instanceLabel = defaultInstanceLabel(instance);
    const result = transact([
      {
        kind: "add_instance",
        instance,
      },
      ...(instanceLabel
        ? [{ kind: "upsert_annotation" as const, annotation: instanceLabel }]
        : []),
      ...(symbolId === "vdd"
        ? [
            {
              kind: "upsert_annotation" as const,
              annotation: {
                id: `label-${id}`,
                kind: "power-label" as const,
                text: "VDD",
                position: { x: position.x + 14, y: position.y + 5 },
                attachedObjectId: id,
                offset: { x: 14, y: 5 },
                alignment: "start" as const,
                rotation: 0 as const,
                locked: false,
              },
            },
          ]
        : []),
    ]);
    if (result.ok) {
      setSelectedIds([id]);
      setPendingSymbolId(null);
      setStatus(`Added ${id} (${symbolId})`);
    }
  }

  function selectInstance(instanceId: string, additive: boolean): void {
    clearSupplementalSelection();
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
    const delta = {
      x: position.x - dragPreview.pointerStart.x,
      y: position.y - dragPreview.pointerStart.y,
    };
    const moves = dragPreview.instanceIds.map((instanceId) => {
      const original = dragPreview.originalPositions[instanceId]!;
      return {
        instanceId,
        position: { x: original.x + delta.x, y: original.y + delta.y },
      };
    });
    const directSnap = directPinSnap(moves);
    const previewPosition = directSnap
      ? {
          x:
            position.x + directSnap.moves[0]!.position.x - moves[0]!.position.x,
          y:
            position.y + directSnap.moves[0]!.position.y - moves[0]!.position.y,
        }
      : position;
    if (delta.x !== 0 || delta.y !== 0) {
      suppressInstanceClick.current = true;
    }
    setDragPreview({
      ...dragPreview,
      position: previewPosition,
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
    const rawDelta = {
      x: position.x - dragPreview.pointerStart.x,
      y: position.y - dragPreview.pointerStart.y,
    };
    const unsnappedMoves = dragPreview.instanceIds.map((instanceId) => {
      const original = dragPreview.originalPositions[instanceId]!;
      return {
        instanceId,
        position: {
          x: original.x + rawDelta.x,
          y: original.y + rawDelta.y,
        },
      };
    });
    const directSnap = directPinSnap(unsnappedMoves);
    const moves = directSnap?.moves ?? unsnappedMoves;
    const delta = {
      x:
        moves[0]!.position.x -
        dragPreview.originalPositions[moves[0]!.instanceId]!.x,
      y:
        moves[0]!.position.y -
        dragPreview.originalPositions[moves[0]!.instanceId]!.y,
    };
    if (delta.x !== 0 || delta.y !== 0) {
      try {
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
        const result = transact([
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
          ...(directSnap
            ? [
                {
                  kind: "connect_endpoints" as const,
                  from: directSnap.from.endpoint,
                  to: directSnap.to.endpoint,
                  ...(!directSnap.from.netId && !directSnap.to.netId
                    ? { newNetId: `net-ui-${nextRoutingSuffix()}` }
                    : {}),
                },
              ]
            : []),
        ]);
        if (result.ok && directSnap) {
          setStatus("Snapped pin endpoints and connected them without a wire");
        }
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Local stretch failed",
        );
      }
    }
    setDragPreview(null);
  }

  function rotateSelected(deltaDegrees: 90 | -90 = 90): void {
    const instanceEdits = selectedIds.flatMap((id): SchematicEdit[] => {
      const instance = document.instances.find(
        (candidate) => candidate.id === id,
      );
      if (!instance?.placement) return [];
      const next =
        (((instance.placement.rotation + deltaDegrees) % 360) + 360) % 360;
      return [
        {
          kind: "rotate_instance",
          instanceId: instance.id,
          rotation: next as 0 | 90 | 180 | 270,
        },
      ];
    });
    // Drafting rotation: R now also rotates a selected drafting object. An arrow
    // pivots about its resolved center; a construction line pivots about the
    // center of its bounds. Purely geometric — never changes electrical Nets.
    const draftingEdits = visualSelection.draftingIds.flatMap(
      (id): SchematicEdit[] => {
        const object = document.drafting?.objects.find(
          (candidate) => candidate.id === id,
        );
        if (!object || object.locked) return [];
        const geometry = resolveDraftingObjectGeometry(
          document,
          resolver,
          object,
        );
        if (object.kind === "arrow" && geometry.kind === "arrow") {
          const pivot = geometry.center;
          const from =
            object.from.kind === "free"
              ? rotateFreePoint(object.from, pivot, deltaDegrees)
              : object.from;
          const to =
            object.to.kind === "free"
              ? rotateFreePoint(object.to, pivot, deltaDegrees)
              : object.to;
          return [
            {
              kind: "upsert_drafting_object",
              object: { ...object, from, to },
            },
          ];
        }
        if (object.kind === "construction-line") {
          const pivot = centerOfBounds(geometry.bounds);
          const points = object.points.map(
            (point) =>
              rotateFreePoint(
                { kind: "free", position: point },
                pivot,
                deltaDegrees,
              ).position,
          );
          return [
            {
              kind: "upsert_drafting_object",
              object: { ...object, points },
            },
          ];
        }
        return [];
      },
    );
    const edits = [...instanceEdits, ...draftingEdits];
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
    cancelRecovery();
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
    cancelRecovery();
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
    clearSupplementalSelection();
    setSelectedDraftingId(id);
    setSelectedAnnotationId(null);
    setSelectedRouteId(null);
    setSelectedIds([]);
  }

  function draftingDragOrigin(object: DraftingObject): Point | null {
    if (object.kind === "construction-line") return object.points[0] ?? null;
    if (object.kind === "arrow") {
      return object.from.kind === "free" && object.to.kind === "free"
        ? object.from.position
        : null;
    }
    return object.anchor.kind === "free" ? object.anchor.position : null;
  }

  function translateDraftingObject(
    object: DraftingObject,
    delta: Point,
  ): DraftingObject {
    const moveFreeAnchor = <T extends DraftingObject["anchor"]>(
      anchor: T,
    ): T =>
      anchor.kind === "free"
        ? ({
            ...anchor,
            position: {
              x: Math.round(anchor.position.x + delta.x),
              y: Math.round(anchor.position.y + delta.y),
            },
          } as T)
        : anchor;
    if (object.kind === "construction-line") {
      return {
        ...object,
        anchor: moveFreeAnchor(object.anchor),
        points: object.points.map((point) => ({
          x: Math.round(point.x + delta.x),
          y: Math.round(point.y + delta.y),
        })),
      };
    }
    if (object.kind === "arrow") {
      return {
        ...object,
        anchor: moveFreeAnchor(object.anchor),
        from: moveFreeAnchor(object.from),
        to: moveFreeAnchor(object.to),
      };
    }
    return { ...object, anchor: moveFreeAnchor(object.anchor) };
  }

  // A drafting drag commits exactly one typed transaction on pointerup. Its
  // geometry is kind-aware: arrows move their free endpoints and construction
  // lines move their points, rather than mutating the unused base anchor.
  function beginDraftingDrag(
    event: ReactPointerEvent<SVGElement>,
    object: DraftingObject,
  ): void {
    if (event.button !== 0 || object.locked) return;
    const origin = draftingDragOrigin(object);
    if (!origin) {
      selectDraftingObject(object.id);
      setStatus("This anchored drawing moves with its attachment");
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
    const original = { ...origin };
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
        if (latest) {
          transact([
            {
              kind: "upsert_drafting_object",
              object: translateDraftingObject(latest, {
                x: position.x - original.x,
                y: position.y - original.y,
              }),
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

  // Drag a single endpoint (arrow from/to) or vertex (construction-line index).
  // Mirrors beginDraftingDrag's session discipline (cancel on Escape, commit
  // once on pointerup from the ref) but mutates only the named handle, leaving
  // the rest of the object's geometry in place. The arrow head always rides the
  // tip because the renderer derives it from `to`.
  function beginDraftingHandleDrag(
    event: ReactPointerEvent<SVGElement>,
    object: DraftingObject,
    handle: { kind: "from" | "to" } | { kind: "vertex"; index: number },
  ): void {
    if (event.button !== 0 || object.locked) return;
    event.stopPropagation();
    draftingDragSessionRef.current?.cancel();
    const hitTarget = event.currentTarget;
    hitTarget.setPointerCapture(event.pointerId);
    const svg = hitTarget.ownerSVGElement!;
    const start = pointFromClient(event.clientX, event.clientY, svg);
    const originalObject = { ...object };
    selectDraftingObject(object.id);

    const applyHandle = (
      target: DraftingObject,
      point: Point,
    ): DraftingObject => {
      if (target.kind === "arrow" && handle.kind !== "vertex") {
        const anchor = handle.kind === "from" ? target.from : target.to;
        if (anchor.kind !== "free") return target;
        const nextAnchor = { ...anchor, position: point };
        return handle.kind === "from"
          ? { ...target, from: nextAnchor }
          : { ...target, to: nextAnchor };
      }
      if (target.kind === "construction-line" && handle.kind === "vertex") {
        const points = target.points.slice();
        points[handle.index] = point;
        return { ...target, points };
      }
      return target;
    };

    let latestPoint: Point | null = null;

    const move = (moveEvent: PointerEvent): void => {
      const snapped = snapDraftingPoint(
        pointFromClient(moveEvent.clientX, moveEvent.clientY, svg),
        moveEvent.altKey,
        moveEvent.shiftKey,
      );
      latestPoint = snapped.point;
    };

    const cancel = (): void => {
      latestPoint = null;
      draftingDragSessionRef.current = null;
      if (hitTarget.hasPointerCapture(event.pointerId)) {
        hitTarget.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };

    const up = (): void => {
      const point = latestPoint;
      latestPoint = null;
      draftingDragSessionRef.current = null;
      if (point) {
        const latest = document.drafting?.objects.find(
          (item) => item.id === object.id,
        );
        if (latest) {
          const next = applyHandle(latest, point);
          if (next !== latest) {
            transact([{ kind: "upsert_drafting_object", object: next }]);
          }
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
    // Suppress unused-warning for originalObject (kept for future preview).
    void originalObject;
  }

  // Insert a vertex on a construction line at the clicked point, on the nearest
  // segment. Commits one transaction. Used by the construction-line hit shape's
  // double-click handler.
  function insertConstructionVertex(
    object: Extract<DraftingObject, { kind: "construction-line" }>,
    point: Point,
  ): void {
    if (object.locked) return;
    let bestIndex = object.points.length - 1;
    let bestDistance = Infinity;
    for (let index = 0; index < object.points.length - 1; index += 1) {
      const from = object.points[index]!;
      const to = object.points[index + 1]!;
      const on = closestPointOnSegment(point, from, to);
      const distance = (on.x - point.x) ** 2 + (on.y - point.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index + 1;
      }
    }
    const points = object.points.slice();
    points.splice(bestIndex, 0, { x: point.x, y: point.y });
    transact([
      { kind: "upsert_drafting_object", object: { ...object, points } },
    ]);
    setStatus(`Inserted vertex ${bestIndex}`);
  }

  // Delete a vertex from a construction line by index; refuse below 2 vertices.
  function deleteConstructionVertex(
    object: Extract<DraftingObject, { kind: "construction-line" }>,
    index: number,
  ): void {
    if (object.locked) return;
    if (object.points.length <= 2) {
      setStatus("A construction line needs at least two vertices");
      return;
    }
    const points = object.points.filter(
      (_, vertexIndex) => vertexIndex !== index,
    );
    transact([
      { kind: "upsert_drafting_object", object: { ...object, points } },
    ]);
    setStatus(`Deleted vertex ${index}`);
  }

  // Apply a bounded style change to the selected drafting object(s). `patch` is
  // merged into styleOverride (undefined keys clear that property). One
  // upsert_drafting_object transaction per object. Applies to free arrows and
  // construction lines; route current markers keep their own binding.
  function setDraftingStyle(
    patch: Partial<{
      lineStyle: "solid" | "dashed" | "dotted";
      strokeScale: 0.75 | 1 | 1.5 | 2;
      arrowHead: "none" | "filled" | "open";
      arrowHeadScale: 0.75 | 1 | 1.25 | 1.5;
    }>,
  ): void {
    const ids = visualSelection.draftingIds;
    if (ids.length === 0) return;
    const edits: SchematicEdit[] = [];
    for (const id of ids) {
      const object = document.drafting?.objects.find(
        (candidate) => candidate.id === id,
      );
      if (
        !object ||
        object.locked ||
        (object.kind !== "arrow" && object.kind !== "construction-line")
      ) {
        continue;
      }
      const currentOverride = object.styleOverride ?? {};
      const nextOverride = { ...currentOverride };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) {
          delete (nextOverride as Record<string, unknown>)[key];
        } else {
          (nextOverride as Record<string, unknown>)[key] = value;
        }
      }
      edits.push({
        kind: "upsert_drafting_object",
        object: {
          ...object,
          styleOverride:
            Object.keys(nextOverride).length > 0 ? nextOverride : undefined,
        },
      });
    }
    if (edits.length > 0) {
      const result = transact(edits);
      if (result.ok) setStatus("Updated drawing style");
    } else if (ids.length > 0) {
      setStatus("Drawing is locked; unlock it before editing its style");
    }
  }

  function toggleDraftingLock(object: DraftingObject): void {
    const result = transact([
      {
        kind: "upsert_drafting_object",
        object: { ...object, locked: !object.locked },
      },
    ]);
    if (result.ok) {
      setStatus(
        object.locked
          ? "Drawing unlocked; it can now be edited or deleted"
          : "Drawing locked; unlock it before editing or deleting",
      );
    }
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
    // Untouched semantic labels receive canonical math composition. A label
    // saved through the floating editor reopens its exact AST, so explicit
    // formatting (notably multi-character subscripts) round-trips.
    return (
      annotation.content ??
      schematicTextDocument(annotation.text, annotation.kind)
    );
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
    const routeAttachment = selectedAnnotation.routeAttachment
      ? { ...selectedAnnotation.routeAttachment, direction }
      : undefined;
    const result = transact([
      {
        kind: "upsert_annotation",
        annotation: {
          ...selectedAnnotation,
          ...(anchor ? { anchor } : {}),
          ...(routeAttachment ? { routeAttachment } : {}),
        },
      },
    ]);
    if (result.ok) setStatus(`Current arrow points ${direction}`);
  }

  // Step a route current marker's normal offset (perpendicular distance from
  // its conductor) up or down. Keeps the marker bound to its route; purely a
  // presentation change, no electrical effect.
  function stepCurrentArrowOffset(increase: boolean): void {
    if (!selectedAnnotation || !isRoutedMarker(selectedAnnotation)) return;
    const attachment = effectiveRouteAttachment(selectedAnnotation);
    if (!attachment) return;
    const step = 4;
    const next = attachment.normalOffset + (increase ? step : -step);
    const anchor =
      selectedAnnotation.kind === "route-marker" &&
      selectedAnnotation.anchor?.kind === "route"
        ? { ...selectedAnnotation.anchor, normalOffset: next }
        : selectedAnnotation.anchor;
    const routeAttachment = selectedAnnotation.routeAttachment
      ? { ...selectedAnnotation.routeAttachment, normalOffset: next }
      : undefined;
    const result = transact([
      {
        kind: "upsert_annotation",
        annotation: {
          ...selectedAnnotation,
          ...(anchor ? { anchor } : {}),
          ...(routeAttachment ? { routeAttachment } : {}),
        },
      },
    ]);
    if (result.ok) setStatus(`Current arrow offset ${next}`);
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
    // Ctrl/Command+wheel is a browser-reserved page-zoom gesture. The canvas
    // owns an unmodified wheel gesture only while the pointer is over it, so
    // schematic navigation stays useful without fighting the host browser.
    if (event.ctrlKey || event.metaKey) return;
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
    // Arrow / Construction line use a two-phase click model (mirroring wire):
    // click to set the start, hover to preview, click to commit. They bypass the
    // pointer-capture gesture trio here; creation lives in the SVG onClick and
    // continueCanvasGesture hover handling.
    if (tool === "construction-line" || tool === "arrow") return;
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
    // Two-phase drafting: keep the preview anchored to the snap-aware hover point.
    if (
      (tool === "arrow" || tool === "construction-line") &&
      draftingSource !== null
    ) {
      const snapped = snapDraftingPoint(point, event.altKey, event.shiftKey);
      setDraftingHover(snapped.point);
      setDraftingSnapPoint(snapped.snap);
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
      : [
          ...new Set(
            document.instances
              .filter((instance) => {
                const bounds = instanceHitBox(instance);
                const defaultLabel = defaultInstanceLabel(instance);
                return (
                  (bounds !== null && rectsIntersect(bounds, rect)) ||
                  (defaultLabel !== null &&
                    rectsIntersect(
                      annotationHitBox(defaultLabel, defaultLabel.position),
                      rect,
                    ))
                );
              })
              .map((instance) => instance.id),
          ),
        ];
    const supplemental = clicked
      ? EMPTY_SUPPLEMENTAL_SELECTION
      : {
          routeIds: routePolylines
            .filter(({ polyline }) =>
              rectsIntersect(polylineBounds(polyline.points), rect),
            )
            .map(({ route }) => route.id),
          junctionIds: document.junctions
            .filter((junction) => pointInRect(junction.position, rect))
            .map((junction) => junction.id),
          annotationIds: document.annotations
            .filter((annotation) =>
              rectsIntersect(
                annotationHitBox(annotation, annotationAnchor(annotation)),
                rect,
              ),
            )
            .map((annotation) => annotation.id),
          draftingIds: (document.drafting?.objects ?? [])
            .filter((object) =>
              rectsIntersect(
                resolveDraftingObjectGeometry(document, resolver, object)
                  .bounds,
                rect,
              ),
            )
            .map((object) => object.id),
        };
    setVisualSelection(
      normalizeVisualSelection({
        instanceIds: ids,
        ...supplemental,
      }),
    );
    setSelectedEndpoint(null);
    setBoxPreview(null);
    const count =
      ids.length +
      supplemental.routeIds.length +
      supplemental.junctionIds.length +
      supplemental.annotationIds.length +
      supplemental.draftingIds.length;
    setStatus(count > 0 ? `Selected ${count} objects` : "Selection cleared");
  }

  // Snap a free grid point for drafting creation. Alt suppresses snap (grid
  // only). Otherwise the nearest of: pin/port/junction (visibleEndpoints), the
  // closest point on any route segment, or any existing drafting vertex — within
  // DRAFTING_SNAP_RADIUS — wins; grid snap is the fallback. Shift locks the
  // resulting segment from the origin to horizontal/vertical/45°. Purely visual
  // — never creates a Net, junction, or short.
  function snapDraftingPoint(
    point: Point,
    altKey: boolean,
    shiftKey: boolean,
    origin?: Point,
  ): { point: Point; snap: Point | null } {
    let snapped = point;
    let snapMarker: Point | null = null;
    if (!altKey) {
      let best: { point: Point; distanceSquared: number } | null = null;
      const consider = (candidate: Point): void => {
        const dx = candidate.x - point.x;
        const dy = candidate.y - point.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > DRAFTING_SNAP_RADIUS * DRAFTING_SNAP_RADIUS) {
          return;
        }
        if (!best || distanceSquared < best.distanceSquared) {
          best = { point: candidate, distanceSquared };
        }
      };
      for (const candidate of visibleEndpoints) consider(candidate.point);
      // Closest point on each route segment (visual snap to conductors; no
      // electrical effect — drafting never joins a Net by proximity).
      for (const { polyline } of routePolylines) {
        for (let i = 0; i < polyline.points.length - 1; i += 1) {
          consider(
            closestPointOnSegment(
              point,
              polyline.points[i]!,
              polyline.points[i + 1]!,
            ),
          );
        }
      }
      // Existing drafting vertices.
      for (const object of document.drafting?.objects ?? []) {
        const geometry = resolveDraftingObjectGeometry(
          document,
          resolver,
          object,
        );
        if (geometry.kind === "arrow") {
          consider(geometry.from);
          consider(geometry.to);
        } else if (geometry.kind === "construction-line") {
          for (const vertex of geometry.vertices) consider(vertex);
        }
      }
      // `consider` updates a captured value, which TypeScript intentionally
      // does not narrow after nested calls. Read it through this explicit
      // candidate shape; runtime snap ordering remains unchanged.
      const bestCandidate = best as {
        point: Point;
        distanceSquared: number;
      } | null;
      if (bestCandidate) {
        snapped = bestCandidate.point;
        snapMarker = bestCandidate.point;
      }
    }
    if (shiftKey && origin) {
      snapped = constrainAngle(origin, snapped);
    }
    return { point: snapped, snap: snapMarker };
  }

  function constrainAngle(origin: Point, target: Point): Point {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 4; // 45° increments
    const locked = Math.round(angle / step) * step;
    const length = Math.hypot(dx, dy);
    return {
      x: Math.round(origin.x + Math.cos(locked) * length),
      y: Math.round(origin.y + Math.sin(locked) * length),
    };
  }

  // Reset the two-phase drafting creation state.
  function clearDraftingCreate(): void {
    setDraftingSource(null);
    setDraftingHover(null);
    setDraftingWaypoints([]);
    setDraftingSnapPoint(null);
  }

  // Handle a canvas click while the Arrow / Construction line tool is active.
  // Mirrors the wire tool's click model: first click fixes the start (and a snap
  // candidate), hover updates the preview, the next click commits. Construction
  // lines append a vertex per intermediate click; arrows commit on click #2.
  function handleDraftingCanvasClick(
    rawPoint: Point,
    altKey: boolean,
    shiftKey: boolean,
  ): void {
    if (tool !== "arrow" && tool !== "construction-line") return;
    const { point, snap } = snapDraftingPoint(
      rawPoint,
      altKey,
      shiftKey,
      draftingSource ?? undefined,
    );
    if (draftingSource === null) {
      setDraftingSource(point);
      setDraftingHover(point);
      setDraftingSnapPoint(snap);
      setDraftingWaypoints([]);
      setStatus(
        tool === "arrow"
          ? "Arrow: click the end point (Enter to finish, Esc to cancel)"
          : "Construction line: click next vertex (Enter to finish, Esc to cancel)",
      );
      return;
    }
    if (tool === "arrow") {
      commitDraftingCreate(tool, draftingSource, point);
      clearDraftingCreate();
      return;
    }
    // construction-line: each click appends a vertex; commit happens on Enter
    // or double-click (finishDraftingCreate).
    setDraftingWaypoints((current) => [...current, point]);
    setDraftingHover(point);
    setDraftingSnapPoint(snap);
    setStatus(`Construction line: ${draftingWaypoints.length + 1} bend(s)`);
  }

  // Finish construction-line creation from the accumulated waypoints + hover,
  // or finish an arrow from its source + hover. One transaction.
  function finishDraftingCreate(): void {
    if (tool !== "arrow" && tool !== "construction-line") return;
    if (draftingSource === null) return;
    const end = draftingHover ?? draftingSource;
    if (tool === "arrow") {
      if (draftingSource.x !== end.x || draftingSource.y !== end.y) {
        commitDraftingCreate(tool, draftingSource, end);
      }
    } else {
      const points = [draftingSource, ...draftingWaypoints];
      if (
        end.x !== points[points.length - 1]!.x ||
        end.y !== points[points.length - 1]!.y
      ) {
        points.push(end);
      }
      if (points.length >= 2) {
        commitDraftingCreateVertices(points);
      }
    }
    clearDraftingCreate();
  }

  // P1: commit a drafting object at the final end point.
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

  // Commit a multi-vertex construction line from the two-phase click model.
  function commitDraftingCreateVertices(points: Point[]): void {
    if (points.length < 2) return;
    transactionCounter.current += 1;
    const id = `construction-${transactionCounter.current}`;
    const result = transact([
      {
        kind: "upsert_drafting_object",
        object: {
          id,
          kind: "construction-line",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: points[0]! },
          points: points.map((point) => ({
            x: Math.round(point.x),
            y: Math.round(point.y),
          })),
          lineStyle: "dashed",
        },
      },
    ]);
    if (result.ok) {
      setStatus(`Added construction line ${id}`);
      setTool("pointer");
    }
  }

  function deleteSelection(): void {
    const selectedRouteIds = new Set(visualSelection.routeIds);
    const selectedAnnotationIds = new Set(visualSelection.annotationIds);
    const selectedDraftingIds = new Set(visualSelection.draftingIds);
    const selectedJunctionIds = new Set([
      ...visualSelection.junctionIds,
      ...(selectedEndpoint?.endpoint.kind === "junction"
        ? [selectedEndpoint.endpoint.junctionId]
        : []),
    ]);
    const hasMixedSelection =
      selectedRouteIds.size > 0 ||
      selectedAnnotationIds.size > 0 ||
      selectedDraftingIds.size > 0 ||
      selectedJunctionIds.size > 0;
    if (
      selectedRouteIds.size === 1 &&
      selectedAnnotationIds.size === 0 &&
      selectedDraftingIds.size === 0 &&
      selectedJunctionIds.size === 0 &&
      selectedIds.length === 0
    ) {
      deleteSelectedRouteConnection();
      return;
    }
    if (hasMixedSelection) {
      for (const junctionId of selectedJunctionIds) {
        for (const route of document.routes) {
          if (
            (route.from.kind === "junction" &&
              route.from.junctionId === junctionId) ||
            (route.to.kind === "junction" && route.to.junctionId === junctionId)
          ) {
            selectedRouteIds.add(route.id);
          }
        }
      }
      transactionCounter.current += 1;
      try {
        const instanceEdits =
          selectedIds.length > 0
            ? proposeConnectedInstanceDeletion(
                document,
                resolver,
                selectedIds,
                transactionCounter.current,
              )
            : [];
        // Instance deletion already removes every annotation attached to the
        // instance. A marquee can select both visual objects, but emitting the
        // same remove_annotation edit twice makes the second operation fail
        // with OBJECT_NOT_FOUND and rolls back the whole transaction.
        const explicitAnnotationIds = explicitAnnotationRemovals(
          document,
          selectedIds,
          [...selectedAnnotationIds],
        );
        const result = transact([
          ...instanceEdits,
          ...[...selectedRouteIds].map((routeId): SchematicEdit => ({
            kind: "make_flightline",
            routeId,
          })),
          ...[...selectedJunctionIds].map((junctionId): SchematicEdit => ({
            kind: "remove_junction",
            junctionId,
          })),
          ...explicitAnnotationIds.map((annotationId): SchematicEdit => ({
            kind: "remove_annotation",
            annotationId,
          })),
          ...[...selectedDraftingIds].map((objectId): SchematicEdit => ({
            kind: "remove_drafting_object",
            objectId,
          })),
        ]);
        if (result.ok) {
          setVisualSelection(EMPTY_VISUAL_SELECTION);
          setSelectedEndpoint(null);
          setStatus("Deleted selected schematic objects");
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Delete failed");
      }
      return;
    }
    if (selectedEndpoint?.endpoint.kind === "junction") {
      deleteSelectedJunction();
      return;
    }
    if (selectedAnnotationId) {
      deleteSelectedAnnotation();
      return;
    }
    if (selectedDraftingId) {
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
      deleteSelectedRouteConnection();
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
    function dismissOnOutsidePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const openMenus = Array.from(
        globalThis.document.querySelectorAll<HTMLDetailsElement>(
          ".command-menu[open]",
        ),
      );
      if (
        openMenus.length > 0 &&
        !openMenus.some((menu) => menu.contains(target))
      ) {
        dismissOpenCommandMenus();
      }
    }
    globalThis.document.addEventListener(
      "pointerdown",
      dismissOnOutsidePointerDown,
      true,
    );
    return () =>
      globalThis.document.removeEventListener(
        "pointerdown",
        dismissOnOutsidePointerDown,
        true,
      );
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && dismissOpenCommandMenus()) {
        event.preventDefault();
        return;
      }
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
      } else if (
        !event.ctrlKey &&
        key === "x" &&
        selectedAnnotation &&
        isRoutedMarker(selectedAnnotation)
      ) {
        event.preventDefault();
        reverseSelectedCurrentArrow();
      } else if (!event.ctrlKey && key === "r") {
        event.preventDefault();
        rotateSelected(event.shiftKey ? -90 : 90);
      } else if (!event.ctrlKey && key === "w") {
        event.preventDefault();
        activateTool("wire");
      } else if (!event.ctrlKey && key === "a") {
        event.preventDefault();
        activateTool("arrow");
      } else if (!event.ctrlKey && key === "l") {
        event.preventDefault();
        activateTool("construction-line");
      } else if (!event.ctrlKey && key === "g") {
        event.preventDefault();
        activateTool("guide");
      } else if (!event.ctrlKey && key === "f") {
        event.preventDefault();
        fitView();
      } else if (
        !event.ctrlKey &&
        (event.key === "[" || event.key === "]") &&
        selectedDrafting
      ) {
        // [/]  step stroke width; Shift+[/] step arrow-head size. Bounded ratios.
        event.preventDefault();
        const increase = event.key === "]";
        if (event.shiftKey) {
          const scale = selectedDrafting.styleOverride?.arrowHeadScale ?? 1;
          setDraftingStyle({
            arrowHeadScale: stepScale(
              scale,
              [0.75, 1, 1.25, 1.5] as const,
              increase,
            ),
          });
        } else {
          const scale = selectedDrafting.styleOverride?.strokeScale ?? 1;
          setDraftingStyle({
            strokeScale: stepScale(scale, [0.75, 1, 1.5, 2] as const, increase),
          });
        }
      } else if (event.key === "Enter" && wireSource && wirePreviewPoint) {
        event.preventDefault();
        finishWireAtPoint(wirePreviewPoint);
      } else if (
        event.key === "Enter" &&
        (tool === "arrow" || tool === "construction-line") &&
        draftingSource !== null
      ) {
        event.preventDefault();
        finishDraftingCreate();
      } else if (event.key === "Escape") {
        if (helpOpen) {
          closeHelp();
          return;
        }
        // Cancel an in-progress drafting creation first (two-phase click model).
        if (
          (tool === "arrow" || tool === "construction-line") &&
          draftingSource !== null
        ) {
          clearDraftingCreate();
          setStatus("Drawing cancelled");
          return;
        }
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

  useEffect(() => {
    if (helpOpen) helpCloseRef.current?.focus();
  }, [helpOpen]);

  function closeHelp(): void {
    setHelpOpen(false);
    requestAnimationFrame(() => helpButtonRef.current?.focus());
  }

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
          {hasImportedHierarchy ? (
            <div
              className="document-nav"
              aria-label="Imported cell navigation"
              data-testid="cell-navigation"
            >
              <button
                type="button"
                onClick={returnToParentDocument}
                disabled={documentStack.length === 0}
                title="Return to the parent imported cell"
              >
                Up
              </button>
              <button
                type="button"
                onClick={returnToTopDocument}
                disabled={document.id === project.topDocumentId}
                title="Return to the top imported cell"
              >
                Top
              </button>
              <select
                aria-label="Imported Cells"
                data-testid="document-selector"
                value={document.id}
                onChange={(event) => {
                  setDocumentStack([]);
                  switchDocument(event.currentTarget.value);
                }}
              >
                {project.documents.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.id === project.topDocumentId
                      ? `${candidate.name} (top)`
                      : candidate.name}
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
                title="Enter the selected imported subcircuit"
              >
                Enter Cell
              </button>
            </div>
          ) : null}
          <details className="command-menu" name="editor-command-menu">
            <summary>Draw</summary>
            <div className="command-popover">
              <button
                type="button"
                aria-pressed={tool === "wire"}
                onClick={() => activateTool("wire")}
              >
                Wire (W)
              </button>
              <button type="button" onClick={addPlainText}>
                Text
              </button>
              <button
                type="button"
                aria-pressed={tool === "arrow"}
                onClick={() => activateTool("arrow")}
              >
                Arrow (A)
              </button>
              <button
                type="button"
                aria-pressed={tool === "construction-line"}
                onClick={() => activateTool("construction-line")}
              >
                Construction line (L)
              </button>
            </div>
          </details>
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
              <span className="command-group-label">Export</span>
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
                  !hasVisualSelection(visualSelection) && !selectedEndpoint
                }
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => rotateSelected()}
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
            <summary>More</summary>
            <div className="command-popover">
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
              <small>
                Ctrl+C/V copy/paste · R rotate · W wire · G guide · F fit ·
                Ctrl+wheel zoom · middle-drag pan · wire click=bend ·
                Enter=finish
              </small>
            </div>
          </details>
          <button
            type="button"
            ref={helpButtonRef}
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
            aria-controls="editor-help-dialog"
            onClick={() => setHelpOpen(true)}
          >
            Help
          </button>
        </nav>
        <p className="editor-status" data-testid="status" aria-live="polite">
          {status}
        </p>
      </header>
      {helpOpen ? (
        <div className="help-backdrop">
          <section
            className="help-dialog"
            id="editor-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <header className="help-dialog-header">
              <div>
                <p className="help-kicker">Interactive Circuit Maker</p>
                <h2 id="help-title">Help</h2>
              </div>
              <button
                type="button"
                ref={helpCloseRef}
                onClick={closeHelp}
                aria-label="Close help"
              >
                Close
              </button>
            </header>
            <div className="help-dialog-content">
              <section id="help-introduction" className="help-introduction">
                <p className="help-section-label">Introduction</p>
                <p>
                  Interactive Circuit Maker is a browser-based schematic editor.
                  Import SPICE or open a project, edit the circuit on the
                  canvas, then export an editable project or drawing file.
                </p>
              </section>
              <nav className="help-index" aria-label="Help sections">
                <a href="#help-introduction">Introduction</a>
                <a href="#help-handbook">Handbook</a>
                <a href="#help-shortcuts">Shortcuts</a>
                <a href="#help-data">Project data</a>
              </nav>
              <section id="help-handbook" className="help-handbook">
                <p className="help-section-label">Handbook</p>
                <h3>Start, open, and save</h3>
                <p>
                  Use <strong>File / Open Project</strong> to continue an
                  exported project, or <strong>File / Import SPICE</strong> to
                  create editable Documents from SPICE source files. Use
                  <strong>File / Save Project</strong> to download an editable
                  project file; use <strong>File / Export</strong> for SVG, PNG,
                  or PDF drawings.
                </p>
                <h3>Place, select, and connect</h3>
                <p>
                  Select a symbol in the left library, or a drawing tool from
                  <strong>Draw</strong>, then click the canvas to place or draw.
                  Select objects to move them or reveal selection actions.
                  Choose Wire (or <kbd>W</kbd>), click a terminal to start,
                  click to add bends, then press <kbd>Enter</kbd> to finish.
                  <kbd>Delete</kbd> or <kbd>Backspace</kbd> removes the
                  selection, or removes the latest wire bend while drawing.
                </p>
                <h3>View and drawing tools</h3>
                <p>
                  With the pointer over the canvas, use the mouse wheel to zoom
                  and middle-drag to pan; <kbd>F</kbd> fits the circuit in view.
                  Draw also contains Wire, Text, Arrow, and Construction line.
                  Guides are available from More and can be shown, cleared, or
                  locked for alignment.
                </p>
              </section>
              <section id="help-shortcuts" className="help-shortcuts">
                <h3>Keyboard shortcuts</h3>
                <dl>
                  <div>
                    <dt>File and history</dt>
                    <dd>
                      <kbd>Ctrl</kbd> + <kbd>S</kbd> save; <kbd>Ctrl</kbd> +
                      <kbd>O</kbd> open; <kbd>Ctrl</kbd> + <kbd>Z</kbd> undo;
                      <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> or
                      <kbd>Ctrl</kbd> + <kbd>Y</kbd> redo.
                    </dd>
                  </div>
                  <div>
                    <dt>Selection and edit</dt>
                    <dd>
                      <kbd>Ctrl</kbd> + <kbd>A</kbd> selects all placed
                      components; <kbd>Ctrl</kbd> + <kbd>C</kbd> copy;
                      <kbd>Ctrl</kbd> + <kbd>V</kbd> paste; <kbd>R</kbd> rotate;
                      <kbd>Delete</kbd> or <kbd>Backspace</kbd> delete.
                    </dd>
                  </div>
                  <div>
                    <dt>Tools and view</dt>
                    <dd>
                      <kbd>W</kbd> wire; <kbd>A</kbd> arrow; <kbd>L</kbd>
                      construction line; <kbd>G</kbd> guide; <kbd>F</kbd> fit
                      view; <kbd>X</kbd> reverses a selected current arrow.
                    </dd>
                  </div>
                  <div>
                    <dt>In-progress drawing</dt>
                    <dd>
                      <kbd>Enter</kbd> completes an active wire or drawing;
                      <kbd>Esc</kbd> cancels the active tool or closes Help.
                    </dd>
                  </div>
                </dl>
                <p>
                  Shortcuts do not run while you are typing in a text field.
                </p>
              </section>
              <section id="help-data" className="help-data-note">
                <h3>Project data and recovery</h3>
                <p>
                  This editor runs in your browser. Recovery data may be kept on
                  this device, but it is not cloud storage and can be lost when
                  browser data is cleared. Export a project file whenever you
                  need a durable backup or want to move work to another device.
                </p>
              </section>
            </div>
          </section>
        </div>
      ) : null}
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
      <aside
        className="dock"
        aria-label="Symbols and drawing tools"
        role="complementary"
      >
        <div className="library-panel">
          <div className="library-heading">
            <h2>Symbols &amp; Tools</h2>
            <button
              type="button"
              aria-expanded={libraryOpen}
              onClick={() => setLibraryOpen((current) => !current)}
            >
              {libraryOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {libraryOpen ? (
            <>
              <input
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.currentTarget.value)}
                placeholder="Search components"
                aria-label="Search components"
              />
              <details className="library-components" open>
                <summary>Components</summary>
                <div className="library-components-content">
                  {componentGroups.map((group) => (
                    <details key={group.category} open>
                      <summary>{group.category}</summary>
                      <div className="library-component-grid">
                        {group.symbols.map((symbol) => (
                          <button
                            type="button"
                            key={symbol.id}
                            data-testid={`library-component-${symbol.id}`}
                            title={`Place ${symbol.name}`}
                            onClick={() => {
                              setPendingSymbolId(symbol.id);
                              setTool("pointer");
                              setStatus(`Place ${symbol.name} on the canvas`);
                            }}
                          >
                            <SymbolThumbnail symbol={symbol} />
                            <span>{symbol.name}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            </>
          ) : null}
        </div>
        <section className="selection-shelf" aria-label="Selection">
          <header
            className="selection-shelf-header"
            data-testid="selection-shelf"
          >
            <span>Selection</span>
            <span className="selection-shelf-summary">
              {selectedIds.length > 0
                ? selectedIds.join(", ")
                : (selectedRouteId ??
                  selectedAnnotationId ??
                  selectedDraftingId ??
                  "None")}
              {hasInspectableSelection ? (
                <span
                  className="selection-shelf-indicator"
                  aria-hidden="true"
                />
              ) : null}
            </span>
          </header>
          <div className="selection-panel">
            {!hasInspectableSelection ? (
              <p className="inspect-empty">Select an object to inspect.</p>
            ) : null}
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
            {selectedInstance && selectedHiddenBulkNet ? (
              <section
                className="context-actions"
                aria-label="Hidden MOS bulk warning"
              >
                <h2>Hidden bulk warning</h2>
                <p>
                  {selectedInstance.id}.B is electrically connected to{" "}
                  {selectedHiddenBulkNet.name ?? selectedHiddenBulkNet.id}, but
                  Razavi MOS stays in three-terminal display.
                </p>
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
                <button type="button" onClick={deleteSelectedRouteConnection}>
                  Delete electrical connection
                </button>
                <button type="button" onClick={removeSelectedRouteGeometry}>
                  Unroute (keep electrical connection)
                </button>
              </section>
            ) : null}
            {selectedEndpoint &&
            selectedEndpoint.endpoint.kind !== "junction" ? (
              <section
                className="context-actions"
                aria-label="Endpoint actions"
              >
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
              <section
                className="context-actions"
                aria-label="Junction actions"
              >
                <h2>Junction</h2>
                <button type="button" onClick={deleteSelectedJunction}>
                  Delete junction and attached wires
                </button>
              </section>
            ) : null}
            {selectedDrafting &&
            (selectedDrafting.kind === "arrow" ||
              selectedDrafting.kind === "construction-line") ? (
              <section className="context-actions" aria-label="Drawing style">
                <h2>Drawing</h2>
                {selectedDrafting.locked ? (
                  <p className="drawing-lock-status" role="status">
                    Locked — editing is disabled; Delete is still available.
                  </p>
                ) : null}
                <label>
                  Line style
                  <select
                    aria-label="Line style"
                    value={
                      selectedDrafting.styleOverride?.lineStyle ??
                      (selectedDrafting.kind === "construction-line"
                        ? selectedDrafting.lineStyle
                        : "solid")
                    }
                    disabled={selectedDrafting.locked}
                    onChange={(event) =>
                      setDraftingStyle({
                        lineStyle: event.currentTarget.value as
                          "solid" | "dashed" | "dotted",
                      })
                    }
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>
                <label>
                  Stroke width
                  <select
                    aria-label="Stroke width"
                    value={String(
                      selectedDrafting.styleOverride?.strokeScale ?? 1,
                    )}
                    disabled={selectedDrafting.locked}
                    onChange={(event) =>
                      setDraftingStyle({
                        strokeScale: Number(event.currentTarget.value) as
                          0.75 | 1 | 1.5 | 2,
                      })
                    }
                  >
                    <option value="0.75">0.75×</option>
                    <option value="1">1×</option>
                    <option value="1.5">1.5×</option>
                    <option value="2">2×</option>
                  </select>
                </label>
                {selectedDrafting.kind === "arrow" ? (
                  <>
                    <label>
                      Arrow head
                      <select
                        aria-label="Arrow head"
                        value={
                          selectedDrafting.styleOverride?.arrowHead ?? "filled"
                        }
                        disabled={selectedDrafting.locked}
                        onChange={(event) =>
                          setDraftingStyle({
                            arrowHead: event.currentTarget.value as
                              "none" | "filled" | "open",
                          })
                        }
                      >
                        <option value="none">None</option>
                        <option value="filled">Filled</option>
                        <option value="open">Open</option>
                      </select>
                    </label>
                    <label>
                      Arrow head size
                      <select
                        aria-label="Arrow head size"
                        value={String(
                          selectedDrafting.styleOverride?.arrowHeadScale ?? 1,
                        )}
                        disabled={selectedDrafting.locked}
                        onChange={(event) =>
                          setDraftingStyle({
                            arrowHeadScale: Number(
                              event.currentTarget.value,
                            ) as 0.75 | 1 | 1.25 | 1.5,
                          })
                        }
                      >
                        <option value="0.75">0.75×</option>
                        <option value="1">1×</option>
                        <option value="1.25">1.25×</option>
                        <option value="1.5">1.5×</option>
                      </select>
                    </label>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => rotateSelected()}
                  disabled={selectedDrafting.locked}
                >
                  Rotate 90° (R)
                </button>
                {selectedDrafting.kind === "arrow" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDrafting.locked) return;
                      const from = selectedDrafting.from;
                      const to = selectedDrafting.to;
                      transact([
                        {
                          kind: "upsert_drafting_object",
                          object: { ...selectedDrafting, from: to, to: from },
                        },
                      ]);
                    }}
                    disabled={selectedDrafting.locked}
                  >
                    Reverse direction
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleDraftingLock(selectedDrafting)}
                >
                  {selectedDrafting.locked ? "Unlock" : "Lock"}
                </button>
              </section>
            ) : null}
            {selectedAnnotation && isRoutedMarker(selectedAnnotation) ? (
              <section
                className="context-actions"
                aria-label="Current arrow actions"
              >
                <h2>Current arrow</h2>
                <button type="button" onClick={reverseSelectedCurrentArrow}>
                  Reverse direction (X)
                </button>
                <button
                  type="button"
                  onClick={() => stepCurrentArrowOffset(false)}
                >
                  Move closer to wire
                </button>
                <button
                  type="button"
                  onClick={() => stepCurrentArrowOffset(true)}
                >
                  Move away from wire
                </button>
                <button type="button" onClick={deleteSelectedAnnotation}>
                  Delete current arrow
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
              <dd data-testid="annotation-count">
                {document.annotations.length}
              </dd>
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
              <dd aria-live="polite">{status}</dd>
            </dl>
            <section aria-label="Import diagnostics" className="diagnostics">
              <h2>Import Diagnostics</h2>
              {importDiagnostics.length === 0 ? (
                <p>No import diagnostics</p>
              ) : null}
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
              {visualDiagnostics.length === 0 ? (
                <p>No visual diagnostics</p>
              ) : null}
              {structuralDiagnostics.length > 0 ? (
                <h3>Structural issues</h3>
              ) : null}
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
              {visualObservations.length > 0 ? (
                <h3>Visual observations</h3>
              ) : null}
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
          </div>
        </section>
      </aside>
      <section className="canvas-panel">
        <svg
          className={
            tool === "wire" ? "schematic-canvas wire-mode" : "schematic-canvas"
          }
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
            const onBackground =
              target === event.currentTarget || target.tagName === "rect";
            if (
              (tool === "arrow" || tool === "construction-line") &&
              event.detail === 1 &&
              onBackground
            ) {
              handleDraftingCanvasClick(
                pointFromClient(
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                ),
                event.altKey,
                event.shiftKey,
              );
              return;
            }
            if (tool !== "wire" || event.detail !== 1) return;
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
            if (tool === "arrow" || tool === "construction-line") {
              if (target !== event.currentTarget && target.tagName !== "rect")
                return;
              finishDraftingCreate();
              return;
            }
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
            if (tool === "arrow" || tool === "construction-line") {
              if (draftingSource !== null) {
                clearDraftingCreate();
                setStatus("Drawing cancelled");
              }
              return;
            }
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
          {tool === "wire" ? (
            <rect
              data-testid="wire-input-plane"
              className="wire-input-plane"
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
            />
          ) : null}
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
                  pointerEvents={tool === "wire" ? "none" : undefined}
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
                    pointerEvents={tool === "wire" ? "none" : undefined}
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
                const childDocumentId = referencedDocumentId(project, instance);
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
                    onDoubleClick={
                      childDocumentId
                        ? (event) => {
                            event.stopPropagation();
                            enterHierarchy(instance.id);
                          }
                        : undefined
                    }
                    onPointerDown={(event) => beginMove(event, instance.id)}
                    onPointerMove={previewMove}
                    onPointerUp={finishMove}
                    pointerEvents={tool === "wire" ? "none" : undefined}
                  />
                );
              })}
            {document.instances.map((instance) => {
              const label = defaultInstanceLabel(instance);
              if (!label) return null;
              return (
                <rect
                  key={`default-label-hit-${instance.id}`}
                  data-testid={`default-label-hit-${instance.id}`}
                  className="annotation-hit"
                  {...annotationHitBox(label, label.position)}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) =>
                    beginDefaultInstanceLabelDrag(event, instance)
                  }
                  pointerEvents={tool === "wire" ? "none" : undefined}
                />
              );
            })}
            {routePolylines.map(({ route, polyline }) => (
              <polyline
                key={route.id}
                data-testid={`route-hit-${route.id}`}
                className={
                  selectedRouteId === route.id ||
                  supplementalSelection.routeIds.includes(route.id) ||
                  selectedInternalRouteIds.has(route.id)
                    ? "route-hit selected"
                    : "route-hit"
                }
                points={polylinePoints(polyline.points)}
                onPointerDown={(event) =>
                  handleRoutePointerDown(event, route.id)
                }
                onClick={(event) => event.stopPropagation()}
              />
            ))}
            {visibleEndpoints.map((candidate) => (
              <circle
                key={`${candidate.netId}:${endpointTestId(candidate.endpoint)}`}
                data-testid={endpointTestId(candidate.endpoint)}
                className={
                  tool === "wire" ||
                  (candidate.endpoint.kind === "junction" &&
                    supplementalSelection.junctionIds.includes(
                      candidate.endpoint.junctionId,
                    )) ||
                  (selectedEndpoint?.endpoint.kind === "junction" &&
                    candidate.endpoint.kind === "junction" &&
                    selectedEndpoint.endpoint.junctionId ===
                      candidate.endpoint.junctionId)
                    ? "endpoint-hit active"
                    : "endpoint-hit"
                }
                cx={candidate.point.x}
                cy={candidate.point.y}
                r={DIRECT_PIN_SNAP_RADIUS}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectEndpoint(candidate);
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
                    selectEndpoint(candidate);
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
                    selectedAnnotationId === annotation.id ||
                    supplementalSelection.annotationIds.includes(annotation.id)
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
                  pointerEvents={tool === "wire" ? "none" : undefined}
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
              const draggable = !object.locked && draftingDragOrigin(object);
              const drag =
                draftingDragPreview?.objectId === object.id
                  ? draftingDragPreview
                  : null;
              const selected =
                selectedDraftingId === object.id ||
                supplementalSelection.draftingIds.includes(object.id)
                  ? "annotation-hit selected"
                  : "annotation-hit";
              const onDown = (event: ReactPointerEvent<SVGElement>): void => {
                if (draggable) {
                  beginDraftingDrag(event, object);
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
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      insertConstructionVertex(
                        object,
                        pointFromClient(
                          event.clientX,
                          event.clientY,
                          event.currentTarget.ownerSVGElement!,
                        ),
                      );
                    }}
                    pointerEvents={tool === "wire" ? "none" : undefined}
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
                    pointerEvents={tool === "wire" ? "none" : undefined}
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
                    pointerEvents={tool === "wire" ? "none" : undefined}
                  />
                );
              }
              if (object.kind === "callout" && geometry.kind === "callout") {
                return (
                  <g
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    onPointerDown={onDown}
                    pointerEvents={tool === "wire" ? "none" : undefined}
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
            {selectedDraftingId
              ? (() => {
                  const object = document.drafting?.objects.find(
                    (candidate) => candidate.id === selectedDraftingId,
                  );
                  if (!object || object.locked) return null;
                  const geometry = resolveDraftingObjectGeometry(
                    document,
                    resolver,
                    object,
                  );
                  if (object.kind === "arrow" && geometry.kind === "arrow") {
                    return (
                      <g data-testid={`drafting-handles-${object.id}`}>
                        <circle
                          className="draft-handle"
                          data-testid={`draft-handle-from-${object.id}`}
                          cx={geometry.from.x}
                          cy={geometry.from.y}
                          r="5"
                          onPointerDown={(event) =>
                            beginDraftingHandleDrag(event, object, {
                              kind: "from",
                            })
                          }
                        />
                        <circle
                          className="draft-handle draft-handle-center"
                          cx={geometry.center.x}
                          cy={geometry.center.y}
                          r="3"
                          pointerEvents="none"
                        />
                        <circle
                          className="draft-handle"
                          data-testid={`draft-handle-to-${object.id}`}
                          cx={geometry.to.x}
                          cy={geometry.to.y}
                          r="5"
                          onPointerDown={(event) =>
                            beginDraftingHandleDrag(event, object, {
                              kind: "to",
                            })
                          }
                        />
                      </g>
                    );
                  }
                  if (
                    object.kind === "construction-line" &&
                    geometry.kind === "construction-line"
                  ) {
                    return (
                      <g data-testid={`drafting-handles-${object.id}`}>
                        {geometry.vertices.map((vertex, index) => (
                          <circle
                            key={`draft-vx-${index}`}
                            className="draft-handle"
                            data-testid={`draft-handle-vx-${index}-${object.id}`}
                            cx={vertex.x}
                            cy={vertex.y}
                            r="5"
                            onPointerDown={(event) =>
                              beginDraftingHandleDrag(event, object, {
                                kind: "vertex",
                                index,
                              })
                            }
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              deleteConstructionVertex(object, index);
                            }}
                          />
                        ))}
                      </g>
                    );
                  }
                  return null;
                })()
              : null}
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
            {draftingSource && draftingHover ? (
              <DraftingCreatePreview
                tool={tool}
                start={draftingSource}
                waypoints={draftingWaypoints}
                hover={draftingHover}
                snap={draftingSnapPoint}
                styleProfile={styleProfile}
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
