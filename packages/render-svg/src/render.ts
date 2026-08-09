import {
  RectSchema,
  SchematicDocumentSchema,
  transformPoint,
} from "@icm/model";
import {
  resolveDraftingObjectGeometry,
  routeAttachmentPlacement,
  routePolyline,
  resolveEndpointOutwardDirection,
} from "@icm/derived";
import type { ResolvedDraftingGeometry } from "@icm/derived";
import type {
  DraftingObject,
  Point,
  Rect,
  SchematicDocument,
} from "@icm/model";
import type {
  SymbolDefinition,
  SymbolPrimitive,
  SymbolResolver,
} from "@icm/symbols";

import {
  resolveSchematicStyleProfile,
  resolvePrimitiveStrokeWidth,
  textbookMonochromeProfile,
} from "./style-profile.js";
import type { SchematicStyleProfile } from "./style-profile.js";
import {
  renderSchematicTextContent,
  schematicTextSizeAttribute,
} from "./schematic-text.js";
import { renderRichTextDocument } from "./rich-text.js";
import type { RichTextDocumentInput } from "./rich-text.js";

export interface SvgRenderOptions {
  bounds?: Rect;
  margin?: number;
  title?: string;
}

export interface SvgScene {
  viewBox: Rect;
  formalBody: string;
}

function renderAnnotationText(
  annotation: SchematicDocument["annotations"][number],
  profile: SchematicStyleProfile,
): string {
  // A new semantic label has no RichText payload and receives canonical Razavi
  // composition from its electrical string. Once a human explicitly formats
  // it in the canvas editor, that persisted AST is the visual source of truth;
  // flattening it back through `text` loses selected multi-character spans.
  if (annotation.content) {
    return renderRichTextDocument(
      annotation.content as unknown as RichTextDocumentInput,
      profile,
    );
  }
  return renderSchematicTextContent(annotation.text, annotation.kind, profile);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pointList(points: ReadonlyArray<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

/**
 * Route topology always terminates at the exact electrical pin origin. For a
 * terminal escape segment, draw a short, same-width overlap underneath the
 * symbol. This removes a butt-cap anti-alias seam without moving the main SVG
 * route coordinates or applying a visible dot/collar to every device pin.
 */
function renderTerminalJoinOverlaps(
  document: SchematicDocument,
  resolver: SymbolResolver,
  route: SchematicDocument["routes"][number],
  points: readonly Point[],
  profile: SchematicStyleProfile,
): string {
  if (points.length < 2) return "";
  const overlap = Math.max(profile.strokes.wire, profile.strokes.symbol) * 0.75;
  const overlaps: string[] = [];
  const renderOverlap = (point: Point, outward: Point) =>
    `<line data-role="terminal-overlap" data-route-id="${escapeXml(route.id)}" x1="${point.x - outward.x * overlap}" y1="${point.y - outward.y * overlap}" x2="${point.x + outward.x * overlap}" y2="${point.y + outward.y * overlap}" stroke="${profile.foreground}" stroke-width="${profile.strokes.wire}" stroke-linecap="${profile.lineCap}"/>`;
  const fromOutward = resolveEndpointOutwardDirection(
    document,
    resolver,
    route.from,
  );
  const first = points[0]!;
  const next = points[1]!;
  if (
    route.segmentModes[0] === "escape" &&
    fromOutward &&
    (next.x - first.x) * fromOutward.x + (next.y - first.y) * fromOutward.y > 0
  ) {
    overlaps.push(renderOverlap(first, fromOutward));
  }

  const toOutward = resolveEndpointOutwardDirection(
    document,
    resolver,
    route.to,
  );
  const previous = points.at(-2)!;
  const last = points.at(-1)!;
  if (
    route.segmentModes.at(-1) === "escape" &&
    toOutward &&
    (last.x - previous.x) * toOutward.x + (last.y - previous.y) * toOutward.y <
      0
  ) {
    overlaps.push(renderOverlap(last, toOutward));
  }
  return overlaps.join("");
}

function profileMiterAttribute(profile: SchematicStyleProfile): string {
  return profile.id === "textbook-monochrome-v1"
    ? ""
    : ` stroke-miterlimit="${profile.miterLimit}"`;
}

function primitiveStyle(
  primitive: SymbolPrimitive,
  profile: SchematicStyleProfile,
): string {
  const style = primitive.style;
  if (!style) return "";
  const strokeWidth = resolvePrimitiveStrokeWidth(
    profile,
    style.strokeRole,
    style.strokeWidth,
  );
  return [
    strokeWidth === undefined ? "" : ` stroke-width="${strokeWidth}"`,
    style.lineCap === undefined ? "" : ` stroke-linecap="${style.lineCap}"`,
    style.lineJoin === undefined ? "" : ` stroke-linejoin="${style.lineJoin}"`,
  ].join("");
}

function renderPrimitive(
  primitive: SymbolPrimitive,
  profile: SchematicStyleProfile,
): string {
  const style = primitiveStyle(primitive, profile);
  switch (primitive.kind) {
    case "line":
      return `<line x1="${primitive.from.x}" y1="${primitive.from.y}" x2="${primitive.to.x}" y2="${primitive.to.y}"${style}/>`;
    case "polyline":
      return `<polyline points="${pointList(primitive.points)}"${style}/>`;
    case "circle":
      return `<circle cx="${primitive.center.x}" cy="${primitive.center.y}" r="${primitive.radius}"${primitive.fill === undefined ? "" : ` fill="${primitive.fill === "foreground" ? profile.foreground : "none"}"`}${primitive.stroke === undefined ? "" : ` stroke="${primitive.stroke === "foreground" ? profile.foreground : "none"}"`}${style}/>`;
    case "path":
      return `<path d="${escapeXml(primitive.data)}"${style}/>`;
    case "polygon":
      return `<polygon points="${pointList(primitive.points)}" fill="${primitive.fill === "foreground" ? profile.foreground : "none"}"${primitive.stroke === undefined ? "" : ` stroke="${primitive.stroke === "foreground" ? profile.foreground : "none"}"`}${style}/>`;
  }
}

export function renderSymbolDefinitionBody(
  definition: SymbolDefinition,
  hiddenPrimitiveParts: readonly string[] = [],
  additionalPrimitives: readonly SymbolPrimitive[] = [],
  profile: SchematicStyleProfile = textbookMonochromeProfile,
): string {
  const hidden = new Set(hiddenPrimitiveParts);
  return [...definition.primitives, ...additionalPrimitives]
    .filter((primitive) => !primitive.part || !hidden.has(primitive.part))
    .map((primitive) => renderPrimitive(primitive, profile))
    .join("");
}

function instanceTransform(
  instance: SchematicDocument["instances"][number],
): string {
  const placement = instance.placement;
  if (!placement) {
    throw new Error(`Cannot render unplaced instance: ${instance.id}`);
  }
  const mirror = placement.mirror === "x" ? " scale(-1 1)" : "";
  return `translate(${placement.position.x} ${placement.position.y}) rotate(${placement.rotation})${mirror}`;
}

function transformedDirection(
  direction: "north" | "east" | "south" | "west",
  placement: NonNullable<SchematicDocument["instances"][number]["placement"]>,
): { x: number; y: number } {
  const vectors = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  } as const;
  const source = vectors[direction];
  const mirrored = {
    x: placement.mirror === "x" ? -source.x : source.x,
    y: source.y,
  };
  switch (placement.rotation) {
    case 0:
      return mirrored;
    case 90:
      return { x: -mirrored.y, y: mirrored.x };
    case 180:
      return { x: -mirrored.x, y: -mirrored.y };
    case 270:
      return { x: mirrored.y, y: -mirrored.x };
  }
}

function rotateOffset(
  offset: { x: number; y: number },
  rotation: SchematicDocument["annotations"][number]["rotation"],
): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return offset;
    case 90:
      return { x: -offset.y, y: offset.x };
    case 180:
      return { x: -offset.x, y: -offset.y };
    case 270:
      return { x: offset.y, y: -offset.x };
  }
}

