import {
  RectSchema,
  SchematicDocumentSchema,
  transformPoint,
} from "@icm/model";
import { routePolyline } from "@icm/derived";
import type { Rect, SchematicDocument } from "@icm/model";
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

export interface SvgRenderOptions {
  bounds?: Rect;
  margin?: number;
  title?: string;
}

export interface SvgScene {
  viewBox: Rect;
  formalBody: string;
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
      return `<circle cx="${primitive.center.x}" cy="${primitive.center.y}" r="${primitive.radius}"${style}/>`;
    case "path":
      return `<path d="${escapeXml(primitive.data)}"${style}/>`;
    case "polygon":
      return `<polygon points="${pointList(primitive.points)}" fill="${primitive.fill === "foreground" ? profile.foreground : "none"}"${style}/>`;
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
  ): Rect => {
    const width = Math.max(7, text.length * 7);
    const left =
      alignment === "start"
        ? x
        : alignment === "end"
          ? x - width
          : x - width / 2;
    return {
      x: Math.floor(left),
      y: y - 13,
      width: Math.ceil(width),
      height: 17,
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
    const verticalCurrent =
      annotation.kind === "current" &&
      (annotation.rotation === 90 || annotation.rotation === 270);
    bounds.push(
      estimatedTextBounds(
        annotation.text,
        annotation.position.x + (verticalCurrent ? 15 : 0),
        annotation.position.y + (verticalCurrent ? 4 : 0),
        verticalCurrent ? "start" : annotation.alignment,
      ),
    );
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
      return `<polyline data-object-id="${escapeXml(route.id)}" data-net-id="${escapeXml(route.netId)}" points="${pointList(polyline.points)}" fill="none" stroke="${profile.foreground}" stroke-width="${profile.strokes.wire}" stroke-linecap="${profile.lineCap}" stroke-linejoin="${profile.lineJoin}"${profileMiterAttribute(profile)}/>`;
    })
    .join("");
  const junctions = [...document.junctions]
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
          .map(
            (port) =>
              `<circle data-object-id="${escapeXml(port.id)}" data-node-kind="port-origin" cx="${port.position!.x}" cy="${port.position!.y}" r="${profile.nodes.portOriginRadius}" fill="${profile.foreground}"/>`,
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
      const defaultLabel = explicitInstanceLabels.has(instance.id)
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
      const transform = `rotate(${annotation.rotation} ${annotation.position.x} ${annotation.position.y})`;
      const attributes = `data-object-id="${escapeXml(annotation.id)}" data-kind="${annotation.kind}"${attachment}`;
      if (annotation.kind === "current") {
        const x = annotation.position.x;
        const y = annotation.position.y;
        const vertical =
          annotation.rotation === 90 || annotation.rotation === 270;
        const textX = vertical ? x + 15 : x;
        const textY = vertical ? y + 4 : y - 7;
        const textAnchor = vertical ? "start" : annotation.alignment;
        if (profile.id !== "textbook-monochrome-v1") {
          const arrow = profile.annotations;
          const halfLength = arrow.currentArrowLength / 2;
          const tipX = x + halfLength;
          const baseX = tipX - arrow.arrowHeadLength;
          const halfHeadWidth = arrow.arrowHeadWidth / 2;
          const razaviTextX = vertical
            ? x + halfLength + arrow.currentLabelGap
            : x;
          const razaviTextY = vertical ? y + 4 : y - arrow.currentLabelGap;
          return `<g ${attributes}><g transform="${transform}"><line data-role="current-arrow-shaft" x1="${x - halfLength}" y1="${y}" x2="${baseX}" y2="${y}" stroke="${profile.foreground}" stroke-width="${profile.strokes.annotation}" stroke-linecap="${profile.lineCap}"/><polygon data-role="current-arrow-head" points="${tipX},${y} ${baseX},${y - halfHeadWidth} ${baseX},${y + halfHeadWidth}" fill="${profile.foreground}"/></g><text x="${razaviTextX}" y="${razaviTextY}" text-anchor="${textAnchor}"${schematicTextSizeAttribute("current", profile)}>${renderSchematicTextContent(annotation.text, "current", profile)}</text></g>`;
        }
        return `<g ${attributes}><g transform="${transform}"><line x1="${x - 12}" y1="${y}" x2="${x + 10}" y2="${y}" stroke="${profile.foreground}" stroke-width="${profile.strokes.annotation}"/><polygon points="${x + 12},${y} ${x + 5},${y - 4} ${x + 5},${y + 4}" fill="${profile.foreground}"/></g><text x="${textX}" y="${textY}" text-anchor="${textAnchor}"${schematicTextSizeAttribute("current", profile)}>${renderSchematicTextContent(annotation.text, "current", profile)}</text></g>`;
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
        return `<g ${attributes}>${supplyBar}<text x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}" transform="${transform}"${schematicTextSizeAttribute("power-label", profile)}>${renderSchematicTextContent(annotation.text, "power-label", profile)}</text></g>`;
      }
      if (
        profile.id !== "textbook-monochrome-v1" &&
        annotation.kind === "voltage"
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
        return `<g ${attributes}><text data-role="polarity-positive" x="${annotation.position.x + positiveOffset.x}" y="${annotation.position.y + positiveOffset.y + 4}" text-anchor="middle" font-size="${profile.typography.polarityFontSize}" style="${polarityStyle}">+</text><text data-role="polarity-negative" x="${annotation.position.x + negativeOffset.x}" y="${annotation.position.y + negativeOffset.y + 4}" text-anchor="middle" font-size="${profile.typography.polarityFontSize}" style="${polarityStyle}">−</text><text x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}"${schematicTextSizeAttribute("voltage", profile)}>${renderSchematicTextContent(annotation.text, "voltage", profile)}</text></g>`;
      }
      const emphasis =
        profile.id === "textbook-monochrome-v1" &&
        annotation.kind === "power-label"
          ? ' font-weight="bold"'
          : profile.id === "textbook-monochrome-v1" &&
              annotation.kind === "figure-caption"
            ? ' font-style="italic"'
            : "";
      return `<text ${attributes} x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}" transform="${transform}"${emphasis}${schematicTextSizeAttribute(annotation.kind, profile)}>${renderSchematicTextContent(annotation.text, annotation.kind, profile)}</text>`;
    })
    .join("");

  return {
    viewBox,
    formalBody: `<g data-layer="formal"><g data-layer="routes">${routes}</g>${portLayer}<g data-layer="junctions">${junctions}</g><g data-layer="symbols">${symbols}</g><g data-layer="annotations">${annotations}</g></g>`,
  };
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
