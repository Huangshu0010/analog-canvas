import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

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
  defaultInstanceLabelPlacement,
  resolveSchematicStyleProfile,
  schematicTextDocument,
  schematicTextFontSize,
} from "@icm/render-svg";
import type { SchematicStyleProfile } from "@icm/render-svg";
import { importSpiceSources } from "@icm/spice";
import type { SpiceDiagnostic } from "@icm/spice";
import { copySelection, proposePaste } from "./clipboard";
import type { SchematicClipboard } from "./clipboard";
import { startCanvasDragSession } from "./canvas-drag-session";
import type { CanvasDragSession } from "./canvas-drag-session";
import { startCanvasDragVisual } from "./canvas-drag-visual";
import { resolveCanvasHitAtPoint } from "./canvas-hit-resolver";
import { ComponentLibrary } from "./component-library";
import { useDocumentController } from "./document-controller";
import { referencedDocumentId } from "./editor-session";
import { useInteractionState } from "./interaction-state";
import type { EditorTool, WireSource } from "./interaction-state";
import {
  defaultRazaviSymbolVariantId,
  razaviHiddenBulkRisk,
  razaviMosPresentationEdits,
} from "./razavi-presentation";
import {
  collectVisualRouteDeletion,
  explicitAnnotationRemovals,
  proposeConnectedInstanceDeletion,
} from "./delete-selection";
import { createRoutingDemoProject } from "./routing-demo";
import { createVisualDemoProject } from "./visual-demo";
import { useSelectionController } from "./selection-controller";
import { hasVisualSelection } from "./visual-selection";
import type { VisualSelection } from "./visual-selection";
import { createRecoveryScheduler } from "./recovery-scheduler";
import type { RecoveryScheduler } from "./recovery-scheduler";
import { RichTextEditor } from "./rich-text-editor";
import { reflectOrientation } from "./shortcut-orientation";
import type { ScreenFlip } from "./shortcut-orientation";
import { instanceVisibleHitBox } from "./selection-geometry";
import { buildManualWirePath } from "./wire-path";

const RECOVERY_KEY = "icm.recovery.v1";
// Coalesce bursts of edits into one recovery write so a large schematic does
// not serialize and block on every transaction. Not a product contract; tuned
// only if real measurement shows it is too coarse. See recovery-scheduler.ts.
const RECOVERY_DELAY_MS = 400;
const DEFAULT_VIEWBOX: Rect = { x: 0, y: 0, width: 960, height: 640 };
const DIRECT_PIN_SNAP_RADIUS = 4;
const DRAG_START_DISTANCE_PX = 4;
// Drafting creation snap radius (logical units). Slightly more generous than
// pin-snap so an arrow/construction-line endpoint finds a nearby pin/port/
// junction without requiring pixel-perfect aiming.
const DRAFTING_SNAP_RADIUS = 8;

interface DragPreview {
  instanceIds: string[];
  originalPositions: Record<string, Point>;
  pointerStart: Point;
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
  kind: "segment" | "translate";
  start: Point;
  point: Point;
}

interface AnnotationDragPreview {
  annotationId: string;
  originalPosition: Point;
  pointerStart: Point;
}

// Handle drags are geometry edits rather than translations.  Keep a complete
// transient object so the formal SVG renderer can redraw both a curved shaft
// and its arrow head from the same latest control point before pointer-up.
interface DraftingHandlePreview {
  objectId: string;
  object: DraftingObject;
}

type SupplementalSelection = Omit<VisualSelection, "instanceIds">;

const EMPTY_SUPPLEMENTAL_SELECTION: SupplementalSelection = {
  routeIds: [],
  junctionIds: [],
  annotationIds: [],
  draftingIds: [],
};

