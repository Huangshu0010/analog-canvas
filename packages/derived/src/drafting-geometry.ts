import type {
  DraftingObject,
  Point,
  Rect,
  RichTextDocument,
  SchematicDocument,
  VisualAnchor,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { resolveVisualAnchor, type ResolvedAnchor } from "./anchor.js";

// ADR 0010 / WP-R1: the single derived-geometry entry for DraftingObjects.
// Renderer, Editor overlay, and Agent Snapshot consume ONLY this result; no
// consumer re-implements anchor math. Resolution reads derived geometry only,
// never mutates the Document, never guesses a new route, never auto re-attaches,
// and never blocks rendering/export when an anchor is invalid (fallback used).

export type DraftingAnchorRole = "anchor" | "from" | "to" | "target";

export interface DraftingDiagnostic {
  code:
    | "DRAFTING_ANCHOR_TARGET_MISSING"
    | "DRAFTING_ROUTE_SEGMENT_INVALID"
    | "DRAFTING_SYMBOL_UNRESOLVED";
  severity: "warning";
  draftingObjectId: string;
  anchorRole: DraftingAnchorRole;
  targetObjectIds: string[];
  message: string;
  bounds?: Rect;
}

export type ResolvedDraftingGeometry =
  | {
      kind: "text";
      position: Point;
      rotation: 0 | 90 | 180 | 270;
      bounds: Rect;
      diagnostics: DraftingDiagnostic[];
    }
  | {
      kind: "arrow";
      from: Point;
      to: Point;
      bounds: Rect;
      diagnostics: DraftingDiagnostic[];
    }
  | {
      kind: "leader";
      anchor: Point;
      target: Point;
      bounds: Rect;
      diagnostics: DraftingDiagnostic[];
    }
  | {
      kind: "callout";
      textPosition: Point;
      target: Point;
      rotation: 0 | 90 | 180 | 270;
      bounds: Rect;
      diagnostics: DraftingDiagnostic[];
    }
  | {
      kind: "construction-line";
      points: Point[];
      bounds: Rect;
      diagnostics: [];
    }
  | {
      kind: "floating-symbol";
      position: Point;
      rotation: 0 | 90 | 180 | 270;
      bounds: Rect;
      diagnostics: DraftingDiagnostic[];
    };

const STROKE_PADDING = 6;
const TEXT_PADDING_X = 6;
const TEXT_PADDING_Y = 8;
const ARROWHEAD_PADDING = 12;

export function resolveDraftingObjectGeometry(
  document: SchematicDocument,
  resolver: SymbolResolver,
  object: DraftingObject,
): ResolvedDraftingGeometry {
  switch (object.kind) {
    case "text":
      return resolveText(document, resolver, object);
    case "arrow":
      return resolveArrow(document, resolver, object);
    case "leader":
      return resolveLeader(document, resolver, object);
    case "callout":
      return resolveCallout(document, resolver, object);
    case "construction-line":
      return resolveConstructionLine(object);
    case "floating-symbol":
      return resolveFloatingSymbol(document, resolver, object);
  }
}

function resolveAnchorWithRole(
  document: SchematicDocument,
  resolver: SymbolResolver,
  anchor: VisualAnchor,
  draftingObjectId: string,
  anchorRole: DraftingAnchorRole,
): { anchor: ResolvedAnchor; diagnostics: DraftingDiagnostic[] } {
  const resolved = resolveVisualAnchor(document, resolver, anchor);
  const diagnostics: DraftingDiagnostic[] = [];
  if (!resolved.resolved && resolved.diagnostic) {
    diagnostics.push({
      code: "DRAFTING_ANCHOR_TARGET_MISSING",
      severity: "warning",
      draftingObjectId,
      anchorRole,
      targetObjectIds: resolved.diagnostic.objectId
        ? [resolved.diagnostic.objectId]
        : [],
      message: resolved.diagnostic.message,
    });
  }
  return { anchor: resolved, diagnostics };
}

// P1: frozen final-rotation semantics. The renderer, export bounds, and
// Snapshot all use the geometry.rotation reported here. For a "follow" route
// anchor the anchor's own rotation composes with the object's persisted
// rotation; for free/object anchors the object rotation stands alone.
function composeRotation(
  anchorRotation: 0 | 90 | 180 | 270,
  objectRotation: 0 | 90 | 180 | 270,
  follow: boolean,
): 0 | 90 | 180 | 270 {
  if (!follow) return objectRotation;
  const composed = (anchorRotation + objectRotation) % 360;
  return ((composed % 360) + 360) % 360 as 0 | 90 | 180 | 270;
}

function resolveText(
  document: SchematicDocument,
  resolver: SymbolResolver,
  object: Extract<DraftingObject, { kind: "text" }>,
) {
  // Text anchors may be free/object/route; route anchors reuse the shared route
  // math via resolveVisualAnchor.
  const resolved = resolveVisualAnchor(document, resolver, object.anchor);
  const diagnostics: DraftingDiagnostic[] = [];
  if (!resolved.resolved && resolved.diagnostic) {
    diagnostics.push({
      code: "DRAFTING_ANCHOR_TARGET_MISSING",
      severity: "warning",
      draftingObjectId: object.id,
      anchorRole: "anchor",
      targetObjectIds: resolved.diagnostic.objectId
        ? [resolved.diagnostic.objectId]
        : [],
      message: resolved.diagnostic.message,
    });
  }
  const position = resolved.position;
  const follow =
    object.anchor.kind === "route" && object.anchor.orientation === "follow";
  const rotation = composeRotation(resolved.rotation, object.rotation, follow);
  const bounds = textBounds(position, object.alignment, rotation, object.content);
  return {
    kind: "text" as const,
    position,
    rotation,
    bounds,
    diagnostics,
  };
}

function resolveArrow(
  document: SchematicDocument,
  resolver: SymbolResolver,
  object: Extract<DraftingObject, { kind: "arrow" }>,
) {
  const from = resolveAnchorWithRole(
    document,
    resolver,
    object.from,
    object.id,
    "from",
  );
  const to = resolveAnchorWithRole(
    document,
    resolver,
    object.to,
    object.id,
    "to",
  );
  const fromPoint = from.anchor.position;
  const toPoint = to.anchor.position;
  return {
    kind: "arrow" as const,
    from: fromPoint,
    to: toPoint,
    bounds: paddedBounds(unionBounds([fromPoint, toPoint]), ARROWHEAD_PADDING),
    diagnostics: [...from.diagnostics, ...to.diagnostics],
  };
}

function resolveLeader(
  document: SchematicDocument,
  resolver: SymbolResolver,
  object: Extract<DraftingObject, { kind: "leader" }>,
) {
  const anchor = resolveAnchorWithRole(
    document,
    resolver,
    object.anchor,
    object.id,
    "anchor",
  );
  const target = resolveAnchorWithRole(
    document,
    resolver,
    object.target,
    object.id,
    "target",
  );
  const anchorPoint = anchor.anchor.position;
  const targetPoint = target.anchor.position;
  return {
    kind: "leader" as const,
    anchor: anchorPoint,
    target: targetPoint,
    bounds: paddedBounds(
      unionBounds([anchorPoint, targetPoint]),
      STROKE_PADDING,
    ),
    diagnostics: [...anchor.diagnostics, ...target.diagnostics],
  };
}

function resolveCallout(
  document: SchematicDocument,
  resolver: SymbolResolver,
  object: Extract<DraftingObject, { kind: "callout" }>,
) {
  const anchor = resolveAnchorWithRole(
    document,
    resolver,
    object.anchor,
    object.id,
    "anchor",
  );
  const target = resolveAnchorWithRole(
    document,
    resolver,
    object.target,
    object.id,
    "target",
  );
  const textPos = anchor.anchor.position;
  const targetPoint = target.anchor.position;
  const follow =
    object.anchor.kind === "route" && object.anchor.orientation === "follow";
  const rotation = composeRotation(anchor.anchor.rotation, object.rotation, follow);
  const textBox = textBounds(textPos, object.alignment, rotation, object.content);
  const leaderBox = paddedBounds(
    unionBounds([textPos, targetPoint]),
    STROKE_PADDING,
  );
  return {
    kind: "callout" as const,
    textPosition: textPos,
    target: targetPoint,
    rotation,
    bounds: unionRects([textBox, leaderBox]),
    diagnostics: [...anchor.diagnostics, ...target.diagnostics],
  };
}

function resolveConstructionLine(
  object: Extract<DraftingObject, { kind: "construction-line" }>,
) {
  return {
    kind: "construction-line" as const,
    points: object.points,
    bounds: paddedBounds(unionBounds(object.points), STROKE_PADDING),
    diagnostics: [] as [],
  };
}

function resolveFloatingSymbol(
  document: SchematicDocument,
  resolver: SymbolResolver,
  object: Extract<DraftingObject, { kind: "floating-symbol" }>,
) {
  const anchor = resolveAnchorWithRole(
    document,
    resolver,
    object.anchor,
    object.id,
    "anchor",
  );
  const resolvedSymbol = resolver.resolve(object.symbolId);
  const diagnostics = [...anchor.diagnostics];
  if (!resolvedSymbol) {
    diagnostics.push({
      code: "DRAFTING_SYMBOL_UNRESOLVED",
      severity: "warning",
      draftingObjectId: object.id,
      anchorRole: "anchor",
      targetObjectIds: [object.symbolId],
      message: `Floating symbol ${object.symbolId} is unresolved; using anchor fallback bounds.`,
    });
  }
  const position = anchor.anchor.position;
  const rotation = object.transform.rotation;
  const viewBox = resolvedSymbol?.definition.viewBox;
  let bounds: Rect = {
    x: position.x - 12,
    y: position.y - 12,
    width: 24,
    height: 24,
  };
  if (viewBox) {
    const mirrorX = object.transform.mirror === "x" ? -1 : 1;
    const w = viewBox.width;
    const h = viewBox.height;
    const x = position.x - (w / 2) * mirrorX;
    const y = position.y - h / 2;
    bounds = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
    };
  }
  return {
    kind: "floating-symbol" as const,
    position,
    rotation,
    bounds,
    diagnostics,
  };
}