function renderVisiblePinNames(
  definition: SymbolDefinition,
  hiddenPinNames: readonly string[],
  instance: SchematicDocument["instances"][number],
  profile: SchematicStyleProfile,
): string {
  const placement = instance.placement;
  if (!placement) return "";
  const hidden = new Set(hiddenPinNames);
  return definition.pins
    .filter(
      (pin) =>
        pin.presentation.showName === true &&
        pin.presentation.visibility === "visible" &&
        !hidden.has(pin.name),
    )
    .map((pin) => {
      const anchor = transformPoint(pin.at, placement.position, placement);
      const outward = transformedDirection(pin.direction, placement);
      const distance = (pin.presentation.leadLength ?? 0) + 4;
      const x = anchor.x - outward.x * distance;
      const y = anchor.y - outward.y * distance + 4;
      const alignment =
        outward.x < 0 ? "start" : outward.x > 0 ? "end" : "middle";
      const sizeAttribute =
        profile.id === "textbook-monochrome-v1"
          ? ' style="font-size:8px"'
          : schematicTextSizeAttribute("pin-name", profile);
      return `<text data-pin-name="${escapeXml(pin.name)}" x="${x}" y="${y}" text-anchor="${alignment}"${sizeAttribute}>${renderSchematicTextContent(pin.name, "pin-name", profile)}</text>`;
    })
    .join("");
}