export interface AppProps {
  project?: CircuitProject;
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

function draftingPathData(
  points: readonly Point[],
  curveControls: readonly (Point | null)[],
): string {
  const start = points[0]!;
  let data = `M ${start.x} ${start.y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const end = points[index + 1]!;
    const control = curveControls[index];
    data += control
      ? ` Q ${control.x} ${control.y} ${end.x} ${end.y}`
      : ` L ${end.x} ${end.y}`;
  }
  return data;
}

function quadraticMidpoint(
  from: Point,
  control: Point | null,
  to: Point,
): Point {
  return control
    ? {
        x: (from.x + 2 * control.x + to.x) / 4,
        y: (from.y + 2 * control.y + to.y) / 4,
      }
    : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

// A quadratic Bézier evaluated at t=0.5 is (P0 + 2C + P1)/4. Inverting it
// makes the visible midpoint the direct manipulation handle the user drags.
function controlForQuadraticMidpoint(
  from: Point,
  midpoint: Point,
  to: Point,
): Point {
  return {
    x: Math.round(2 * midpoint.x - (from.x + to.x) / 2),
    y: Math.round(2 * midpoint.y - (from.y + to.y) / 2),
  };
}

function quadraticTangentAngle(
  from: Point,
  control: Point | null,
  to: Point,
): number {
  if (!control) return 0;
  const start = { x: control.x - from.x, y: control.y - from.y };
  const end = { x: to.x - control.x, y: to.y - control.y };
  const startLength = Math.hypot(start.x, start.y);
  const endLength = Math.hypot(end.x, end.y);
  if (startLength < 1e-6 || endLength < 1e-6) return 0;
  const cosine = Math.max(
    -1,
    Math.min(
      1,
      (start.x * end.x + start.y * end.y) / (startLength * endLength),
    ),
  );
  return (Math.acos(cosine) * 180) / Math.PI;
}

function controlForTangentAngle(
  from: Point,
  to: Point,
  angleDegrees: number,
  existingControl: Point | null,
): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chordLength = Math.hypot(dx, dy);
  if (chordLength < 1e-6 || angleDegrees <= 0.01) return null;
  const boundedAngle = Math.min(170, Math.max(0.01, angleDegrees));
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const normal = { x: -dy / chordLength, y: dx / chordLength };
  const existingSide = existingControl
    ? Math.sign(
        (existingControl.x - midpoint.x) * normal.x +
          (existingControl.y - midpoint.y) * normal.y,
      )
    : 1;
  const offset = (chordLength / 2) * Math.tan((boundedAngle * Math.PI) / 360);
  return {
    x: Math.round(midpoint.x + normal.x * offset * (existingSide || 1)),
    y: Math.round(midpoint.y + normal.y * offset * (existingSide || 1)),
  };
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

function segmentIntersectsRect(from: Point, to: Point, rect: Rect): boolean {
  if (pointInRect(from, rect) || pointInRect(to, rect)) return true;

  const delta = { x: to.x - from.x, y: to.y - from.y };
  let entry = 0;
  let exit = 1;
  const boundaries: ReadonlyArray<readonly [number, number]> = [
    [-delta.x, from.x - rect.x],
    [delta.x, rect.x + rect.width - from.x],
    [-delta.y, from.y - rect.y],
    [delta.y, rect.y + rect.height - from.y],
  ];

  for (const [direction, distance] of boundaries) {
    if (direction === 0) {
      if (distance < 0) return false;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) entry = Math.max(entry, ratio);
    else exit = Math.min(exit, ratio);
    if (entry > exit) return false;
  }
  return true;
}

function rectangleBoundaryIntersectsRect(
  corners: readonly Point[],
  rect: Rect,
): boolean {
  return corners.some((corner, index) =>
    segmentIntersectsRect(corner, corners[(index + 1) % corners.length]!, rect),
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

function rotatePointByDegrees(
  point: Point,
  pivot: Point,
  degrees: number,
): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: Math.round(pivot.x + dx * cos - dy * sin),
    y: Math.round(pivot.y + dx * sin + dy * cos),
  };
}

function normalizedBearing(from: Point, to: Point): number {
  return (
    ((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 360) % 360
  );
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
  const rectangle = normalizedRect(start, hover);
  const isRectangle = tool === "rectangle";
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
      {isRectangle ? (
        <rect className="drafting-create-preview" {...rectangle} fill="none" />
      ) : (
        <polyline
          className="drafting-create-preview"
          points={polylinePoints(path)}
          fill="none"
        />
      )}
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
      {!isRectangle &&
        waypoints.map((point, index) => (
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
        {isRectangle
          ? `${Math.round(rectangle.width)} × ${Math.round(rectangle.height)}`
          : `${Math.round(length)} · ${Math.round(angle)}°`}
      </text>
    </g>
  );
}

export function App({ project: initialProject }: AppProps) {
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
  const {
    project,
    document,
    resolver,
    canUndo,
    canRedo,
    openDocument,
    replaceProject,
    transact: transactDocument,
  } = useDocumentController(
    initialProject ?? createEmptyProject("project-main", "New Circuit"),
    (nextProject) => recoveryScheduler.schedule(nextProject),
  );
  const [documentStack, setDocumentStack] = useState<string[]>([]);
  const {
    selection: visualSelection,
    replace: replaceSelection,
    replaceKind: replaceSelectionKind,
    selectOnly,
    selectInstance: updateInstanceSelection,
    clearKinds: clearSelectionKinds,
    reset: resetSelection,
  } = useSelectionController();
  const uniqueSuffixCounter = useRef(0);
  const [viewBox, setViewBox] = useState<Rect>(DEFAULT_VIEWBOX);
  const [status, setStatus] = useState("Ready");
  const [recoveryCandidate, setRecoveryCandidate] =
    useState<CircuitProject | null>(null);
  const [importDiagnostics, setImportDiagnostics] = useState<SpiceDiagnostic[]>(
    [],
  );
  const [boxPreview, setBoxPreview] = useState<BoxPreview | null>(null);
  const [panPreview, setPanPreview] = useState<PanPreview | null>(null);
  const [routeStretchPreview, setRouteStretchPreview] =
    useState<RouteStretchPreview | null>(null);
  const [draftingHandlePreview, setDraftingHandlePreview] =
    useState<DraftingHandlePreview | null>(null);
  const {
    state: interactionState,
    tool,
    pendingSymbolId,
    wireSource,
    wirePreviewPoint,
    wireWaypoints,
    draftingSource,
    draftingHover,
    draftingWaypoints,
    draftingSnapPoint,
    setTool,
    beginComponentPlacement,
    setWireSource,
    setWirePreviewPoint,
    setWireWaypoints,
    setDraftingSource,
    setDraftingHover,
    setDraftingWaypoints,
    setDraftingSnapPoint,
    clearDraftingCreate,
    cancelInteraction,
  } = useInteractionState();
  const [draftingInspectorSegment, setDraftingInspectorSegment] = useState<{
    objectId: string;
    index: number;
  } | null>(null);
  const [draftingTangentInput, setDraftingTangentInput] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const [draftingBearingInput, setDraftingBearingInput] = useState<{
    objectId: string;
    value: string;
  } | null>(null);
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
  const [helpOpen, setHelpOpen] = useState(false);
  const routeCounter = useRef(0);
  const canvasDragSessionRef = useRef<CanvasDragSession | null>(null);
  const instanceCounter = useRef(0);
  const clipboard = useRef<SchematicClipboard | null>(null);
  const pasteCounter = useRef(0);
  const suppressInstanceClick = useRef(false);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
  const documentViewBoxes = useRef(new Map<string, Rect>());
  const renderedDocument = useMemo(() => {
    if (!draftingHandlePreview || !document.drafting) return document;
    return {
      ...document,
      drafting: {
        ...document.drafting,
        objects: document.drafting.objects.map((object) =>
          object.id === draftingHandlePreview.objectId
            ? draftingHandlePreview.object
            : object,
        ),
      },
    };
  }, [document, draftingHandlePreview]);
  const scene = useMemo(
    () => buildSvgScene(renderedDocument, resolver, { bounds: viewBox }),
    [renderedDocument, resolver, viewBox],
  );
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
  const hasRotatableSelection =
    selectedIds.some((id) =>
      document.instances.some(
        (instance) => instance.id === id && instance.placement !== null,
      ),
    ) ||
    visualSelection.draftingIds.some((id) => {
      const object = document.drafting?.objects.find(
        (candidate) => candidate.id === id,
      );
      return (
        object?.kind === "arrow" ||
        object?.kind === "construction-line" ||
        object?.kind === "rectangle"
      );
    });
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
  const flightlines = useMemo(
    () => deriveFlightlines(document, resolver),
    [document, resolver],
  );
  const crossings = useMemo(
    () => deriveCrossings(document, resolver),
    [document, resolver],
  );
  const visualDiagnostics = useMemo(
    () => diagnoseVisualQuality(document, resolver),
    [document, resolver],
  );
  const structuralDiagnostics = visualDiagnostics.filter(
    (diagnostic) => diagnostic.category === "structural",
  );
  const visualObservations = visualDiagnostics.filter(
    (diagnostic) => diagnostic.category === "observation",
  );
  const visibleEndpoints: WireSource[] = useMemo(
    () => [
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
        .filter((junction) => {
          const role = junction.role ?? "branch";
          return role === "branch" || role === "route-anchor";
        })
        .map((junction): WireSource => ({
          endpoint: { kind: "junction", junctionId: junction.id },
          netId: junction.netId,
          point: junction.position,
          preludeEdits: [],
        })),
    ],
    [document, resolver],
  );
  const routePolylines = useMemo(
    () =>
      document.routes
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
        ),
    [document, resolver],
  );

  function junctionRouteDegree(junctionId: string): number {
    return document.routes.filter(
      (route) =>
        (route.from.kind === "junction" &&
          route.from.junctionId === junctionId) ||
        (route.to.kind === "junction" && route.to.junctionId === junctionId),
    ).length;
  }

  function isLooseRouteEndpoint(endpoint: RouteEndpoint): boolean {
    if (endpoint.kind !== "junction") return false;
    const junction = document.junctions.find(
      (candidate) => candidate.id === endpoint.junctionId,
    );
    if (!junction) return false;
    // Older GUI-created loose ends were stored with the implicit branch role.
    // Their degree still distinguishes them from a real electrical branch.
    return (
      junction.role === "route-anchor" ||
      ((junction.role ?? "branch") === "branch" &&
        junctionRouteDegree(junction.id) === 1)
    );
  }

  function looseRouteAnchorIds(
    route: SchematicDocument["routes"][number],
  ): [string, string] | null {
    if (
      route.from.kind !== "junction" ||
      route.to.kind !== "junction" ||
      route.from.junctionId === route.to.junctionId ||
      !isLooseRouteEndpoint(route.from) ||
      !isLooseRouteEndpoint(route.to)
    ) {
      return null;
    }
    return [route.from.junctionId, route.to.junctionId];
  }

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
    // The measured RichText bounds already follow the painted glyphs. Keep a
    // small tolerance for targeting, rather than a large logical rectangle
    // that steals nearby component and wire clicks.
    const padding = 0;
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
    return resolved ? instanceVisibleHitBox(instance, resolved) : null;
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
    const placement = defaultInstanceLabelPlacement(
      instance,
      resolved.definition,
      styleProfile,
    );
    if (!placement) return null;
    const position = placement.position;
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
      alignment: placement.alignment,
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
      ? buildManualWirePath(
          wireSource,
          { point: wirePreviewPoint },
          wireWaypoints,
        ).points
      : wireFixedPoints;
  const projectInstanceCount = project.documents.reduce(
    (count, candidate) => count + candidate.instances.length,
    0,
  );
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
    resetSelection();
    setSelectedRouteSegmentIndex(null);
    setTextEditing(null);
    setSelectedEndpoint(null);
    cancelInteraction();
  }

  function selectEndpoint(candidate: WireSource): void {
    setSelectedEndpoint(candidate);
    if (candidate.endpoint.kind === "junction") {
      selectOnly("junction", [candidate.endpoint.junctionId]);
    } else {
      resetSelection();
    }
  }

  function switchDocument(nextDocumentId: string): void {
    if (nextDocumentId === document.id) return;
    documentViewBoxes.current.set(document.id, viewBox);
    const nextDocument = openDocument(nextDocumentId);
    if (!nextDocument) {
      setStatus(`Document not found: ${nextDocumentId}`);
      return;
    }
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
    const nextDocument = replaceProject(nextProject);
    documentViewBoxes.current = new Map();
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
    replaceSelection({
      instanceIds,
      routeIds: routeId ? [routeId] : [],
      junctionIds: [],
      annotationIds: annotationId ? [annotationId] : [],
      draftingIds: [],
    });
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
    setStatus(
      result.applied
        ? `Committed revision ${result.revision}`
        : `Dry run for revision ${result.proposedRevision}`,
    );
  }

  function transact(edits: SchematicEdit[]): EditTransactionResult {
    const result = transactDocument(edits);
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
    if (nextTool !== "pointer") {
      replaceSelectionKind("route", []);
      setSelectedRouteSegmentIndex(null);
    }
    setStatus(
      nextTool === "wire"
        ? "Wire: choose a pin, junction, route segment, or blank grid point"
        : nextTool === "rectangle"
          ? "Rectangle: click the first corner"
          : nextTool === "arrow"
            ? "Arrow: click the start point"
            : nextTool === "construction-line"
              ? "Construction line: click the start point"
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
    const routed = buildManualWirePath(wireSource, candidate, wireWaypoints);
    edits.push({
      kind: "set_route_points",
      routeId: `route-ui-${suffix}`,
      netId,
      from: wireSource.endpoint,
      to: candidate.endpoint,
      waypoints: routed.waypoints,
      segmentModes: routed.segmentModes,
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
          role: "route-anchor",
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
    const fixed = buildManualWirePath(wireSource, { point }, wireWaypoints);
    // Keep the clicked point as an in-progress waypoint. The path builder
    // treats it as a fixed bend on the next click while retaining the source
    // terminal's escape segment.
    setWireWaypoints(fixed.points.slice(1));
    setWirePreviewPoint(point);
    setStatus(
      `Wire bend ${fixed.points.length - 1}; double-click or Enter to finish`,
    );
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
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    hitTarget: SVGElement = event.currentTarget,
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
    const svg = hitTarget.ownerSVGElement!;
    const pointer = pointFromClient(event.clientX, event.clientY, svg, false);
    const tap = resolveRouteTap(
      routeRecord.polyline.points,
      pointer,
      logicalRadiusForPixels(svg, 7),
    );
    if (tool === "pointer") {
      const segmentIndex = tap?.segmentIndex ?? 0;
      selectRoute(routeId, segmentIndex);
      beginRouteStretch(
        event,
        routeId,
        segmentIndex,
        looseRouteAnchorIds(routeRecord.route) !== null
          ? "translate"
          : "segment",
        hitTarget,
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

  function selectRoute(routeId: string, segmentIndex = 0): void {
    selectOnly("route", [routeId]);
    setSelectedRouteSegmentIndex(segmentIndex);
    setSelectedEndpoint(null);
    setStatus(`Selected route ${routeId}, segment ${segmentIndex + 1}`);
  }

  function removeSelectedRouteGeometry(): void {
    if (!selectedRouteId) return;
    const result = transact([
      { kind: "make_flightline", routeId: selectedRouteId },
    ]);
    if (result.ok) {
      replaceSelectionKind("route", []);
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
      replaceSelectionKind("route", []);
      setStatus(`Deleted electrical connection ${route.id}`);
    }
  }

  function beginRouteStretch(
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    segmentIndex: number,
    kind: "segment" | "translate" = "segment",
    hitTarget: SVGElement = event.currentTarget,
  ): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    canvasDragSessionRef.current?.cancel();
    const svg = hitTarget.ownerSVGElement!;
    const start = pointFromClient(event.clientX, event.clientY, svg, false);
    const record = routePolylines.find(
      (candidate) => candidate.route.id === routeId,
    );
    if (!record) return;
    const anchorIds =
      kind === "translate" ? (looseRouteAnchorIds(record.route) ?? []) : [];
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, [routeId, ...anchorIds]));
    const preview: RouteStretchPreview = {
      routeId,
      segmentIndex,
      kind,
      start,
      point: start,
    };
    setRouteStretchPreview(preview);
    canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: DRAG_START_DISTANCE_PX,
      onPreview: (client) => {
        const point = pointFromClient(client.x, client.y, svg, false);
        if (kind === "translate") {
          dragVisual().translate({
            x: point.x - start.x,
            y: point.y - start.y,
          });
          return;
        }
        try {
          const proposal = moveRouteSegment(
            record.polyline,
            segmentIndex,
            point,
          );
          dragVisual().setPolyline([
            record.polyline.points[0]!,
            ...proposal.waypoints,
            record.polyline.points.at(-1)!,
          ]);
        } catch {
          // Keep the last valid preview; commit reports the geometry error.
        }
      },
      onFinish: ({ client, dragged }) => {
        canvasDragSessionRef.current = null;
        visual?.restore();
        if (dragged) {
          completeRouteStretch(
            preview,
            pointFromClient(client.x, client.y, svg, false),
          );
        }
        setRouteStretchPreview(null);
      },
      onCancel: () => {
        canvasDragSessionRef.current = null;
        visual?.restore();
        setRouteStretchPreview(null);
      },
    });
  }

  function completeRouteStretch(
    preview: RouteStretchPreview,
    point: Point,
  ): void {
    const record = routePolylines.find(
      (candidate) => candidate.route.id === preview.routeId,
    );
    if (!record) return;
    try {
      if (preview.kind === "translate") {
        const anchorIds = looseRouteAnchorIds(record.route);
        if (!anchorIds) {
          throw new Error(
            "Only a route with two loose ends can move as a whole",
          );
        }
        const delta = {
          x: snap(point.x - preview.start.x, document.presentation.grid),
          y: snap(point.y - preview.start.y, document.presentation.grid),
        };
        if (delta.x !== 0 || delta.y !== 0) {
          const junctionEdits = anchorIds.map((junctionId): SchematicEdit => {
            const junction = document.junctions.find(
              (candidate) => candidate.id === junctionId,
            )!;
            return {
              kind: "move_junction",
              junctionId,
              position: {
                x: junction.position.x + delta.x,
                y: junction.position.y + delta.y,
              },
            };
          });
          const translatedPoints = record.polyline.points.map((routePoint) => ({
            x: routePoint.x + delta.x,
            y: routePoint.y + delta.y,
          }));
          const result = transact([
            ...junctionEdits,
            {
              kind: "set_route_points",
              routeId: record.route.id,
              netId: record.route.netId,
              from: record.route.from,
              to: record.route.to,
              waypoints: translatedPoints.slice(1, -1),
              segmentModes: record.route.segmentModes,
            },
          ]);
          if (result.ok) setStatus(`Moved loose route ${record.route.id}`);
        }
      } else {
        const proposal = moveRouteSegment(
          record.polyline,
          preview.segmentIndex,
          {
            x: snap(point.x, document.presentation.grid),
            y: snap(point.y, document.presentation.grid),
          },
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
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Route move failed");
    }
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
    event: ReactPointerEvent<SVGElement>,
    annotation: Annotation,
    hitTarget: SVGElement = event.currentTarget,
  ): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    selectOnly("annotation", [annotation.id]);
    setSelectedEndpoint(null);
    if (annotation.locked) {
      setStatus("Selected locked annotation");
      return;
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      setStatus(`Selected annotation ${annotation.id}`);
      return;
    }
    canvasDragSessionRef.current?.cancel();
    const svg = hitTarget.ownerSVGElement!;
    const pointerStart = pointFromClient(
      event.clientX,
      event.clientY,
      svg,
      false,
    );
    const preview: AnnotationDragPreview = {
      annotationId: annotation.id,
      originalPosition: { ...annotation.position },
      pointerStart,
    };
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, [annotation.id]));
    const positionAt = (clientX: number, clientY: number): Point => {
      const pointer = pointFromClient(clientX, clientY, svg, false);
      return {
        x: preview.originalPosition.x + pointer.x - preview.pointerStart.x,
        y: preview.originalPosition.y + pointer.y - preview.pointerStart.y,
      };
    };
    canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: DRAG_START_DISTANCE_PX,
      onPreview: (client) => {
        const position = positionAt(client.x, client.y);
        dragVisual().translate({
          x: position.x - preview.originalPosition.x,
          y: position.y - preview.originalPosition.y,
        });
      },
      onFinish: ({ client, dragged }) => {
        canvasDragSessionRef.current = null;
        visual?.restore();
        if (dragged) {
          completeAnnotationDrag(
            preview,
            constrainAnnotationPosition(
              annotation,
              positionAt(client.x, client.y),
            ),
          );
        }
      },
      onCancel: () => {
        canvasDragSessionRef.current = null;
        visual?.restore();
      },
    });
  }

  // Renderer defaults have no persisted object. A first click selects the
  // component without mutating the document; double-click makes the label
  // explicit and opens its editor. This prevents a label click from becoming
  // an accidental, persistent label drag.
  function selectDefaultInstanceLabel(
    event: ReactPointerEvent<SVGElement>,
    instance: SchematicDocument["instances"][number],
  ): void {
    event.stopPropagation();
    if (event.altKey) {
      const annotation = defaultInstanceLabel(instance);
      if (!annotation) return;
      const result = transact([{ kind: "upsert_annotation", annotation }]);
      if (result.ok) {
        selectOnly("annotation", [annotation.id]);
        setStatus(`Selected label ${annotation.id}; drag again to move`);
      }
      return;
    }
    selectInstance(instance.id, false);
    setStatus(`Selected ${instance.id}; double-click its label to edit`);
  }

  function editDefaultInstanceLabel(
    event: ReactMouseEvent<SVGRectElement>,
    instance: SchematicDocument["instances"][number],
  ): void {
    event.stopPropagation();
    const annotation = defaultInstanceLabel(instance);
    if (!annotation) return;
    const result = transact([{ kind: "upsert_annotation", annotation }]);
    if (result.ok) beginAnnotationTextEditing(annotation);
  }

  function completeAnnotationDrag(
    preview: AnnotationDragPreview,
    position: Point,
  ): void {
    const annotation = document.annotations.find(
      (candidate) => candidate.id === preview.annotationId,
    );
    if (!annotation) return;
    let offset = { ...annotation.offset };
    let routeAttachment = annotation.routeAttachment;
    // For a route-marker the route attachment lives on its VisualAnchor; the
    // drag re-resolves segmentIndex/t while preserving direction/offset.
    let anchor = annotation.anchor;
    const currentAttachment = effectiveRouteAttachment(annotation);
    if (isRoutedMarker(annotation) && currentAttachment) {
      const attached = attachmentAtPoint(
        position,
        currentAttachment.routeId,
        currentAttachment.normalOffset,
      );
      if (attached) {
        if (annotation.kind === "route-marker" && anchor?.kind === "route") {
          anchor = {
            ...anchor,
            segmentIndex: attached.routeAttachment.segmentIndex,
            t: attached.routeAttachment.t,
            fallbackPosition: position,
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
          x: position.x - instance.placement.position.x,
          y: position.y - instance.placement.position.y,
        };
      }
    }
    transact([
      {
        kind: "upsert_annotation",
        annotation: {
          ...annotation,
          position,
          offset,
          ...(routeAttachment ? { routeAttachment } : {}),
          ...(anchor ? { anchor } : {}),
        },
      },
    ]);
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

  function handleCanvasHitPointerDown(
    event: ReactPointerEvent<SVGSVGElement>,
  ): void {
    if (tool !== "pointer" || event.button !== 0) return;
    if (
      (event.target as Element).closest(".draft-handle, .route-handle, .guide")
    ) {
      return;
    }
    const hit = resolveCanvasHitAtPoint(
      event.currentTarget.ownerDocument,
      { x: event.clientX, y: event.clientY },
      event.altKey ? 1 : 0,
    );
    if (!hit || hit.kind === "handle") return;
    const hitTarget = hit.element as SVGElement;
    event.preventDefault();
    event.stopPropagation();

    if (hit.kind === "instance") {
      beginMove(event, hit.id, hitTarget);
      return;
    }
    if (hit.kind === "instance-label") {
      const instance = document.instances.find(
        (candidate) => candidate.id === hit.id,
      );
      if (instance) selectDefaultInstanceLabel(event, instance);
      return;
    }
    if (hit.kind === "annotation") {
      const annotation = document.annotations.find(
        (candidate) => candidate.id === hit.id,
      );
      if (annotation) beginAnnotationDrag(event, annotation, hitTarget);
      return;
    }
    if (hit.kind === "route") {
      handleRoutePointerDown(event, hit.id, hitTarget);
      return;
    }
    if (hit.kind === "drafting") {
      const object = document.drafting?.objects.find(
        (candidate) => candidate.id === hit.id,
      );
      if (object) beginDraftingDrag(event, object, hitTarget);
      return;
    }
    const endpoint = visibleEndpoints.find(
      (candidate) =>
        candidate.endpoint.kind === "junction" &&
        candidate.endpoint.junctionId === hit.id,
    );
    if (endpoint) {
      selectEndpoint(endpoint);
      setStatus(`Selected ${endpointTestId(endpoint.endpoint)}`);
    }
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
    selectOnly("instance", [instanceId]);
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
      selectOnly("instance", [id]);
      cancelInteraction();
      setStatus(`Added ${id} (${symbolId})`);
    }
  }

  function selectInstance(instanceId: string, additive: boolean): void {
    setSelectedEndpoint(null);
    updateInstanceSelection(instanceId, additive);
  }

  function beginMove(
    event: ReactPointerEvent<SVGElement>,
    instanceId: string,
    hitTarget: SVGElement = event.currentTarget,
  ): void {
    if (tool !== "pointer" || event.button !== 0) return;
    event.stopPropagation();
    const instance = document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    if (!instance?.placement) {
      return;
    }
    const hasSelectionModifier =
      event.shiftKey || event.ctrlKey || event.metaKey;
    suppressInstanceClick.current = true;
    if (hasSelectionModifier) {
      selectInstance(instanceId, hasSelectionModifier);
      setStatus(`Selected ${instanceId}`);
      return;
    }
    const movingIds = selectedIds.includes(instanceId)
      ? selectedIds
      : [instanceId];
    if (!selectedIds.includes(instanceId)) selectInstance(instanceId, false);
    canvasDragSessionRef.current?.cancel();
    const svg = hitTarget.ownerSVGElement!;
    const pointerStart = pointFromClient(
      event.clientX,
      event.clientY,
      svg,
      false,
    );
    const preview: DragPreview = {
      instanceIds: movingIds,
      originalPositions: Object.fromEntries(
        movingIds.map((id) => {
          const candidate = document.instances.find((item) => item.id === id)!;
          return [id, { ...candidate.placement!.position }];
        }),
      ),
      pointerStart,
    };
    const attachedAnnotationIds = document.annotations
      .filter(
        (annotation) =>
          annotation.attachedObjectId !== undefined &&
          movingIds.includes(annotation.attachedObjectId),
      )
      .map((annotation) => annotation.id);
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, [
        ...movingIds,
        ...attachedAnnotationIds,
      ]));
    canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: DRAG_START_DISTANCE_PX,
      onPreview: (client) => {
        const position = pointFromClient(client.x, client.y, svg, false);
        const { moves } = instanceMoveAt(preview, position, false);
        const first = moves[0]!;
        const original = preview.originalPositions[first.instanceId]!;
        dragVisual().translate({
          x: first.position.x - original.x,
          y: first.position.y - original.y,
        });
      },
      onFinish: ({ client, dragged }) => {
        canvasDragSessionRef.current = null;
        visual?.restore();
        if (dragged) {
          completeInstanceMove(
            preview,
            pointFromClient(client.x, client.y, svg, false),
          );
        }
      },
      onCancel: () => {
        canvasDragSessionRef.current = null;
        visual?.restore();
      },
    });
  }

  function instanceMoveAt(
    preview: DragPreview,
    position: Point,
    commitSnap: boolean,
  ) {
    const rawDelta = {
      x: position.x - preview.pointerStart.x,
      y: position.y - preview.pointerStart.y,
    };
    const unsnappedMoves = preview.instanceIds.map((instanceId) => {
      const original = preview.originalPositions[instanceId]!;
      return {
        instanceId,
        position: {
          x: original.x + rawDelta.x,
          y: original.y + rawDelta.y,
        },
      };
    });
    if (!commitSnap) return { directSnap: null, moves: unsnappedMoves };
    const first = unsnappedMoves[0]!;
    const grid = document.presentation.grid;
    const correction = {
      x: snap(first.position.x, grid) - first.position.x,
      y: snap(first.position.y, grid) - first.position.y,
    };
    const gridMoves = unsnappedMoves.map((move) => ({
      ...move,
      position: {
        x: move.position.x + correction.x,
        y: move.position.y + correction.y,
      },
    }));
    const directSnap = directPinSnap(gridMoves);
    return { directSnap, moves: directSnap?.moves ?? gridMoves };
  }

  function completeInstanceMove(preview: DragPreview, position: Point): void {
    const { directSnap, moves } = instanceMoveAt(preview, position, true);
    const delta = {
      x:
        moves[0]!.position.x -
        preview.originalPositions[moves[0]!.instanceId]!.x,
      y:
        moves[0]!.position.y -
        preview.originalPositions[moves[0]!.instanceId]!.y,
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
              object: {
                ...object,
                from,
                to,
                waypoints: object.waypoints?.map(
                  (point) =>
                    rotateFreePoint(
                      { kind: "free", position: point },
                      pivot,
                      deltaDegrees,
                    ).position,
                ),
                curveControls: object.curveControls?.map((point) =>
                  point
                    ? rotateFreePoint(
                        { kind: "free", position: point },
                        pivot,
                        deltaDegrees,
                      ).position
                    : null,
                ),
              },
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
          const curveControls = object.curveControls?.map((point) =>
            point
              ? rotateFreePoint(
                  { kind: "free", position: point },
                  pivot,
                  deltaDegrees,
                ).position
              : null,
          );
          return [
            {
              kind: "upsert_drafting_object",
              object: { ...object, points, curveControls },
            },
          ];
        }
        if (object.kind === "rectangle") {
          return [
            {
              kind: "upsert_drafting_object",
              object: {
                ...object,
                rotation:
                  (((object.rotation + deltaDegrees) % 360) + 360) % 360,
              },
            },
          ];
        }
        return [];
      },
    );
    const edits = [...instanceEdits, ...draftingEdits];
    if (edits.length > 0) transact(edits);
  }

  function mirrorSelected(direction: ScreenFlip = "left-right"): void {
    const edits = selectedIds.flatMap((id): SchematicEdit[] => {
      const instance = document.instances.find(
        (candidate) => candidate.id === id,
      );
      if (!instance?.placement) return [];
      const orientation = reflectOrientation(instance.placement, direction);
      return [
        {
          kind: "mirror_instance",
          instanceId: instance.id,
          mirror: orientation.mirror,
        },
        ...(orientation.rotation === instance.placement.rotation
          ? []
          : [
              {
                kind: "rotate_instance" as const,
                instanceId: instance.id,
                rotation: orientation.rotation,
              },
            ]),
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
    selectOnly("drafting", [id]);
    setDraftingInspectorSegment(null);
    setDraftingTangentInput(null);
    setDraftingBearingInput(null);
  }

  function draftingDragOrigin(object: DraftingObject): Point | null {
    if (object.kind === "construction-line") return object.points[0] ?? null;
    if (object.kind === "rectangle") return object.center;
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
        curveControls: object.curveControls?.map((point) =>
          point
            ? {
                x: Math.round(point.x + delta.x),
                y: Math.round(point.y + delta.y),
              }
            : null,
        ),
      };
    }
    if (object.kind === "arrow") {
      return {
        ...object,
        anchor: moveFreeAnchor(object.anchor),
        from: moveFreeAnchor(object.from),
        to: moveFreeAnchor(object.to),
        waypoints: object.waypoints?.map((point) => ({
          x: Math.round(point.x + delta.x),
          y: Math.round(point.y + delta.y),
        })),
        curveControls: object.curveControls?.map((point) =>
          point
            ? {
                x: Math.round(point.x + delta.x),
                y: Math.round(point.y + delta.y),
              }
            : null,
        ),
      };
    }
    if (object.kind === "rectangle") {
      const center = {
        x: Math.round(object.center.x + delta.x),
        y: Math.round(object.center.y + delta.y),
      };
      return {
        ...object,
        center,
        anchor: { kind: "free", position: center },
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
    hitTarget: SVGElement = event.currentTarget,
  ): void {
    if (event.button !== 0 || object.locked) return;
    const origin = draftingDragOrigin(object);
    if (!origin) {
      selectDraftingObject(object.id);
      setStatus("This anchored drawing moves with its attachment");
      return;
    }
    event.stopPropagation();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      selectDraftingObject(object.id);
      setStatus(`Selected drawing ${object.id}`);
      return;
    }
    canvasDragSessionRef.current?.cancel();
    const svg = hitTarget.ownerSVGElement!;
    const start = pointFromClient(event.clientX, event.clientY, svg, false);
    const original = { ...origin };
    selectDraftingObject(object.id);
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, [object.id]));
    const positionAt = (
      clientX: number,
      clientY: number,
      commitSnap: boolean,
    ): Point => {
      const point = pointFromClient(clientX, clientY, svg, false);
      const raw = {
        x: original.x + point.x - start.x,
        y: original.y + point.y - start.y,
      };
      if (!commitSnap) return raw;
      const grid = document.presentation.grid;
      return { x: snap(raw.x, grid), y: snap(raw.y, grid) };
    };
    canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: DRAG_START_DISTANCE_PX,
      onPreview: (client) => {
        const position = positionAt(client.x, client.y, false);
        dragVisual().translate({
          x: position.x - original.x,
          y: position.y - original.y,
        });
      },
      onFinish: ({ client, dragged }) => {
        canvasDragSessionRef.current = null;
        visual?.restore();
        if (dragged) {
          const position = positionAt(client.x, client.y, true);
          const latest = document.drafting?.objects.find(
            (item) => item.id === object.id,
          );
          if (
            latest &&
            (position.x !== original.x || position.y !== original.y)
          ) {
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
      },
      onCancel: () => {
        canvasDragSessionRef.current = null;
        visual?.restore();
      },
    });
  }

  // Drag a single endpoint (arrow from/to) or vertex (construction-line index).
  // Mirrors beginDraftingDrag's session discipline (cancel on Escape, commit
  // once on pointerup from the ref) but mutates only the named handle, leaving
  // the rest of the object's geometry in place. The arrow head always rides the
  // tip because the renderer derives it from `to`.
  function beginDraftingHandleDrag(
    event: ReactPointerEvent<SVGElement>,
    object: DraftingObject,
    handle:
      | { kind: "from" | "to" }
      | {
          kind: "waypoint" | "vertex" | "curve" | "rectangle-corner";
          index: number;
        },
  ): void {
    if (event.button !== 0 || object.locked) return;
    event.stopPropagation();
    canvasDragSessionRef.current?.cancel();
    const hitTarget = event.currentTarget;
    const svg = hitTarget.ownerSVGElement!;
    const originalGeometry = resolveDraftingObjectGeometry(
      document,
      resolver,
      object,
    );
    if (handle.kind === "curve") {
      setDraftingInspectorSegment({ objectId: object.id, index: handle.index });
      setDraftingTangentInput(null);
    }
    selectDraftingObject(object.id);

    const applyHandle = (
      target: DraftingObject,
      point: Point,
    ): DraftingObject => {
      if (target.kind === "arrow") {
        if (handle.kind === "waypoint") {
          const waypoints = [...(target.waypoints ?? [])];
          waypoints[handle.index] = point;
          return { ...target, waypoints };
        }
        if (handle.kind === "curve" && originalGeometry.kind === "arrow") {
          const controls = Array.from(
            { length: originalGeometry.points.length - 1 },
            (_, index) => target.curveControls?.[index] ?? null,
          );
          controls[handle.index] = controlForQuadraticMidpoint(
            originalGeometry.points[handle.index]!,
            point,
            originalGeometry.points[handle.index + 1]!,
          );
          return { ...target, curveControls: controls };
        }
        if (handle.kind === "vertex") return target;
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
      if (
        target.kind === "construction-line" &&
        handle.kind === "curve" &&
        originalGeometry.kind === "construction-line"
      ) {
        const controls = Array.from(
          { length: originalGeometry.points.length - 1 },
          (_, index) => target.curveControls?.[index] ?? null,
        );
        controls[handle.index] = controlForQuadraticMidpoint(
          originalGeometry.points[handle.index]!,
          point,
          originalGeometry.points[handle.index + 1]!,
        );
        return { ...target, curveControls: controls };
      }
      if (
        target.kind === "rectangle" &&
        handle.kind === "rectangle-corner" &&
        originalGeometry.kind === "rectangle"
      ) {
        const opposite = originalGeometry.corners[(handle.index + 2) % 4]!;
        const radians = (target.rotation * Math.PI) / 180;
        const ux = { x: Math.cos(radians), y: Math.sin(radians) };
        const uy = { x: -Math.sin(radians), y: Math.cos(radians) };
        const delta = { x: point.x - opposite.x, y: point.y - opposite.y };
        const localWidth = delta.x * ux.x + delta.y * ux.y;
        const localHeight = delta.x * uy.x + delta.y * uy.y;
        const center = {
          x: Math.round(
            opposite.x + (localWidth * ux.x + localHeight * uy.x) / 2,
          ),
          y: Math.round(
            opposite.y + (localWidth * ux.y + localHeight * uy.y) / 2,
          ),
        };
        return {
          ...target,
          center,
          anchor: { kind: "free", position: center },
          width: Math.max(1, Math.round(Math.abs(localWidth))),
          height: Math.max(1, Math.round(Math.abs(localHeight))),
        };
      }
      return target;
    };
    canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: DRAG_START_DISTANCE_PX,
      onPreview: (client) => {
        const point = snapDraftingPoint(
          pointFromClient(client.x, client.y, svg),
          event.altKey,
          event.shiftKey,
        ).point;
        setDraftingHandlePreview({
          objectId: object.id,
          object: applyHandle(object, point),
        });
      },
      onFinish: ({ client, dragged }) => {
        canvasDragSessionRef.current = null;
        if (dragged) {
          const point = snapDraftingPoint(
            pointFromClient(client.x, client.y, svg),
            event.altKey,
            event.shiftKey,
          ).point;
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
        setDraftingHandlePreview(null);
      },
      onCancel: () => {
        canvasDragSessionRef.current = null;
        setDraftingHandlePreview(null);
      },
    });
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
    const curveControls = object.curveControls
      ? [...object.curveControls]
      : undefined;
    // An explicit vertex is a straightening operation for the selected
    // segment. It avoids silently reinterpreting a Bézier control after the
    // segment count changes.
    if (curveControls) curveControls.splice(bestIndex - 1, 1, null, null);
    transact([
      {
        kind: "upsert_drafting_object",
        object: { ...object, points, curveControls },
      },
    ]);
    setStatus(`Inserted vertex ${bestIndex}`);
  }

  // Free arrows share the same midpoint editing model as construction lines.
  // The inserted point is deliberately a waypoint, never an endpoint anchor:
  // an attached arrow endpoint therefore remains attached after reshaping.
  function insertArrowWaypoint(
    object: Extract<DraftingObject, { kind: "arrow" }>,
    point: Point,
  ): void {
    if (object.locked) return;
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    if (geometry.kind !== "arrow") return;
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < geometry.points.length - 1; index += 1) {
      const on = closestPointOnSegment(
        point,
        geometry.points[index]!,
        geometry.points[index + 1]!,
      );
      const distance = (on.x - point.x) ** 2 + (on.y - point.y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    const waypoints = [...(object.waypoints ?? [])];
    waypoints.splice(bestIndex, 0, point);
    const curveControls = object.curveControls
      ? [...object.curveControls]
      : undefined;
    if (curveControls) curveControls.splice(bestIndex, 1, null, null);
    transact([
      {
        kind: "upsert_drafting_object",
        object: { ...object, waypoints, curveControls },
      },
    ]);
    setStatus(`Inserted arrow bend ${bestIndex + 1}`);
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
    const { curveControls: _curveControls, ...straightObject } = object;
    transact([
      { kind: "upsert_drafting_object", object: { ...straightObject, points } },
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
        (object.kind !== "arrow" &&
          object.kind !== "construction-line" &&
          object.kind !== "rectangle")
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

  function setDraftingTangentAngle(angleDegrees: number): void {
    if (
      !selectedDrafting ||
      selectedDrafting.locked ||
      (selectedDrafting.kind !== "arrow" &&
        selectedDrafting.kind !== "construction-line") ||
      !Number.isFinite(angleDegrees)
    ) {
      return;
    }
    const geometry = resolveDraftingObjectGeometry(
      document,
      resolver,
      selectedDrafting,
    );
    if (geometry.kind !== selectedDrafting.kind) return;
    const index =
      draftingInspectorSegment?.objectId === selectedDrafting.id
        ? draftingInspectorSegment.index
        : Math.max(0, geometry.curveControls.findIndex(Boolean));
    if (index >= geometry.points.length - 1) return;
    const curveControls = [...geometry.curveControls];
    curveControls[index] = controlForTangentAngle(
      geometry.points[index]!,
      geometry.points[index + 1]!,
      angleDegrees,
      curveControls[index] ?? null,
    );
    transact([
      {
        kind: "upsert_drafting_object",
        object: { ...selectedDrafting, curveControls },
      },
    ]);
  }

  function setDraftingBearing(bearingDegrees: number): void {
    if (
      !selectedDrafting ||
      selectedDrafting.locked ||
      (selectedDrafting.kind !== "arrow" &&
        selectedDrafting.kind !== "construction-line" &&
        selectedDrafting.kind !== "rectangle") ||
      !Number.isFinite(bearingDegrees)
    ) {
      return;
    }
    const geometry = resolveDraftingObjectGeometry(
      document,
      resolver,
      selectedDrafting,
    );
    if (selectedDrafting.kind === "rectangle") {
      const rotation = ((bearingDegrees % 360) + 360) % 360;
      transact([
        {
          kind: "upsert_drafting_object",
          object: { ...selectedDrafting, rotation },
        },
      ]);
      return;
    }
    if (
      (geometry.kind !== "arrow" && geometry.kind !== "construction-line") ||
      geometry.points.length < 2
    ) {
      return;
    }
    const currentBearing = normalizedBearing(
      geometry.points[0]!,
      geometry.points[1]!,
    );
    const targetBearing = ((bearingDegrees % 360) + 360) % 360;
    const delta = ((targetBearing - currentBearing + 540) % 360) - 180;
    if (selectedDrafting.kind === "arrow") {
      if (
        geometry.kind !== "arrow" ||
        selectedDrafting.from.kind !== "free" ||
        selectedDrafting.to.kind !== "free"
      ) {
        setStatus(
          "An attached arrow cannot rotate without detaching its endpoints",
        );
        return;
      }
      const pivot = geometry.center;
      const from = {
        ...selectedDrafting.from,
        position: rotatePointByDegrees(
          selectedDrafting.from.position,
          pivot,
          delta,
        ),
      };
      const to = {
        ...selectedDrafting.to,
        position: rotatePointByDegrees(
          selectedDrafting.to.position,
          pivot,
          delta,
        ),
      };
      transact([
        {
          kind: "upsert_drafting_object",
          object: {
            ...selectedDrafting,
            from,
            to,
            waypoints: selectedDrafting.waypoints?.map((point) =>
              rotatePointByDegrees(point, pivot, delta),
            ),
            curveControls: selectedDrafting.curveControls?.map((point) =>
              point ? rotatePointByDegrees(point, pivot, delta) : null,
            ),
          },
        },
      ]);
      return;
    }
    if (geometry.kind !== "construction-line") return;
    const pivot = centerOfBounds(geometry.bounds);
    transact([
      {
        kind: "upsert_drafting_object",
        object: {
          ...selectedDrafting,
          points: selectedDrafting.points.map((point) =>
            rotatePointByDegrees(point, pivot, delta),
          ),
          curveControls: selectedDrafting.curveControls?.map((point) =>
            point ? rotatePointByDegrees(point, pivot, delta) : null,
          ),
        },
      },
    ]);
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
    uniqueSuffixCounter.current += 1;
    const id = `note-${uniqueSuffixCounter.current}`;
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
      typographyToken: "label",
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
    uniqueSuffixCounter.current += 1;
    const id = `construction-${uniqueSuffixCounter.current}`;
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
    uniqueSuffixCounter.current += 1;
    const id = `arrow-${uniqueSuffixCounter.current}`;
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
    uniqueSuffixCounter.current += 1;
    const id = `floating-${uniqueSuffixCounter.current}`;
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
    uniqueSuffixCounter.current += 1;
    const id = `current-${uniqueSuffixCounter.current}`;
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
      selectOnly("annotation", [id]);
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
      replaceSelectionKind("annotation", [labelId]);
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
    selectOnly("annotation", [annotation.id]);
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
      clearSelectionKinds(["annotation", "drafting"]);
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
    const id = `guide-${++uniqueSuffixCounter.current}`;
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
    if (guide.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    canvasDragSessionRef.current?.cancel();
    const target = event.currentTarget;
    const svg = target.ownerSVGElement;
    if (!svg) return;
    const original = {
      x1: target.getAttribute("x1"),
      x2: target.getAttribute("x2"),
      y1: target.getAttribute("y1"),
      y2: target.getAttribute("y2"),
    };
    const restore = (): void => {
      for (const [name, value] of Object.entries(original)) {
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }
    };
    const coordinateAt = (
      clientX: number,
      clientY: number,
      commitSnap: boolean,
    ): number => {
      const point = pointFromClient(clientX, clientY, svg, commitSnap);
      return guide.axis === "vertical" ? point.x : point.y;
    };
    canvasDragSessionRef.current = startCanvasDragSession({
      target,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: DRAG_START_DISTANCE_PX,
      onPreview: (client) => {
        const coordinate = coordinateAt(client.x, client.y, false);
        if (guide.axis === "vertical") {
          target.setAttribute("x1", String(coordinate));
          target.setAttribute("x2", String(coordinate));
        } else {
          target.setAttribute("y1", String(coordinate));
          target.setAttribute("y2", String(coordinate));
        }
      },
      onFinish: ({ client, dragged }) => {
        canvasDragSessionRef.current = null;
        restore();
        if (!dragged) return;
        const current = document.drafting?.guides.find(
          (candidate) => candidate.id === guide.id,
        );
        if (!current) return;
        transact([
          {
            kind: "set_guide",
            guide: {
              ...current,
              coordinate: coordinateAt(client.x, client.y, true),
            },
          },
        ]);
      },
      onCancel: () => {
        canvasDragSessionRef.current = null;
        restore();
      },
    });
  }

  function deleteSelectedAnnotation(): void {
    if (!selectedAnnotation) return;
    const result = transact([
      { kind: "remove_annotation", annotationId: selectedAnnotation.id },
    ]);
    if (result.ok) replaceSelectionKind("annotation", []);
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
    if (
      tool === "construction-line" ||
      tool === "arrow" ||
      tool === "rectangle"
    )
      return;
    if (tool === "guide") {
      // ADR 0010: clicking with the Guide tool adds a vertical guide at the
      // click x (the toolbar offers horizontal/vertical and clear/lock
      // actions). Guides are editor aids; they never enter formal export.
      const id = `guide-${++uniqueSuffixCounter.current}`;
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
      (tool === "arrow" ||
        tool === "construction-line" ||
        tool === "rectangle") &&
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
            .filter((object) => {
              const geometry = resolveDraftingObjectGeometry(
                document,
                resolver,
                object,
              );
              return geometry.kind === "rectangle"
                ? rectangleBoundaryIntersectsRect(geometry.corners, rect)
                : rectsIntersect(geometry.bounds, rect);
            })
            .map((object) => object.id),
        };
    replaceSelection({
      instanceIds: ids,
      ...supplemental,
    });
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
        } else if (geometry.kind === "rectangle") {
          for (const corner of geometry.corners) consider(corner);
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

  // Handle a canvas click while the Arrow / Construction line tool is active.
  // Mirrors the wire tool's click model: first click fixes the start (and a snap
  // candidate), hover updates the preview, the next click commits. Construction
  // lines append a vertex per intermediate click; arrows commit on click #2.
  function handleDraftingCanvasClick(
    rawPoint: Point,
    altKey: boolean,
    shiftKey: boolean,
  ): void {
    if (
      tool !== "arrow" &&
      tool !== "construction-line" &&
      tool !== "rectangle"
    )
      return;
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
          : tool === "rectangle"
            ? "Rectangle: click the opposite corner (Esc to cancel)"
            : "Construction line: click next vertex (Enter to finish, Esc to cancel)",
      );
      return;
    }
    if (tool === "arrow" || tool === "rectangle") {
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
    if (
      tool !== "arrow" &&
      tool !== "construction-line" &&
      tool !== "rectangle"
    )
      return;
    if (draftingSource === null) return;
    const end = draftingHover ?? draftingSource;
    if (tool === "arrow" || tool === "rectangle") {
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
    uniqueSuffixCounter.current += 1;
    if (activeTool === "construction-line") {
      const id = `construction-${uniqueSuffixCounter.current}`;
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
      const id = `arrow-${uniqueSuffixCounter.current}`;
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
    } else if (activeTool === "rectangle") {
      const width = Math.round(Math.abs(end.x - start.x));
      const height = Math.round(Math.abs(end.y - start.y));
      if (width < 1 || height < 1) {
        setStatus("Rectangle needs non-zero width and height");
        return;
      }
      const id = `rectangle-${uniqueSuffixCounter.current}`;
      const center = {
        x: Math.round((start.x + end.x) / 2),
        y: Math.round((start.y + end.y) / 2),
      };
      const result = transact([
        {
          kind: "upsert_drafting_object",
          object: {
            id,
            kind: "rectangle",
            locked: false,
            zIndex: 0,
            anchor: { kind: "free", position: center },
            center,
            width,
            height,
            rotation: 0,
            lineStyle: "solid",
          },
        },
      ]);
      if (result.ok) setStatus(`Added rectangle ${id}`);
    }
    setTool("pointer");
  }

  // Commit a multi-vertex construction line from the two-phase click model.
  function commitDraftingCreateVertices(points: Point[]): void {
    if (points.length < 2) return;
    uniqueSuffixCounter.current += 1;
    const id = `construction-${uniqueSuffixCounter.current}`;
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
    const initialRouteIds = new Set(visualSelection.routeIds);
    const selectedAnnotationIds = new Set(visualSelection.annotationIds);
    const selectedDraftingIds = new Set(visualSelection.draftingIds);
    const selectedJunctionIds = new Set([
      ...visualSelection.junctionIds,
      ...(selectedEndpoint?.endpoint.kind === "junction"
        ? [selectedEndpoint.endpoint.junctionId]
        : []),
    ]);
    const hasMixedSelection =
      initialRouteIds.size > 0 ||
      selectedAnnotationIds.size > 0 ||
      selectedDraftingIds.size > 0 ||
      selectedJunctionIds.size > 0;
    if (
      initialRouteIds.size === 1 &&
      selectedAnnotationIds.size === 0 &&
      selectedDraftingIds.size === 0 &&
      selectedJunctionIds.size === 0 &&
      selectedIds.length === 0 &&
      !document.routes.some(
        (route) =>
          initialRouteIds.has(route.id) &&
          (route.from.kind === "junction" || route.to.kind === "junction"),
      )
    ) {
      deleteSelectedRouteConnection();
      return;
    }
    if (hasMixedSelection) {
      const visualRouteDeletion = collectVisualRouteDeletion(
        document,
        [...initialRouteIds],
        [...selectedJunctionIds],
      );
      uniqueSuffixCounter.current += 1;
      try {
        const instanceEdits =
          selectedIds.length > 0
            ? proposeConnectedInstanceDeletion(
                document,
                resolver,
                selectedIds,
                uniqueSuffixCounter.current,
              )
            : [];
        const removesEveryRoute =
          document.routes.length > 0 &&
          visualRouteDeletion.routeIds.length === document.routes.length;
        const temporaryJunctionIds = removesEveryRoute
          ? instanceEdits.flatMap((edit) =>
              edit.kind === "add_junction" ? [edit.junctionId] : [],
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
          ...visualRouteDeletion.routeIds.map((routeId): SchematicEdit => ({
            kind: "make_flightline",
            routeId,
          })),
          ...[
            ...new Set([
              ...visualRouteDeletion.junctionIds,
              ...temporaryJunctionIds,
            ]),
          ].map((junctionId): SchematicEdit => ({
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
          resetSelection();
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
        replaceSelectionKind("drafting", []);
        setStatus(`Deleted drafting object ${selectedDraftingId}`);
      }
      return;
    }
    if (selectedRouteId) {
      deleteSelectedRouteConnection();
      return;
    }
    if (selectedIds.length === 0) return;
    uniqueSuffixCounter.current += 1;
    try {
      const result = transact(
        proposeConnectedInstanceDeletion(
          document,
          resolver,
          selectedIds,
          uniqueSuffixCounter.current,
        ),
      );
      if (result.ok) {
        replaceSelectionKind("instance", []);
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
      selectOnly("instance", proposal.instanceIds);
      setStatus(`Pasted ${proposal.instanceIds.length} components`);
    }
  }

  useEffect(() => {
    function dismissOnOutsidePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const targetElement =
        target instanceof Element ? target : target.parentElement;
      if (
        textEditing &&
        !targetElement?.closest('[data-testid="canvas-text-editor"]')
      ) {
        setTextEditing(null);
      }
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
  }, [textEditing]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && dismissOpenCommandMenus()) {
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" && textEditing) {
        event.preventDefault();
        setTextEditing(null);
        setStatus("Cancelled text editing");
        return;
      }
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const plainShortcut = !event.ctrlKey && !event.metaKey && !event.altKey;
      if (plainShortcut && key === "u") {
        event.preventDefault();
        transact([{ kind: event.shiftKey ? "redo" : "undo" }]);
      } else if (event.ctrlKey && key === "z") {
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
        replaceSelection({
          instanceIds: document.instances
            .filter((instance) => instance.placement)
            .map((instance) => instance.id),
          routeIds: document.routes.map((route) => route.id),
          junctionIds: document.junctions.map((junction) => junction.id),
          annotationIds: document.annotations.map(
            (annotation) => annotation.id,
          ),
          draftingIds: (document.drafting?.objects ?? []).map(
            (object) => object.id,
          ),
        });
        setSelectedEndpoint(null);
      } else if (
        plainShortcut &&
        key === "x" &&
        selectedAnnotation &&
        isRoutedMarker(selectedAnnotation)
      ) {
        event.preventDefault();
        reverseSelectedCurrentArrow();
      } else if (plainShortcut && key === "r") {
        event.preventDefault();
        if (event.shiftKey) {
          rotateSelected(-90);
        } else if (hasRotatableSelection) {
          rotateSelected(90);
        } else {
          activateTool("rectangle");
        }
      } else if (plainShortcut && key === "w") {
        event.preventDefault();
        activateTool("wire");
      } else if (plainShortcut && key === "t") {
        event.preventDefault();
        addPlainText();
      } else if (plainShortcut && key === "a") {
        event.preventDefault();
        activateTool("arrow");
      } else if (plainShortcut && key === "l") {
        event.preventDefault();
        activateTool("construction-line");
      } else if (plainShortcut && key === "g") {
        event.preventDefault();
        activateTool("guide");
      } else if (plainShortcut && key === "f") {
        event.preventDefault();
        mirrorSelected(event.shiftKey ? "top-bottom" : "left-right");
      } else if (plainShortcut && key === "home") {
        event.preventDefault();
        fitView();
      } else if (
        plainShortcut &&
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
        (tool === "arrow" ||
          tool === "construction-line" ||
          tool === "rectangle") &&
        draftingSource !== null
      ) {
        event.preventDefault();
        finishDraftingCreate();
      } else if (event.key === "Escape") {
        if (helpOpen) {
          closeHelp();
          return;
        }
        if (canvasDragSessionRef.current) {
          canvasDragSessionRef.current.cancel();
          setStatus("Cancelled canvas drag");
          return;
        }
        if (interactionState.kind !== "idle") {
          cancelInteraction();
          setBoxPreview(null);
          setStatus(
            interactionState.kind === "drawing"
              ? "Drawing cancelled"
              : "Cancelled active tool",
          );
          return;
        }
        if (
          selectedDrafting &&
          (selectedDrafting.kind === "arrow" ||
            selectedDrafting.kind === "construction-line" ||
            selectedDrafting.kind === "rectangle")
        ) {
          replaceSelectionKind("drafting", []);
          setStatus("Cleared drawing selection");
          return;
        }
        setBoxPreview(null);
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
        <nav
          className="toolbar"
          aria-label="Editor commands"
          onClick={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest(".command-popover button")
            ) {
              dismissOpenCommandMenus();
            }
          }}
        >
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
              <button type="button" aria-label="Text" onClick={addPlainText}>
                Text (T)
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
              <button
                type="button"
                aria-pressed={tool === "rectangle"}
                onClick={() => activateTool("rectangle")}
              >
                Rectangle (R)
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
                disabled={!canUndo}
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => transact([{ kind: "redo" }])}
                disabled={!canRedo}
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
                onClick={() => mirrorSelected("left-right")}
                disabled={selectedIds.length === 0}
              >
                Flip horizontal (F)
              </button>
              <button
                type="button"
                onClick={() => mirrorSelected("top-bottom")}
                disabled={selectedIds.length === 0}
              >
                Flip vertical (Shift+F)
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
                Fit (Home)
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
        <div
          className="help-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeHelp();
          }}
        >
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
                  Draw also contains Wire, Text, Arrow, Construction line, and
                  Rectangle. With no rotatable selection, <kbd>R</kbd> starts
                  Rectangle; with a component or drawing selected it rotates
                  clockwise. <kbd>Shift+R</kbd> rotates counter-clockwise.
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
                      <kbd>O</kbd> open; <kbd>U</kbd> undo; <kbd>Shift</kbd> +
                      <kbd>U</kbd> redo; <kbd>Ctrl</kbd> + <kbd>Z</kbd> undo;
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
                      <kbd>F</kbd> flip left/right; <kbd>Shift</kbd> +
                      <kbd>F</kbd> flip top/bottom;
                      <kbd>Delete</kbd> or <kbd>Backspace</kbd> delete.
                    </dd>
                  </div>
                  <div>
                    <dt>Tools and view</dt>
                    <dd>
                      <kbd>W</kbd> wire; <kbd>T</kbd> text; <kbd>A</kbd> arrow;
                      <kbd>L</kbd> construction line; <kbd>G</kbd> guide;
                      <kbd>Home</kbd> fit view; <kbd>X</kbd> reverses a selected
                      current arrow.
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
      <aside
        className="dock"
        aria-label="Symbols and drawing tools"
        role="complementary"
      >
        <ComponentLibrary
          styleProfileId={document.presentation.styleProfileId}
          onPlace={(symbolId, symbolName) => {
            beginComponentPlacement(symbolId);
            setStatus(`Place ${symbolName} on the canvas`);
          }}
        />
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
                  selectOnly("instance", [instance.id]);
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
          onPointerDownCapture={(event) => {
            const target = event.target as Element;
            if (
              selectedDrafting &&
              (selectedDrafting.kind === "arrow" ||
                selectedDrafting.kind === "construction-line" ||
                selectedDrafting.kind === "rectangle") &&
              !target.closest('[data-testid="drafting-inline-inspector"]') &&
              !target.closest(
                `[data-testid="drafting-hit-${selectedDrafting.id}"]`,
              ) &&
              !target.closest(
                `[data-testid="drafting-handles-${selectedDrafting.id}"]`,
              )
            ) {
              replaceSelectionKind("drafting", []);
            }
            handleCanvasHitPointerDown(event);
          }}
          onPointerDown={beginCanvasGesture}
          onPointerMove={continueCanvasGesture}
          onPointerUp={finishCanvasGesture}
          onPointerCancel={finishCanvasGesture}
          onClick={(event) => {
            const target = event.target as Element;
            const onBackground =
              target === event.currentTarget || target.tagName === "rect";
            if (
              (tool === "arrow" ||
                tool === "construction-line" ||
                tool === "rectangle") &&
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
            if (
              tool === "arrow" ||
              tool === "construction-line" ||
              tool === "rectangle"
            ) {
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
            if (
              tool === "arrow" ||
              tool === "construction-line" ||
              tool === "rectangle"
            ) {
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
                const translatesWholeRoute =
                  looseRouteAnchorIds(route) !== null;
                const routeCenter = centerOfBounds(
                  polylineBounds(polyline.points),
                );
                const preview =
                  routeStretchPreview?.routeId === route.id
                    ? routeStretchPreview.point
                    : null;
                return (
                  <circle
                    key={`handle-${route.id}`}
                    data-testid={`route-handle-${route.id}`}
                    data-canvas-hit-kind="handle"
                    data-canvas-hit-id={`route-handle-${route.id}`}
                    className="route-handle"
                    cx={
                      translatesWholeRoute
                        ? (preview?.x ?? routeCenter.x)
                        : from.y === to.y
                          ? (from.x + to.x) / 2
                          : (preview?.x ?? (from.x + to.x) / 2)
                    }
                    cy={
                      translatesWholeRoute
                        ? (preview?.y ?? routeCenter.y)
                        : from.x === to.x
                          ? (from.y + to.y) / 2
                          : (preview?.y ?? (from.y + to.y) / 2)
                    }
                    r="6"
                    onPointerDown={(event) =>
                      beginRouteStretch(
                        event,
                        route.id,
                        segmentIndex,
                        translatesWholeRoute ? "translate" : "segment",
                      )
                    }
                    pointerEvents={tool === "wire" ? "none" : undefined}
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
                    data-canvas-hit-kind="instance"
                    data-canvas-hit-id={instance.id}
                    data-drag-object-id={instance.id}
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
                    pointerEvents={tool === "wire" ? "none" : undefined}
                  />
                );
              })}
            {document.instances.map((instance) => {
              if (
                document.annotations.some(
                  (annotation) =>
                    annotation.kind === "instance-label" &&
                    annotation.attachedObjectId === instance.id,
                )
              ) {
                return null;
              }
              const label = defaultInstanceLabel(instance);
              if (!label) return null;
              return (
                <rect
                  key={`default-label-hit-${instance.id}`}
                  data-testid={`default-label-hit-${instance.id}`}
                  data-canvas-hit-kind="instance-label"
                  data-canvas-hit-id={instance.id}
                  data-drag-object-id={instance.id}
                  className="annotation-hit"
                  {...annotationHitBox(label, label.position)}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) =>
                    selectDefaultInstanceLabel(event, instance)
                  }
                  onDoubleClick={(event) =>
                    editDefaultInstanceLabel(event, instance)
                  }
                  pointerEvents={tool === "wire" ? "none" : undefined}
                />
              );
            })}
            {routePolylines.map(({ route, polyline }) => (
              <polyline
                key={route.id}
                data-testid={`route-hit-${route.id}`}
                data-canvas-hit-kind="route"
                data-canvas-hit-id={route.id}
                data-drag-object-id={route.id}
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
                data-canvas-hit-kind={
                  candidate.endpoint.kind === "junction"
                    ? "junction"
                    : undefined
                }
                data-canvas-hit-id={
                  candidate.endpoint.kind === "junction"
                    ? candidate.endpoint.junctionId
                    : undefined
                }
                data-drag-object-id={
                  candidate.endpoint.kind === "junction"
                    ? candidate.endpoint.junctionId
                    : undefined
                }
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
                    setStatus(`Selected ${endpointTestId(candidate.endpoint)}`);
                    return;
                  }
                  handleWireEndpoint(event, candidate);
                }}
              />
            ))}
            {document.annotations.map((annotation) => {
              const anchor = annotationAnchor(annotation);
              const hitBox = annotationHitBox(annotation, anchor);
              const usesWideAnnotationHitBand = isRoutedMarker(annotation);
              const selected =
                selectedAnnotationId === annotation.id ||
                supplementalSelection.annotationIds.includes(annotation.id);
              return (
                <rect
                  key={`annotation-hit-${annotation.id}`}
                  data-testid={`annotation-hit-${annotation.id}`}
                  data-canvas-hit-kind="annotation"
                  data-canvas-hit-id={annotation.id}
                  data-drag-object-id={annotation.id}
                  // Text uses the same precise dashed selection rectangle as a
                  // component. Current/voltage markers retain the wide line
                  // hit band because their painted geometry is intentionally
                  // thin and includes an arrow shaft.
                  className={
                    usesWideAnnotationHitBand
                      ? selected
                        ? "annotation-hit selected"
                        : "annotation-hit"
                      : selected
                        ? "hit-target annotation-text-hit selected"
                        : "hit-target annotation-text-hit"
                  }
                  {...hitBox}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) =>
                    beginAnnotationDrag(event, annotation)
                  }
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
              const selected =
                selectedDraftingId === object.id ||
                supplementalSelection.draftingIds.includes(object.id)
                  ? "annotation-hit selected"
                  : "annotation-hit";
              const textSelected =
                selectedDraftingId === object.id ||
                supplementalSelection.draftingIds.includes(object.id)
                  ? "hit-target annotation-text-hit selected"
                  : "hit-target annotation-text-hit";
              const onDown = (event: ReactPointerEvent<SVGElement>): void => {
                if (draggable) {
                  beginDraftingDrag(event, object);
                } else {
                  event.stopPropagation();
                  selectDraftingObject(object.id);
                }
              };
              if (
                object.kind === "construction-line" &&
                geometry.kind === "construction-line"
              ) {
                const points = object.points
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ");
                const hasCurve = geometry.curveControls.some(Boolean);
                const commonProps = {
                  key: `drafting-hit-${object.id}`,
                  "data-testid": `drafting-hit-${object.id}`,
                  "data-canvas-hit-kind": "drafting",
                  "data-canvas-hit-id": object.id,
                  "data-drag-object-id": object.id,
                  className: selected,
                  fill: "none",
                  onPointerDown: onDown,
                  onDoubleClick: (event: ReactMouseEvent<SVGElement>) => {
                    event.stopPropagation();
                    insertConstructionVertex(
                      object,
                      pointFromClient(
                        event.clientX,
                        event.clientY,
                        event.currentTarget.ownerSVGElement!,
                      ),
                    );
                  },
                  pointerEvents: tool === "wire" ? "none" : undefined,
                };
                return hasCurve ? (
                  <path
                    {...commonProps}
                    d={draftingPathData(
                      geometry.points,
                      geometry.curveControls,
                    )}
                  />
                ) : (
                  <polyline {...commonProps} points={points} />
                );
              }
              if (object.kind === "arrow" && geometry.kind === "arrow") {
                return geometry.curveControls.some(Boolean) ? (
                  <path
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    data-canvas-hit-kind="drafting"
                    data-canvas-hit-id={object.id}
                    data-drag-object-id={object.id}
                    className={selected}
                    d={draftingPathData(
                      geometry.points,
                      geometry.curveControls,
                    )}
                    fill="none"
                    onPointerDown={onDown}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      insertArrowWaypoint(
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
                ) : (
                  <polyline
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    data-canvas-hit-kind="drafting"
                    data-canvas-hit-id={object.id}
                    data-drag-object-id={object.id}
                    className={selected}
                    points={geometry.points
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    onPointerDown={onDown}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      insertArrowWaypoint(
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
              if (
                object.kind === "rectangle" &&
                geometry.kind === "rectangle"
              ) {
                return (
                  <polygon
                    key={`drafting-hit-${object.id}`}
                    data-testid={`drafting-hit-${object.id}`}
                    data-canvas-hit-kind="drafting"
                    data-canvas-hit-id={object.id}
                    data-drag-object-id={object.id}
                    className={`${selected} drafting-rectangle-hit`}
                    points={polylinePoints(geometry.corners)}
                    fill="none"
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
                    data-canvas-hit-kind="drafting"
                    data-canvas-hit-id={object.id}
                    data-drag-object-id={object.id}
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
                    data-canvas-hit-kind="drafting"
                    data-canvas-hit-id={object.id}
                    data-drag-object-id={object.id}
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
              return (
                <rect
                  key={`drafting-hit-${object.id}`}
                  data-testid={`drafting-hit-${object.id}`}
                  data-canvas-hit-kind="drafting"
                  data-canvas-hit-id={object.id}
                  data-drag-object-id={object.id}
                  className={object.kind === "text" ? textSelected : selected}
                  {...geometry.bounds}
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
                      <g
                        data-testid={`drafting-handles-${object.id}`}
                        data-canvas-hit-kind="handle"
                        data-canvas-hit-id={`drafting-handles-${object.id}`}
                      >
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
                        {geometry.points.slice(1, -1).map((point, index) => (
                          <circle
                            key={`draft-arrow-waypoint-${index}`}
                            className="draft-handle"
                            data-testid={`draft-handle-waypoint-${index}-${object.id}`}
                            cx={point.x}
                            cy={point.y}
                            r="5"
                            onPointerDown={(event) =>
                              beginDraftingHandleDrag(event, object, {
                                kind: "waypoint",
                                index,
                              })
                            }
                          />
                        ))}
                        {geometry.points.slice(0, -1).map((point, index) => {
                          const next = geometry.points[index + 1]!;
                          const midpoint = quadraticMidpoint(
                            point,
                            geometry.curveControls[index] ?? null,
                            next,
                          );
                          return (
                            <rect
                              key={`draft-arrow-segment-${index}`}
                              className="draft-handle draft-midpoint-handle"
                              data-testid={`draft-handle-segment-${index}-${object.id}`}
                              x={midpoint.x - 3}
                              y={midpoint.y - 3}
                              width="6"
                              height="6"
                              transform={`rotate(45 ${midpoint.x} ${midpoint.y})`}
                              onPointerDown={(event) =>
                                beginDraftingHandleDrag(event, object, {
                                  kind: "curve",
                                  index,
                                })
                              }
                            />
                          );
                        })}
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
                      <g
                        data-testid={`drafting-handles-${object.id}`}
                        data-canvas-hit-kind="handle"
                        data-canvas-hit-id={`drafting-handles-${object.id}`}
                      >
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
                        {geometry.vertices.slice(0, -1).map((vertex, index) => {
                          const next = geometry.vertices[index + 1]!;
                          const midpoint = quadraticMidpoint(
                            vertex,
                            geometry.curveControls[index] ?? null,
                            next,
                          );
                          return (
                            <rect
                              key={`draft-line-segment-${index}`}
                              className="draft-handle draft-midpoint-handle"
                              data-testid={`draft-handle-segment-${index}-${object.id}`}
                              x={midpoint.x - 3}
                              y={midpoint.y - 3}
                              width="6"
                              height="6"
                              transform={`rotate(45 ${midpoint.x} ${midpoint.y})`}
                              onPointerDown={(event) =>
                                beginDraftingHandleDrag(event, object, {
                                  kind: "curve",
                                  index,
                                })
                              }
                            />
                          );
                        })}
                      </g>
                    );
                  }
                  if (
                    object.kind === "rectangle" &&
                    geometry.kind === "rectangle"
                  ) {
                    return (
                      <g data-testid={`drafting-handles-${object.id}`}>
                        {geometry.corners.map((corner, index) => (
                          <rect
                            key={`draft-rectangle-corner-${index}`}
                            className="draft-handle"
                            data-testid={`draft-handle-corner-${index}-${object.id}`}
                            x={corner.x - 4}
                            y={corner.y - 4}
                            width="8"
                            height="8"
                            onPointerDown={(event) =>
                              beginDraftingHandleDrag(event, object, {
                                kind: "rectangle-corner",
                                index,
                              })
                            }
                          />
                        ))}
                      </g>
                    );
                  }
                  return null;
                })()
              : null}
            {selectedDrafting &&
            (selectedDrafting.kind === "arrow" ||
              selectedDrafting.kind === "construction-line" ||
              selectedDrafting.kind === "rectangle")
              ? (() => {
                  const geometry = resolveDraftingObjectGeometry(
                    document,
                    resolver,
                    selectedDrafting,
                  );
                  if (
                    geometry.kind !== "arrow" &&
                    geometry.kind !== "construction-line" &&
                    geometry.kind !== "rectangle"
                  ) {
                    return null;
                  }
                  const inspectorWidth =
                    selectedDrafting.kind === "arrow" ? 252 : 144;
                  const inspectorHeight =
                    selectedDrafting.kind === "arrow" ? 144 : 132;
                  const inspectorX = Math.max(
                    viewBox.x + 8,
                    Math.min(
                      viewBox.x + viewBox.width - inspectorWidth - 8,
                      geometry.bounds.x + geometry.bounds.width + 12,
                    ),
                  );
                  const inspectorY = Math.max(
                    viewBox.y + 8,
                    Math.min(
                      viewBox.y + viewBox.height - inspectorHeight - 8,
                      geometry.bounds.y - 4,
                    ),
                  );
                  const lineStyle =
                    selectedDrafting.styleOverride?.lineStyle ??
                    (selectedDrafting.kind === "construction-line" ||
                    selectedDrafting.kind === "rectangle"
                      ? selectedDrafting.lineStyle
                      : "solid");
                  const isRectangle = geometry.kind === "rectangle";
                  const geometryPoints = isRectangle
                    ? geometry.corners
                    : geometry.points;
                  const curveControls = isRectangle
                    ? geometryPoints.slice(0, -1).map(() => null)
                    : geometry.curveControls;
                  const segmentIndex =
                    draftingInspectorSegment?.objectId === selectedDrafting.id
                      ? draftingInspectorSegment.index
                      : Math.max(0, curveControls.findIndex(Boolean));
                  const tangentAngle = isRectangle
                    ? 0
                    : quadraticTangentAngle(
                        geometryPoints[segmentIndex]!,
                        curveControls[segmentIndex] ?? null,
                        geometryPoints[segmentIndex + 1]!,
                      );
                  const tangentInputKey = `${selectedDrafting.id}:${segmentIndex}`;
                  const realizedAngleText = String(
                    Math.round(tangentAngle * 10) / 10,
                  );
                  const tangentInputValue =
                    draftingTangentInput?.key === tangentInputKey
                      ? draftingTangentInput.value
                      : realizedAngleText;
                  const bearing = isRectangle
                    ? geometry.rotation
                    : normalizedBearing(geometryPoints[0]!, geometryPoints[1]!);
                  const realizedBearingText = String(
                    Math.round(bearing * 10) / 10,
                  );
                  const bearingInputValue =
                    draftingBearingInput?.objectId === selectedDrafting.id
                      ? draftingBearingInput.value
                      : realizedBearingText;
                  return (
                    <foreignObject
                      data-testid="drafting-inline-inspector"
                      x={inspectorX}
                      y={inspectorY}
                      width={inspectorWidth}
                      height={inspectorHeight}
                    >
                      <div
                        className="drafting-inline-inspector"
                        data-drafting-kind={selectedDrafting.kind}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <select
                          aria-label="Inline line style"
                          value={lineStyle}
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
                        <select
                          aria-label="Inline stroke width"
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
                        {selectedDrafting.kind === "construction-line" &&
                        geometryPoints.length > 2 ? (
                          <select
                            aria-label="Curve segment"
                            value={String(segmentIndex)}
                            disabled={selectedDrafting.locked}
                            onChange={(event) => {
                              setDraftingInspectorSegment({
                                objectId: selectedDrafting.id,
                                index: Number(event.currentTarget.value),
                              });
                              setDraftingTangentInput(null);
                            }}
                          >
                            {geometryPoints.slice(0, -1).map((_, index) => (
                              <option key={index} value={index}>
                                Segment {index + 1}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {!isRectangle ? (
                          <label className="drafting-tangent-angle">
                            Tangent ∠
                            <input
                              aria-label="Tangent angle"
                              type="number"
                              min="0"
                              max="170"
                              step="1"
                              value={tangentInputValue}
                              disabled={selectedDrafting.locked}
                              placeholder={realizedAngleText}
                              onFocus={() => {
                                setDraftingTangentInput({
                                  key: tangentInputKey,
                                  value: "",
                                });
                              }}
                              onChange={(event) => {
                                const value = event.currentTarget.value;
                                setDraftingTangentInput({
                                  key: tangentInputKey,
                                  value,
                                });
                                const angle = Number(value);
                                if (value !== "" && Number.isFinite(angle)) {
                                  setDraftingTangentAngle(angle);
                                }
                              }}
                              onBlur={() => setDraftingTangentInput(null)}
                            />
                            °
                          </label>
                        ) : null}
                        <label className="drafting-tangent-angle">
                          Bearing
                          <input
                            aria-label="Drawing bearing"
                            type="number"
                            min="0"
                            max="359"
                            step="1"
                            value={bearingInputValue}
                            disabled={selectedDrafting.locked}
                            placeholder={realizedBearingText}
                            onFocus={() =>
                              setDraftingBearingInput({
                                objectId: selectedDrafting.id,
                                value: "",
                              })
                            }
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setDraftingBearingInput({
                                objectId: selectedDrafting.id,
                                value,
                              });
                              const bearing = Number(value);
                              if (value !== "" && Number.isFinite(bearing)) {
                                setDraftingBearing(bearing);
                              }
                            }}
                            onBlur={() => setDraftingBearingInput(null)}
                          />
                          °
                        </label>
                        {selectedDrafting.kind === "arrow" ? (
                          <>
                            <select
                              aria-label="Inline arrow head"
                              value={
                                selectedDrafting.styleOverride?.arrowHead ??
                                "filled"
                              }
                              disabled={selectedDrafting.locked}
                              onChange={(event) =>
                                setDraftingStyle({
                                  arrowHead: event.currentTarget.value as
                                    "none" | "filled" | "open",
                                })
                              }
                            >
                              <option value="none">No head</option>
                              <option value="filled">Filled</option>
                              <option value="open">Open</option>
                            </select>
                            <select
                              aria-label="Inline arrow head size"
                              value={String(
                                selectedDrafting.styleOverride
                                  ?.arrowHeadScale ?? 1,
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
                              <option value="0.75">0.75× head</option>
                              <option value="1">1× head</option>
                              <option value="1.25">1.25× head</option>
                              <option value="1.5">1.5× head</option>
                            </select>
                            <button
                              type="button"
                              disabled={selectedDrafting.locked}
                              onClick={() => {
                                const { from, to } = selectedDrafting;
                                transact([
                                  {
                                    kind: "upsert_drafting_object",
                                    object: {
                                      ...selectedDrafting,
                                      from: to,
                                      to: from,
                                      waypoints: [
                                        ...(selectedDrafting.waypoints ?? []),
                                      ].reverse(),
                                      curveControls: [
                                        ...(selectedDrafting.curveControls ??
                                          []),
                                      ].reverse(),
                                    },
                                  },
                                ]);
                              }}
                            >
                              Reverse
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={selectedDrafting.locked}
                          onClick={() => rotateSelected()}
                        >
                          Rotate
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDraftingLock(selectedDrafting)}
                        >
                          {selectedDrafting.locked ? "Unlock" : "Lock"}
                        </button>
                      </div>
                    </foreignObject>
                  );
                })()
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
            {textEditing && textEditingBounds
              ? (() => {
                  const editorWidth = Math.min(
                    Math.max(420, textEditingBounds.width + 12),
                    viewBox.width - 16,
                  );
                  const editorHeight = Math.min(
                    Math.max(
                      110,
                      textEditingBounds.height + 68,
                      78 + 15.116 * textEditing.sizeScale * 1.3,
                    ),
                    viewBox.height - 16,
                  );
                  const editorX = Math.max(
                    viewBox.x + 8,
                    Math.min(
                      viewBox.x + viewBox.width - editorWidth - 8,
                      textEditingBounds.x - 6,
                    ),
                  );
                  const editorY = Math.max(
                    viewBox.y + 8,
                    Math.min(
                      viewBox.y + viewBox.height - editorHeight - 8,
                      textEditingBounds.y - 58,
                    ),
                  );
                  return (
                    <foreignObject
                      data-testid="canvas-text-editor"
                      x={editorX}
                      y={editorY}
                      width={editorWidth}
                      height={editorHeight}
                    >
                      <RichTextEditor
                        targetKey={`${textEditing.owner}:${textEditing.id}`}
                        content={textEditing.content}
                        disabled={textEditingLocked}
                        sizeScale={textEditing.sizeScale}
                        onChange={(content) => updateTextEditing({ content })}
                        onSizeChange={(sizeScale) =>
                          updateTextEditing({ sizeScale })
                        }
                        onCommit={commitTextEditing}
                        onCancel={() => setTextEditing(null)}
                        onDelete={deleteTextEditing}
                        {...(editingAnnotation &&
                        isRoutedMarker(editingAnnotation) &&
                        effectiveRouteAttachment(editingAnnotation)
                          ? {
                              onReverseCurrentArrow:
                                reverseSelectedCurrentArrow,
                            }
                          : {})}
                      />
                    </foreignObject>
                  );
                })()
              : null}
          </g>
        </svg>
      </section>
    </main>
  );
}
