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

function renderPrimitive(primitive: SymbolPrimitive): string {
  switch (primitive.kind) {
    case "line":
      return `<line x1="${primitive.from.x}" y1="${primitive.from.y}" x2="${primitive.to.x}" y2="${primitive.to.y}"/>`;
    case "polyline":
      return `<polyline points="${pointList(primitive.points)}"/>`;
    case "circle":
      return `<circle cx="${primitive.center.x}" cy="${primitive.center.y}" r="${primitive.radius}"/>`;
    case "path":
      return `<path d="${escapeXml(primitive.data)}"/>`;
    case "polygon":
      return `<polygon points="${pointList(primitive.points)}" fill="${primitive.fill === "foreground" ? "#000" : "none"}"/>`;
  }
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
  const margin = options.margin ?? 40;
  if (!Number.isInteger(margin) || margin < 0) {
    throw new Error("SVG margin must be a non-negative integer");
  }
  const viewBox = options.bounds
    ? RectSchema.parse(options.bounds)
    : deriveBounds(document, resolver, margin);

  const routes = [...document.routes]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((route) => {
      const polyline = routePolyline(document, resolver, route);
      if (!polyline) {
        throw new Error(`Cannot render unresolved route: ${route.id}`);
      }
      return `<polyline data-object-id="${escapeXml(route.id)}" data-net-id="${escapeXml(route.netId)}" points="${pointList(polyline.points)}" fill="none" stroke="#000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"/>`;
    })
    .join("");
  const junctions = [...document.junctions]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map(
      (junction) =>
        `<circle data-object-id="${escapeXml(junction.id)}" cx="${junction.position.x}" cy="${junction.position.y}" r="1.75" fill="#000"/>`,
    )
    .join("");
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
      const hiddenParts = new Set(resolved.variant?.hiddenPrimitiveParts ?? []);
      const primitives = resolved.definition.primitives
        .filter(
          (primitive) => !primitive.part || !hiddenParts.has(primitive.part),
        )
        .map(renderPrimitive)
        .join("");
      const bounds = symbolBounds(resolved.definition, instance);
      const labelX = bounds.x + bounds.width / 2;
      const labelY = bounds.y + bounds.height + 14;
      const defaultLabel = explicitInstanceLabels.has(instance.id)
        ? ""
        : `<text x="${labelX}" y="${labelY}" text-anchor="middle">${escapeXml(instance.id)}</text>`;
      return `<g data-object-id="${escapeXml(instance.id)}" data-symbol-id="${escapeXml(resolved.definition.id)}"><g transform="${instanceTransform(instance)}"><g fill="none" stroke="#000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter">${primitives}</g></g>${defaultLabel}</g>`;
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
        return `<g ${attributes}><g transform="${transform}"><line x1="${x - 12}" y1="${y}" x2="${x + 10}" y2="${y}" stroke="#000" stroke-width="0.8"/><polygon points="${x + 12},${y} ${x + 5},${y - 4} ${x + 5},${y + 4}" fill="#000"/></g><text x="${textX}" y="${textY}" text-anchor="${textAnchor}">${escapeXml(annotation.text)}</text></g>`;
      }
      const emphasis =
        annotation.kind === "power-label"
          ? ' font-weight="bold"'
          : annotation.kind === "figure-caption"
            ? ' font-style="italic"'
            : "";
      return `<text ${attributes} x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}" transform="${transform}"${emphasis}>${escapeXml(annotation.text)}</text>`;
    })
    .join("");

  return {
    viewBox,
    formalBody: `<g data-layer="formal"><g data-layer="routes">${routes}</g><g data-layer="junctions">${junctions}</g><g data-layer="symbols">${symbols}</g><g data-layer="annotations">${annotations}</g></g>`,
  };
}

export function renderDocumentSvg(
  document: SchematicDocument,
  resolver: SymbolResolver,
  options: SvgRenderOptions = {},
): string {
  const scene = buildSvgScene(document, resolver, options);
  const title = escapeXml(options.title ?? document.name);
  const { x, y, width, height } = scene.viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" role="img" aria-labelledby="title" data-style-profile="textbook-monochrome-v1"><title id="title">${title}</title><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff"/><style>text{fill:#000;font-family:Georgia,'Times New Roman',serif;font-size:12px}path,polyline,line,circle{vector-effect:non-scaling-stroke}</style>${scene.formalBody}</svg>\n`;
}