function symbolBounds(
  definition: SymbolDefinition,
  instance: SchematicDocument["instances"][number],
): Rect {
  const placement = instance.placement;
  if (!placement) {
    throw new Error(
      `Cannot derive bounds for unplaced instance: ${instance.id}`,
    );
  }
  const viewBox = definition.viewBox;
  const corners = [
    { x: viewBox.x, y: viewBox.y },
    { x: viewBox.x + viewBox.width, y: viewBox.y },
    { x: viewBox.x, y: viewBox.y + viewBox.height },
    { x: viewBox.x + viewBox.width, y: viewBox.y + viewBox.height },
  ].map((point) => transformPoint(point, placement.position, placement));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

function deriveBounds(
  document: SchematicDocument,
  resolver: SymbolResolver,
  margin: number,
  profile: SchematicStyleProfile,
): Rect {
  const bounds: Rect[] = [];
  const estimatedTextBounds = (
    text: string,
    x: number,
    y: number,
    alignment: "start" | "middle" | "end",
    sizeScale: number,
  ): Rect => {
    const width = Math.max(7 * sizeScale, text.length * 7 * sizeScale);
    const left =
      alignment === "start"
        ? x
        : alignment === "end"
          ? x - width
          : x - width / 2;
    return {
      x: Math.floor(left),
      y: y - 13 * sizeScale,
      width: Math.ceil(width),
      height: Math.ceil(17 * sizeScale),
    };
  };
  for (const instance of document.instances.filter(
    (candidate) => candidate.placement !== null,
  )) {
    const resolved = resolver.resolve(
      instance.symbolId,
      instance.symbolVariantId,
    );
    if (!resolved) {
      throw new Error(`Unresolved symbol: ${instance.symbolId}`);
    }
    const instanceBox = symbolBounds(resolved.definition, instance);
    bounds.push(instanceBox);
  }
  for (const route of document.routes) {
    const polyline = routePolyline(document, resolver, route);
    if (!polyline) {
      throw new Error(`Cannot derive bounds for unresolved route: ${route.id}`);
    }
    for (const point of polyline.points) {
      bounds.push({ x: point.x, y: point.y, width: 0, height: 0 });
    }
  }
  for (const junction of document.junctions) {
    bounds.push({
      x: junction.position.x,
      y: junction.position.y,
      width: 0,
      height: 0,
    });
  }
  if (profile.nodes.portOriginRadius > 0) {
    for (const port of document.ports) {
      if (!port.position) continue;
      const radius = profile.nodes.portOriginRadius;
      bounds.push({
        x: port.position.x - radius,
        y: port.position.y - radius,
        width: radius * 2,
        height: radius * 2,
      });
    }
  }
  for (const annotation of document.annotations) {
    const attachedRoute = annotation.routeAttachment
      ? document.routes.find(
          (route) => route.id === annotation.routeAttachment!.routeId,
        )
      : undefined;
    const attachmentPlacement =
      attachedRoute && annotation.routeAttachment
        ? routePolyline(document, resolver, attachedRoute)
          ? routeAttachmentPlacement(
              routePolyline(document, resolver, attachedRoute)!,
              annotation.routeAttachment,
            )
          : null
        : null;
    const annotationPosition =
      attachmentPlacement?.position ?? annotation.position;
    const verticalCurrent =
      (attachmentPlacement?.rotation ?? annotation.rotation) === 90 ||
      (attachmentPlacement?.rotation ?? annotation.rotation) === 270;
    const textPosition = attachmentPlacement
      ? attachmentPlacement.labelPosition
      : {
          x: annotationPosition.x + (verticalCurrent ? 15 : 0),
          y: annotationPosition.y + (verticalCurrent ? 4 : 0),
        };
    bounds.push(
      estimatedTextBounds(
        annotation.text,
        textPosition.x,
        textPosition.y,
        attachmentPlacement
          ? "middle"
          : verticalCurrent
            ? "start"
            : annotation.alignment,
        annotation.sizeScale ?? 1,
      ),
    );
  }
  // ADR 0010 WP-R2: drafting objects extend the formal export bounds so
  // callouts and floating symbols outside the circuit are not clipped. Guides
  // are editor-only and never affect bounds. Resolved geometry is derived.
  for (const object of document.drafting?.objects ?? []) {
    const geometry = resolveDraftingObjectGeometry(document, resolver, object);
    bounds.push(geometry.bounds);
  }
  if (bounds.length === 0) {
    return { x: 0, y: 0, width: 960, height: 640 };
  }
  const minX = Math.min(...bounds.map((bound) => bound.x)) - margin;
  const minY = Math.min(...bounds.map((bound) => bound.y)) - margin;
  const maxX =
    Math.max(...bounds.map((bound) => bound.x + bound.width)) + margin;
  const maxY =
    Math.max(...bounds.map((bound) => bound.y + bound.height)) + margin;
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function buildSvgScene(
  input: SchematicDocument,
  resolver: SymbolResolver,
  options: SvgRenderOptions = {},
): SvgScene {
  const document = SchematicDocumentSchema.parse(input);
  const profile = resolveSchematicStyleProfile(
    document.presentation.styleProfileId,
  );
  const margin = options.margin ?? 40;
  if (!Number.isInteger(margin) || margin < 0) {
    throw new Error("SVG margin must be a non-negative integer");
  }
  const viewBox = options.bounds
    ? RectSchema.parse(options.bounds)
    : deriveBounds(document, resolver, margin, profile);

  const routes = [...document.routes]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((route) => {
      const polyline = routePolyline(document, resolver, route);
      if (!polyline) {
        throw new Error(`Cannot render unresolved route: ${route.id}`);
      }
      const terminalOverlaps = renderTerminalJoinOverlaps(
        document,
        resolver,
        route,
        polyline.points,
        profile,
      );
      return `<polyline data-object-id="${escapeXml(route.id)}" data-net-id="${escapeXml(route.netId)}" points="${pointList(polyline.points)}" fill="none" stroke="${profile.foreground}" stroke-width="${profile.strokes.wire}" stroke-linecap="${profile.lineCap}" stroke-linejoin="${profile.lineJoin}"${profileMiterAttribute(profile)}/>${terminalOverlaps}`;
    })
    .join("");
  const junctions = [...document.junctions]
    .filter((junction) => (junction.role ?? "branch") === "branch")
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map(
      (junction) =>
        `<circle data-object-id="${escapeXml(junction.id)}" cx="${junction.position.x}" cy="${junction.position.y}" r="${profile.nodes.junctionRadius}" fill="${profile.foreground}"/>`,
    )
    .join("");
  const powerPortIds = new Set(
    document.annotations
      .filter((annotation) => annotation.kind === "power-label")
      .map((annotation) => annotation.attachedObjectId)
      .filter((id): id is string => id !== undefined),
  );
  const portOrigins =
    profile.nodes.portOriginRadius === 0
      ? ""
      : [...document.ports]
          .filter(
            (port) => port.position !== null && !powerPortIds.has(port.id),
          )
          .sort((left, right) => left.id.localeCompare(right.id, "en"))
          .map((port) =>
            profile.id === "razavi-textbook-v1"
              ? `<circle data-object-id="${escapeXml(port.id)}" data-node-kind="port-origin" cx="${port.position!.x}" cy="${port.position!.y}" r="${profile.nodes.portOriginRadius}" fill="${profile.background}" stroke="${profile.foreground}" stroke-width="${profile.strokes.normal}"/>`
              : `<circle data-object-id="${escapeXml(port.id)}" data-node-kind="port-origin" cx="${port.position!.x}" cy="${port.position!.y}" r="${profile.nodes.portOriginRadius}" fill="${profile.foreground}"/>`,
          )
          .join("");
  const portLayer =
    profile.nodes.portOriginRadius === 0
      ? ""
      : `<g data-layer="ports">${portOrigins}</g>`;
  const explicitInstanceLabels = new Set(
    document.annotations
      .filter(
        (annotation) =>
          annotation.kind === "instance-label" && annotation.attachedObjectId,
      )
      .map((annotation) => annotation.attachedObjectId!),
  );
  const symbols = [...document.instances]
    .filter((instance) => instance.placement !== null)
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((instance) => {
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) {
        throw new Error(`Unresolved symbol: ${instance.symbolId}`);
      }
      const primitives = renderSymbolDefinitionBody(
        resolved.definition,
        resolved.variant?.hiddenPrimitiveParts,
        resolved.variant?.additionalPrimitives,
        profile,
      );
      const pinNames = renderVisiblePinNames(
        resolved.definition,
        resolved.variant?.hiddenPinNames ?? [],
        instance,
        profile,
      );
      const bounds = symbolBounds(resolved.definition, instance);
      const labelX = bounds.x + bounds.width / 2;
      const labelY =
        profile.id === "textbook-monochrome-v1"
          ? bounds.y + bounds.height + 14
          : bounds.y +
            bounds.height +
            profile.typography.labelGap +
            profile.typography.instanceFontSize;
      const labelHiddenBySymbol =
        resolved.definition.labelVisibility === "hidden";
      const defaultLabel =
        explicitInstanceLabels.has(instance.id) || labelHiddenBySymbol
          ? ""
          : `<text x="${labelX}" y="${labelY}" text-anchor="middle"${schematicTextSizeAttribute("default-instance", profile)}>${renderSchematicTextContent(instance.id, "default-instance", profile)}</text>`;
      return `<g data-object-id="${escapeXml(instance.id)}" data-symbol-id="${escapeXml(resolved.definition.id)}"><g transform="${instanceTransform(instance)}"><g fill="none" stroke="${profile.foreground}" stroke-width="${profile.strokes.symbol}" stroke-linecap="${profile.lineCap}" stroke-linejoin="${profile.lineJoin}"${profileMiterAttribute(profile)}>${primitives}</g></g>${pinNames}${defaultLabel}</g>`;
    })
    .join("");
  const annotations = [...document.annotations]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((annotation) => {
      const attachment = annotation.attachedObjectId
        ? ` data-attached-object-id="${escapeXml(annotation.attachedObjectId)}"`
        : "";
      const attachedRoute = annotation.routeAttachment
        ? document.routes.find(
            (route) => route.id === annotation.routeAttachment!.routeId,
          )
        : undefined;
      const attachmentPlacement =
        attachedRoute && annotation.routeAttachment
          ? routePolyline(document, resolver, attachedRoute)
            ? routeAttachmentPlacement(
                routePolyline(document, resolver, attachedRoute)!,
                annotation.routeAttachment,
              )
            : null
          : null;
      // A route-marker resolves its VisualAnchor to a position/rotation for
      // rendering. A free anchor uses fallbackPosition; a route anchor reuses
      // the legacy routeAttachment math when its route is present.
      const routeMarkerAnchor = annotation.anchor;
      const routeMarkerPlacement =
        annotation.kind === "route-marker" && routeMarkerAnchor
          ? routeMarkerAnchor.kind === "free"
            ? {
                position: routeMarkerAnchor.position,
                labelPosition: routeMarkerAnchor.position,
                rotation: 0 as const,
              }
            : routeMarkerAnchor.kind === "object"
              ? {
                  position: routeMarkerAnchor.fallbackPosition,
                  labelPosition: routeMarkerAnchor.fallbackPosition,
                  rotation: 0 as const,
                }
              : resolveRouteMarkerPlacement(
                  document,
                  resolver,
                  routeMarkerAnchor,
                )
          : null;
      const position =
        routeMarkerPlacement?.position ??
        attachmentPlacement?.position ??
        annotation.position;
      const rotation =
        routeMarkerPlacement?.rotation ??
        attachmentPlacement?.rotation ??
        annotation.rotation;
      const transform = `rotate(${rotation} ${position.x} ${position.y})`;
      const attributes = `data-object-id="${escapeXml(annotation.id)}" data-kind="${annotation.kind}"${attachment}`;
      if (
        annotation.kind === "route-marker" &&
        annotation.markerKind === "current"
      ) {
        const x = position.x;
        const y = position.y;
        const vertical = rotation === 90 || rotation === 270;
        const label = routeMarkerPlacement?.labelPosition;
        const textX = vertical ? x + 15 : x;
        const textY = vertical ? y + 4 : y - 7;
        const textAnchor =
          routeMarkerPlacement || attachmentPlacement
            ? "middle"
            : vertical
              ? "start"
              : annotation.alignment;
        if (profile.id !== "textbook-monochrome-v1") {
          const arrow = profile.annotations;
          // A route-marker is mounted on an existing route, so that route is
          // the arrow shaft.  Draw only the triangular head; a separate fixed
          // shaft leaves visible stubs on short/vertical wires.
          const tipX = x + arrow.arrowHeadLength / 2;
          const baseX = x - arrow.arrowHeadLength / 2;
          const halfHeadWidth = arrow.arrowHeadWidth / 2;
          const razaviTextX = label
            ? label.x
            : attachmentPlacement
              ? attachmentPlacement.labelPosition.x
              : vertical
                ? x + arrow.arrowHeadLength / 2 + arrow.currentLabelGap
                : x;
          const razaviTextY = label
            ? label.y
            : attachmentPlacement
              ? attachmentPlacement.labelPosition.y
              : vertical
                ? y + 4
                : y - arrow.currentLabelGap;
          return `<g ${attributes}><g transform="${transform}"><polygon data-role="current-arrow-head" points="${tipX},${y} ${baseX},${y - halfHeadWidth} ${baseX},${y + halfHeadWidth}" fill="${profile.foreground}"/></g><text x="${razaviTextX}" y="${razaviTextY}" text-anchor="${textAnchor}"${schematicTextSizeAttribute("route-marker", profile, annotation.sizeScale)}>${renderAnnotationText(annotation, profile)}</text></g>`;
        }
        return `<g ${attributes}><g transform="${transform}"><line x1="${x - 12}" y1="${y}" x2="${x + 10}" y2="${y}" stroke="${profile.foreground}" stroke-width="${profile.strokes.annotation}"/><polygon points="${x + 12},${y} ${x + 5},${y - 4} ${x + 5},${y + 4}" fill="${profile.foreground}"/></g><text x="${textX}" y="${textY}" text-anchor="${textAnchor}"${schematicTextSizeAttribute("route-marker", profile, annotation.sizeScale)}>${renderAnnotationText(annotation, profile)}</text></g>`;
      }
      if (
        profile.id !== "textbook-monochrome-v1" &&
        annotation.kind === "power-label"
      ) {
        const port = document.ports.find(
          (candidate) => candidate.id === annotation.attachedObjectId,
        );
        const supplyBar =
          port?.position && profile.annotations.supplyBarWidth > 0
            ? `<line data-role="supply-bar" x1="${port.position.x - profile.annotations.supplyBarWidth / 2}" y1="${port.position.y}" x2="${port.position.x + profile.annotations.supplyBarWidth / 2}" y2="${port.position.y}" transform="rotate(${annotation.rotation} ${port.position.x} ${port.position.y})" stroke="${profile.foreground}" stroke-width="${profile.strokes.supply}" stroke-linecap="${profile.lineCap}"/>`
            : "";
        return `<g ${attributes}>${supplyBar}<text x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}" transform="${transform}"${schematicTextSizeAttribute("power-label", profile, annotation.sizeScale)}>${renderAnnotationText(annotation, profile)}</text></g>`;
      }
      if (
        profile.id !== "textbook-monochrome-v1" &&
        annotation.kind === "route-marker" &&
        annotation.markerKind === "voltage"
      ) {
        const polarity = profile.annotations;
        const positiveOffset = rotateOffset(
          { x: -polarity.polarityOffsetX, y: -polarity.polarityHalfGap },
          annotation.rotation,
        );
        const negativeOffset = rotateOffset(
          { x: -polarity.polarityOffsetX, y: polarity.polarityHalfGap },
          annotation.rotation,
        );
        const polarityStyle = `font-style:normal;font-weight:${profile.typography.plainWeight}`;
        return `<g ${attributes}><text data-role="polarity-positive" x="${annotation.position.x + positiveOffset.x}" y="${annotation.position.y + positiveOffset.y + 4}" text-anchor="middle" font-size="${profile.typography.polarityFontSize}" style="${polarityStyle}">+</text><text data-role="polarity-negative" x="${annotation.position.x + negativeOffset.x}" y="${annotation.position.y + negativeOffset.y + 4}" text-anchor="middle" font-size="${profile.typography.polarityFontSize}" style="${polarityStyle}">−</text><text x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}"${schematicTextSizeAttribute("route-marker", profile, annotation.sizeScale)}>${renderAnnotationText(annotation, profile)}</text></g>`;
      }
      const emphasis =
        profile.id === "textbook-monochrome-v1" &&
        annotation.kind === "power-label"
          ? ' font-weight="bold"'
          : "";
      return `<text ${attributes} x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}" transform="${transform}"${emphasis}${schematicTextSizeAttribute(annotation.kind, profile, annotation.sizeScale)}>${renderAnnotationText(annotation, profile)}</text>`;
    })
    .join("");

  return {
    viewBox,
    formalBody: `<g data-layer="formal"><g data-layer="routes">${routes}</g>${portLayer}<g data-layer="junctions">${junctions}</g><g data-layer="symbols">${symbols}</g><g data-layer="annotations">${annotations}</g>${renderDraftingLayer(document, resolver, profile)}</g>`,
  };
}

// Resolve a route-marker route VisualAnchor to a render position/rotation,
// reusing the legacy routeAttachmentPlacement math so a migrated current
// marker renders identically to its pre-migration form.
function resolveRouteMarkerPlacement(
  document: SchematicDocument,
  resolver: SymbolResolver,
  anchor: Extract<
    SchematicDocument["annotations"][number]["anchor"],
    { kind: "route" }
  >,
): {
  position: Point;
  labelPosition: Point;
  rotation: 0 | 90 | 180 | 270;
} | null {
  const route = document.routes.find(
    (candidate) => candidate.id === anchor.routeId,
  );
  if (!route)
    return {
      position: anchor.fallbackPosition,
      labelPosition: anchor.fallbackPosition,
      rotation: 0,
    };
  const polyline = routePolyline(document, resolver, route);
  if (!polyline)
    return {
      position: anchor.fallbackPosition,
      labelPosition: anchor.fallbackPosition,
      rotation: 0,
    };
  const placement = routeAttachmentPlacement(polyline, {
    routeId: anchor.routeId,
    segmentIndex: anchor.segmentIndex,
    t: anchor.t,
    normalOffset: anchor.normalOffset,
    direction: anchor.direction,
  });
  if (!placement)
    return {
      position: anchor.fallbackPosition,
      labelPosition: anchor.fallbackPosition,
      rotation: 0,
    };
  // The arrow (and its rotation center) sits on the conductor at the route
  // attachment point; the label rides on the normal offset. This mirrors the
  // legacy current-arrow rendering exactly.
  return {
    position: placement.position,
    labelPosition:
      anchor.orientation === "horizontal"
        ? placement.position
        : placement.labelPosition,
    rotation: anchor.orientation === "horizontal" ? 0 : placement.rotation,
  };
}

// ADR 0010 WP-R2: the drafting layer renders every DraftingObject kind by
// consuming the single derived-geometry entry. Guides never render in formal
// output. An unresolved anchor still exports using its fallback position and
// carries a data-anchor-resolved="false" attribute for diagnostics.
function renderDraftingLayer(
  document: SchematicDocument,
  resolver: SymbolResolver,
  profile: SchematicStyleProfile,
): string {
  const objects = document.drafting?.objects ?? [];
  if (objects.length === 0) return "";
  const sorted = [...objects].sort((left, right) => left.zIndex - right.zIndex);
  const body = sorted
    .map((object) => {
      const geometry = resolveDraftingObjectGeometry(
        document,
        resolver,
        object,
      );
      const unresolved =
        geometry.diagnostics.length > 0 ? ' data-anchor-resolved="false"' : "";
      switch (object.kind) {
        case "text":
          return renderDraftText(
            object,
            geometry as Extract<ResolvedDraftingGeometry, { kind: "text" }>,
            profile,
            unresolved,
          );
        case "construction-line":
          return renderConstructionLine(object, profile);
        case "arrow":
          return renderDraftArrow(
            object,
            geometry as Extract<ResolvedDraftingGeometry, { kind: "arrow" }>,
            profile,
            unresolved,
          );
        case "leader":
          return renderDraftLeader(
            object,
            geometry as Extract<ResolvedDraftingGeometry, { kind: "leader" }>,
            profile,
            unresolved,
          );
        case "callout":
          return renderDraftCallout(
            object,
            geometry as Extract<ResolvedDraftingGeometry, { kind: "callout" }>,
            profile,
            unresolved,
          );
        case "floating-symbol":
          return renderFloatingSymbol(
            object,
            geometry as Extract<
              ResolvedDraftingGeometry,
              { kind: "floating-symbol" }
            >,
            resolver,
            profile,
            unresolved,
          );
      }
    })
    .join("");
  return `<g data-layer="drafting">${body}</g>`;
}

function renderDraftText(
  object: Extract<DraftingObject, { kind: "text" }>,
  geometry: Extract<ResolvedDraftingGeometry, { kind: "text" }>,
  profile: SchematicStyleProfile,
  unresolved: string,
): string {
  const { position, rotation } = geometry;
  const fontSize =
    typographyFontSize(object.typographyToken ?? "body", profile) *
    (object.styleOverride?.sizeScale ?? 1);
  const content = renderRichTextDocument(
    object.content as unknown as RichTextDocumentInput,
    profile,
    { lineOriginX: position.x },
  );
  const weight = object.styleOverride?.weight === "bold" ? "bold" : "normal";
  const italic = object.styleOverride?.italic === true ? "italic" : "normal";
  // P1: the renderer consumes geometry.rotation (the single rotation truth),
  // not the raw persisted object rotation.
  return `<text data-object-id="${object.id}" data-kind="draft-text"${unresolved} x="${position.x}" y="${position.y}" text-anchor="${object.alignment}" transform="rotate(${rotation} ${position.x} ${position.y})" font-size="${fontSize}" font-weight="${weight}" font-style="${italic}">${content}</text>`;
}

function renderConstructionLine(
  object: Extract<DraftingObject, { kind: "construction-line" }>,
  profile: SchematicStyleProfile,
): string {
  const points = object.points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const lineStyle = object.styleOverride?.lineStyle ?? object.lineStyle;
  const dash =
    lineStyle === "dashed"
      ? ' stroke-dasharray="6 4"'
      : lineStyle === "dotted"
        ? ' stroke-dasharray="2 3"'
        : "";
  const strokeScale = object.styleOverride?.strokeScale ?? 1;
  const strokeWidth = profile.strokes.annotation * strokeScale;
  return `<polyline data-object-id="${object.id}" data-kind="construction-line" points="${points}" fill="none" stroke="${profile.foreground}" stroke-width="${strokeWidth}" stroke-linecap="${profile.lineCap}"${dash}/>`;
}

function renderDraftArrow(
  object: Extract<DraftingObject, { kind: "arrow" }>,
  geometry: Extract<ResolvedDraftingGeometry, { kind: "arrow" }>,
  profile: SchematicStyleProfile,
  unresolved: string,
): string {
  const from = geometry.from;
  const to = geometry.to;
  const tipX = to.x;
  const tipY = to.y;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // strokeScale widens/narrows the shaft; arrowHeadScale grows/shrinks the head
  // independently. Both multiply the Razavi profile baseline so formal export
  // and the editor canvas share one visual parameter (no raw px in objects).
  const strokeScale = object.styleOverride?.strokeScale ?? 1;
  const headScale = object.styleOverride?.arrowHeadScale ?? 1;
  const strokeWidth = profile.strokes.annotation * strokeScale;
  // Free arrows and route-mounted current arrows intentionally share the
  // profile-owned head proportions. They differ only in shaft ownership: a
  // route marker reuses its conductor, while a free arrow draws its own.
  const head = profile.annotations.arrowHeadLength * headScale;
  const halfHeadWidth = (profile.annotations.arrowHeadWidth * headScale) / 2;
  const nx = (-dy / length) * halfHeadWidth;
  const ny = (dx / length) * halfHeadWidth;
  const baseX = tipX - (dx / length) * head;
  const baseY = tipY - (dy / length) * head;
  const arrowHead = object.styleOverride?.arrowHead ?? "filled";
  const lineStyle = object.styleOverride?.lineStyle ?? "solid";
  const dash =
    lineStyle === "dashed"
      ? ' stroke-dasharray="6 4"'
      : lineStyle === "dotted"
        ? ' stroke-dasharray="2 3"'
        : "";
  const headBody =
    arrowHead === "none"
      ? ""
      : `<polygon points="${tipX},${tipY} ${baseX + nx},${baseY + ny} ${baseX - nx},${baseY - ny}" ${arrowHead === "open" ? `fill="none" stroke="${profile.foreground}" stroke-width="${strokeWidth}"` : `fill="${profile.foreground}"`}/>`;
  // The shaft terminates on the arrow head's base plane, not underneath its
  // tip. This preserves the clean triangular point of Razavi-style arrows at
  // every angle and head scale. A headless arrow remains a complete line.
  const shaftEndX = arrowHead === "none" ? tipX : baseX;
  const shaftEndY = arrowHead === "none" ? tipY : baseY;
  return `<g data-object-id="${object.id}" data-kind="draft-arrow"${unresolved}><line x1="${from.x}" y1="${from.y}" x2="${shaftEndX}" y2="${shaftEndY}" stroke="${profile.foreground}" stroke-width="${strokeWidth}" stroke-linecap="${profile.lineCap}"${dash}/>${headBody}</g>`;
}

function renderDraftLeader(
  object: Extract<DraftingObject, { kind: "leader" }>,
  geometry: Extract<ResolvedDraftingGeometry, { kind: "leader" }>,
  profile: SchematicStyleProfile,
  unresolved: string,
): string {
  const { anchor, target } = geometry;
  return `<line data-object-id="${object.id}" data-kind="draft-leader"${unresolved} x1="${anchor.x}" y1="${anchor.y}" x2="${target.x}" y2="${target.y}" stroke="${profile.foreground}" stroke-width="${profile.strokes.annotation}" stroke-linecap="${profile.lineCap}"/>`;
}

function renderDraftCallout(
  object: Extract<DraftingObject, { kind: "callout" }>,
  geometry: Extract<ResolvedDraftingGeometry, { kind: "callout" }>,
  profile: SchematicStyleProfile,
  unresolved: string,
): string {
  const { textPosition, target, rotation } = geometry;
  const leader = `<line x1="${textPosition.x}" y1="${textPosition.y}" x2="${target.x}" y2="${target.y}" stroke="${profile.foreground}" stroke-width="${profile.strokes.annotation}" stroke-linecap="${profile.lineCap}"/>`;
  const fontSize =
    typographyFontSize(object.typographyToken ?? "body", profile) *
    (object.styleOverride?.sizeScale ?? 1);
  const content = renderRichTextDocument(
    object.content as unknown as RichTextDocumentInput,
    profile,
    { lineOriginX: textPosition.x },
  );
  const weight = object.styleOverride?.weight === "bold" ? "bold" : "normal";
  const italic = object.styleOverride?.italic === true ? "italic" : "normal";
  // P1: renderer consumes geometry.rotation (the single rotation truth).
  return `<g data-object-id="${object.id}" data-kind="draft-callout"${unresolved}>${leader}<text x="${textPosition.x}" y="${textPosition.y}" text-anchor="${object.alignment}" transform="rotate(${rotation} ${textPosition.x} ${textPosition.y})" font-size="${fontSize}" font-weight="${weight}" font-style="${italic}">${content}</text></g>`;
}

function renderFloatingSymbol(
  object: Extract<DraftingObject, { kind: "floating-symbol" }>,
  geometry: Extract<ResolvedDraftingGeometry, { kind: "floating-symbol" }>,
  resolver: SymbolResolver,
  profile: SchematicStyleProfile,
  unresolved: string,
): string {
  const resolved = resolver.resolve(object.symbolId);
  if (!resolved) return "";
  const position = geometry.position;
  const rotation = object.transform.rotation;
  const mirror = object.transform.mirror === "x" ? " scale(-1 1)" : "";
  const hidden = resolved.variant?.hiddenPinNames ?? [];
  const additional = resolved.variant?.additionalPrimitives ?? [];
  const body = renderSymbolDefinitionBody(
    resolved.definition,
    hidden,
    additional,
    profile,
  );
  return `<g data-object-id="${object.id}" data-kind="draft-floating-symbol"${unresolved} data-symbol-id="${escapeXml(object.symbolId)}"><g transform="translate(${position.x} ${position.y}) rotate(${rotation})${mirror}">${body}</g></g>`;
}

function typographyFontSize(
  token: "caption" | "body" | "label",
  profile: SchematicStyleProfile,
): number {
  if (token === "caption") return profile.typography.captionFontSize;
  return profile.typography.annotationFontSize;
}

export function renderDocumentSvg(
  document: SchematicDocument,
  resolver: SymbolResolver,
  options: SvgRenderOptions = {},
): string {
  const scene = buildSvgScene(document, resolver, options);
  const profile = resolveSchematicStyleProfile(
    document.presentation.styleProfileId,
  );
  const title = escapeXml(options.title ?? document.name);
  const { x, y, width, height } = scene.viewBox;
  const scalingRule = profile.scaleFormalStrokes
    ? ""
    : "path,polyline,line,circle{vector-effect:non-scaling-stroke}";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" role="img" aria-labelledby="title" data-style-profile="${profile.id}"><title id="title">${title}</title><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${profile.background}"/><style>text{fill:${profile.foreground};font-family:${profile.typography.fontFamily};font-size:${profile.typography.annotationFontSize}px}${scalingRule}</style>${scene.formalBody}</svg>\n`;
}