// --- bounds helpers -------------------------------------------------------

function unionBounds(points: Point[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function paddedBounds(bounds: Rect, padding: number): Rect {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function unionRects(rects: Rect[]): Rect {
  const nonEmpty = rects.filter((rect) => rect.width > 0 || rect.height > 0);
  if (nonEmpty.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...nonEmpty.map((rect) => rect.x));
  const minY = Math.min(...nonEmpty.map((rect) => rect.y));
  const maxX = Math.max(...nonEmpty.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...nonEmpty.map((rect) => rect.y + rect.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Approximate rich-text layout bounds: per line, count text runs; the
// alignment anchors the box horizontally.
function textBounds(
  position: Point,
  alignment: "start" | "middle" | "end",
  rotation: 0 | 90 | 180 | 270,
  content: RichTextDocument,
): Rect {
  const width = estimateTextWidth(content) + TEXT_PADDING_X * 2;
  const height = TEXT_PADDING_Y * 2 + 16;
  const left =
    alignment === "start"
      ? position.x - TEXT_PADDING_X
      : alignment === "end"
        ? position.x - width + TEXT_PADDING_X
        : position.x - width / 2;
  const top = position.y - TEXT_PADDING_Y - 12;
  const box: Rect = { x: left, y: top, width, height };
  if (rotation === 90 || rotation === 270) {
    return {
      x: position.x - height / 2,
      y: position.y - width / 2,
      width: height,
      height: width,
    };
  }
  return box;
}

function estimateTextWidth(content: RichTextDocument): number {
  const text = content.runs
    .map((run) => {
      if (typeof run === "object" && run !== null) {
        const node = run as {
          kind?: string;
          value?: string;
          children?: unknown[];
        };
        if (node.kind === "text") return node.value ?? "";
        if (node.kind === "fraction") return "XX";
        if (node.children)
          return node.children
            .map((child) => {
              const c = child as { value?: string };
              return c.value ?? "";
            })
            .join("");
      }
      return "";
    })
    .join("");
  // 0.6em average advance approximates the renderer's 0.6em-per-char estimate.
  return text.length * 9.6;
}
