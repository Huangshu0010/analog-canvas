import { transformPoint } from "@icm/model";
import type { Point, Rect, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { routePolyline } from "./routes.js";

export interface VisualDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  objectIds: readonly string[];
}

export interface VisualDiagnosticOptions {
  minimumSegmentLength?: number;
  pageBounds?: Rect;
}

function rectanglesOverlap(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function pointOnSegment(point: Point, from: Point, to: Point): boolean {
  return (
    (from.x === to.x &&
      point.x === from.x &&
      point.y >= Math.min(from.y, to.y) &&
      point.y <= Math.max(from.y, to.y)) ||
    (from.y === to.y &&
      point.y === from.y &&
      point.x >= Math.min(from.x, to.x) &&
      point.x <= Math.max(from.x, to.x))
  );
}

function instanceBounds(
  document: SchematicDocument,
  resolver: SymbolResolver,
): Array<{ id: string; bounds: Rect }> {
  return document.instances.flatMap((instance) => {
    if (!instance.placement) return [];
    const resolved = resolver.resolve(
      instance.symbolId,
      instance.symbolVariantId,
    );
    if (!resolved) return [];
    const box = resolved.definition.viewBox;
    const corners = [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height },
      { x: box.x + box.width, y: box.y + box.height },
    ].map((point) =>
      transformPoint(point, instance.placement!.position, instance.placement!),
    );
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return [
      {
        id: instance.id,
        bounds: {
          x,
          y,
          width: Math.max(...xs) - x,
          height: Math.max(...ys) - y,
        },
      },
    ];
  });
}

function objectAnchor(
  document: SchematicDocument,
  objectId: string,
): Point | null {
  const instance = document.instances.find((item) => item.id === objectId);
  if (instance?.placement) return instance.placement.position;
  const annotation = document.annotations.find((item) => item.id === objectId);
  if (annotation) return annotation.position;
  const port = document.ports.find((item) => item.id === objectId);
  if (port?.position) return port.position;
  const junction = document.junctions.find((item) => item.id === objectId);
  return junction?.position ?? null;
}

function constraintViolation(
  document: SchematicDocument,
  constraint: SchematicDocument["constraints"][number],
  boundsById: ReadonlyMap<string, Rect>,
): boolean {
  const anchors = constraint.objectIds.map((id) => objectAnchor(document, id));
  if (anchors.some((point) => point === null)) return true;
  const points = anchors as Point[];
  switch (constraint.kind) {
    case "align-x":
      return points.some((point) => point.x !== points[0]!.x);
    case "align-y":
      return points.some((point) => point.y !== points[0]!.y);
    case "equal-spacing": {
      const xRange =
        Math.max(...points.map((point) => point.x)) -
        Math.min(...points.map((point) => point.x));
      const yRange =
        Math.max(...points.map((point) => point.y)) -
        Math.min(...points.map((point) => point.y));
      const coordinates = points
        .map((point) => (xRange >= yRange ? point.x : point.y))
        .sort((left, right) => left - right);
      if (coordinates.length < 3) return false;
      const spacing = coordinates[1]! - coordinates[0]!;
      return coordinates
        .slice(2)
        .some((value, index) => value - coordinates[index + 1]! !== spacing);
    }
    case "symmetric": {
      if (points.length % 2 !== 0) return true;
      const axisSum = points[0]!.x + points[1]!.x;
      for (let index = 0; index < points.length; index += 2) {
        if (
          points[index]!.y !== points[index + 1]!.y ||
          points[index]!.x + points[index + 1]!.x !== axisSum
        ) {
          return true;
        }
      }
      return false;
    }
    case "keep-clear":
      return constraint.objectIds.some((leftId, leftIndex) =>
        constraint.objectIds.slice(leftIndex + 1).some((rightId) => {
          const left = boundsById.get(leftId);
          const right = boundsById.get(rightId);
          return left && right ? rectanglesOverlap(left, right) : false;
        }),
      );
  }
}

