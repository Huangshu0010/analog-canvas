import {
  RectSchema,
  SchematicDocumentSchema,
  transformPoint,
} from "@icm/model";
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
  const bounds = document.instances
    .filter((instance) => instance.placement !== null)
    .map((instance) => {
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) {
        throw new Error(`Unresolved symbol: ${instance.symbolId}`);
      }
      return symbolBounds(resolved.definition, instance);
    });
  if (bounds.length === 0) {
    return { x: 0, y: 0, width: 960, height: 640 };
  }
  const minX = Math.min(...bounds.map((bound) => bound.x)) - margin;
  const minY = Math.min(...bounds.map((bound) => bound.y)) - margin;
  const maxX =
    Math.max(...bounds.map((bound) => bound.x + bound.width)) + margin;
  const maxY =
    Math.max(...bounds.map((bound) => bound.y + bound.height)) + margin;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
    .map(() => "")
    .join("");
  const junctions = [...document.junctions]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map(
      (junction) =>
        `<circle data-object-id="${escapeXml(junction.id)}" cx="${junction.position.x}" cy="${junction.position.y}" r="1.75" fill="#000"/>`,
    )
    .join("");
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
      const primitives = resolved.definition.primitives
        .map(renderPrimitive)
        .join("");
      const labelY =
        resolved.definition.viewBox.y + resolved.definition.viewBox.height + 14;
      return `<g data-object-id="${escapeXml(instance.id)}" data-symbol-id="${escapeXml(resolved.definition.id)}" transform="${instanceTransform(instance)}"><g fill="none" stroke="#000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter">${primitives}</g><text x="0" y="${labelY}" text-anchor="middle">${escapeXml(instance.id)}</text></g>`;
    })
    .join("");
  const annotations = [...document.annotations]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map(
      (annotation) =>
        `<text data-object-id="${escapeXml(annotation.id)}" x="${annotation.position.x}" y="${annotation.position.y}" text-anchor="${annotation.alignment}" transform="rotate(${annotation.rotation} ${annotation.position.x} ${annotation.position.y})">${escapeXml(annotation.text)}</text>`,
    )
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