export function diagnoseVisualQuality(
  document: SchematicDocument,
  resolver: SymbolResolver,
  options: VisualDiagnosticOptions = {},
): readonly VisualDiagnostic[] {
  const diagnostics: VisualDiagnostic[] = [];
  const minimumSegmentLength =
    options.minimumSegmentLength ?? document.presentation.grid;
  const bounds = instanceBounds(document, resolver);
  const boundsById = new Map(bounds.map((item) => [item.id, item.bounds]));

  for (const instance of document.instances) {
    if (!instance.placement) {
      diagnostics.push({
        code: "VISUAL_UNPLACED_INSTANCE",
        severity: "warning",
        message: `Instance ${instance.id} is not placed`,
        objectIds: [instance.id],
      });
    } else if (!resolver.resolve(instance.symbolId, instance.symbolVariantId)) {
      diagnostics.push({
        code: "VISUAL_UNRESOLVED_SYMBOL",
        severity: "error",
        message: `Instance ${instance.id} has an unresolved symbol`,
        objectIds: [instance.id],
      });
    }
  }
  for (const [leftIndex, left] of bounds.entries()) {
    for (const right of bounds.slice(leftIndex + 1)) {
      if (rectanglesOverlap(left.bounds, right.bounds)) {
        diagnostics.push({
          code: "VISUAL_SYMBOL_OVERLAP",
          severity: "warning",
          message: `Symbols ${left.id} and ${right.id} overlap`,
          objectIds: [left.id, right.id],
        });
      }
    }
  }

  const annotationBounds = document.annotations.map((annotation) => {
    const width = Math.max(8, annotation.text.length * 7);
    const x =
      annotation.alignment === "middle"
        ? annotation.position.x - width / 2
        : annotation.alignment === "end"
          ? annotation.position.x - width
          : annotation.position.x;
    return {
      id: annotation.id,
      bounds: { x, y: annotation.position.y - 12, width, height: 15 },
    };
  });
  for (const [leftIndex, left] of annotationBounds.entries()) {
    for (const right of annotationBounds.slice(leftIndex + 1)) {
      if (rectanglesOverlap(left.bounds, right.bounds)) {
        diagnostics.push({
          code: "VISUAL_LABEL_OVERLAP",
          severity: "warning",
          message: `Annotations ${left.id} and ${right.id} overlap`,
          objectIds: [left.id, right.id],
        });
      }
    }
  }

  for (const route of document.routes) {
    const polyline = routePolyline(document, resolver, route);
    if (!polyline) continue;
    for (let index = 1; index < polyline.points.length; index += 1) {
      const from = polyline.points[index - 1]!;
      const to = polyline.points[index]!;
      const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      if (length < minimumSegmentLength) {
        diagnostics.push({
          code: "VISUAL_SHORT_SEGMENT",
          severity: "warning",
          message: `Route ${route.id} contains a short segment`,
          objectIds: [route.id],
        });
        break;
      }
    }
  }
  for (const junction of document.junctions) {
    for (const route of document.routes) {
      if (route.netId === junction.netId) continue;
      const polyline = routePolyline(document, resolver, route);
      if (
        polyline?.points
          .slice(1)
          .some((to, index) =>
            pointOnSegment(junction.position, polyline.points[index]!, to),
          )
      ) {
        diagnostics.push({
          code: "VISUAL_AMBIGUOUS_JUNCTION",
          severity: "error",
          message: `Junction ${junction.id} lies on unrelated route ${route.id}`,
          objectIds: [junction.id, route.id],
        });
      }
    }
  }

  for (const constraint of document.constraints) {
    if (constraintViolation(document, constraint, boundsById)) {
      diagnostics.push({
        code: "VISUAL_CONSTRAINT_VIOLATION",
        severity: "warning",
        message: `Layout constraint ${constraint.id} is not satisfied`,
        objectIds: [constraint.id, ...constraint.objectIds],
      });
    }
  }
  if (options.pageBounds) {
    for (const item of [...bounds, ...annotationBounds]) {
      const page = options.pageBounds;
      if (
        item.bounds.x < page.x ||
        item.bounds.y < page.y ||
        item.bounds.x + item.bounds.width > page.x + page.width ||
        item.bounds.y + item.bounds.height > page.y + page.height
      ) {
        diagnostics.push({
          code: "VISUAL_OUTSIDE_PAGE",
          severity: "warning",
          message: `Object ${item.id} extends outside the export page`,
          objectIds: [item.id],
        });
      }
    }
  }
  return diagnostics.sort((left, right) =>
    `${left.code}\0${left.objectIds.join("\0")}`.localeCompare(
      `${right.code}\0${right.objectIds.join("\0")}`,
      "en",
    ),
  );
}

export function hasBlockingVisualDiagnostics(
  diagnostics: readonly VisualDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
