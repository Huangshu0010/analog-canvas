import { transformPoint } from "@icm/model";
import type { Point, Rect, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { resolveEndpointOutwardDirection } from "./endpoint.js";
import { routePolyline } from "./routes.js";

export interface VisualDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  objectIds: readonly string[];
  bounds?: Rect;
  point?: Point;
  parameters?: Readonly<Record<string, string | number | boolean>>;
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

function intersectionBounds(left: Rect, right: Rect): Rect | undefined {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  if (rightEdge <= x || bottomEdge <= y) return undefined;
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function enclosingBounds(input: readonly Rect[]): Rect | undefined {
  if (input.length === 0) return undefined;
  const x = Math.min(...input.map((item) => item.x));
  const y = Math.min(...input.map((item) => item.y));
  const right = Math.max(...input.map((item) => item.x + item.width));
  const bottom = Math.max(...input.map((item) => item.y + item.height));
  return { x, y, width: right - x, height: bottom - y };
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

/**
 * Read-only routing-quality metrics. These report wire-through-symbol,
 * same-Net route overlap, and terminal departure direction. Severity is
 * `info` for departure (evidence) and `warning` for overlap and
 * wire-through-symbol (likely readability defects). They never move objects
 * and never claim good/bad — detour ratio is reported as evidence only.
 */
function pushRoutingQualityMetrics(
  diagnostics: VisualDiagnostic[],
  document: SchematicDocument,
  resolver: SymbolResolver,
  boundsById: Map<string, Rect>,
): void {
  const routePolylines = document.routes
    .map((route) => ({
      route,
      polyline: routePolyline(document, resolver, route),
    }))
    .filter(
      (
        entry,
      ): entry is {
        route: typeof entry.route;
        polyline: NonNullable<typeof entry.polyline>;
      } => entry.polyline !== null,
    );

  // 1. Wire-through-symbol: a Route segment passes through an instance
  //    silhouette that is not one of its terminal endpoints.
  for (const { route, polyline } of routePolylines) {
    const terminalInstances = new Set(
      [route.from, route.to]
        .filter(
          (
            endpoint,
          ): endpoint is Extract<typeof endpoint, { kind: "terminal" }> =>
            endpoint.kind === "terminal",
        )
        .map((endpoint) => endpoint.instanceId),
    );
    for (let index = 1; index < polyline.points.length; index += 1) {
      const from = polyline.points[index - 1]!;
      const to = polyline.points[index]!;
      for (const [instanceId, box] of boundsById) {
        if (terminalInstances.has(instanceId)) continue;
        if (segmentIntersectsRect(from, to, box)) {
          diagnostics.push({
            code: "VISUAL_WIRE_THROUGH_SYMBOL",
            severity: "warning",
            message: `Route ${route.id} passes through instance ${instanceId}`,
            objectIds: [route.id, instanceId],
            bounds: box,
            parameters: { segmentIndex: index - 1 },
          });
        }
      }
    }
  }

  // 2. Same-Net route overlap: two Routes on the same Net share a collinear
  //    overlapping segment (not just a shared endpoint).
  for (let leftIndex = 0; leftIndex < routePolylines.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < routePolylines.length;
      rightIndex += 1
    ) {
      const left = routePolylines[leftIndex]!;
      const right = routePolylines[rightIndex]!;
      if (left.route.netId !== right.route.netId) continue;
      const overlap = firstCollinearOverlap(
        left.polyline.points,
        right.polyline.points,
      );
      if (overlap) {
        diagnostics.push({
          code: "VISUAL_ROUTE_OVERLAP",
          severity: "warning",
          message: `Routes ${left.route.id} and ${right.route.id} overlap on Net ${left.route.netId}`,
          objectIds: [left.route.id, right.route.id],
          ...(overlap.bounds ? { bounds: overlap.bounds } : {}),
          parameters: { netId: left.route.netId },
        });
      }
    }
  }

  // 3. Terminal departure: the first segment of a terminal-anchored Route
  //    should leave along the pin's outward direction. Reported as evidence.
  for (const { route, polyline } of routePolylines) {
    if (route.from.kind !== "terminal") continue;
    if (polyline.points.length < 2) continue;
    const outward = resolveEndpointOutwardDirection(
      document,
      resolver,
      route.from,
    );
    if (!outward) continue;
    const first = polyline.points[0]!;
    const second = polyline.points[1]!;
    const departure = {
      x: Math.sign(second.x - first.x),
      y: Math.sign(second.y - first.y),
    };
    const aligned =
      (outward.x !== 0 && departure.x === outward.x) ||
      (outward.y !== 0 && departure.y === outward.y);
    if (!aligned) {
      diagnostics.push({
        code: "VISUAL_TERMINAL_DEPARTURE",
        severity: "info",
        message: `Route ${route.id} does not leave terminal along its pin outward direction`,
        objectIds: [route.id],
        point: first,
        parameters: {
          outwardX: outward.x,
          outwardY: outward.y,
          departureX: departure.x,
          departureY: departure.y,
        },
      });
    }
  }
}

function segmentIntersectsRect(from: Point, to: Point, box: Rect): boolean {
  // Axial-aligned segment vs axis-aligned rect intersection. A segment whose
  // endpoint lies strictly inside the box counts as passing through.
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  return (
    maxX > box.x &&
    minX < box.x + box.width &&
    maxY > box.y &&
    minY < box.y + box.height
  );
}

function firstCollinearOverlap(
  left: readonly Point[],
  right: readonly Point[],
): { bounds?: Rect } | undefined {
  for (let i = 1; i < left.length; i += 1) {
    const la = left[i - 1]!;
    const lb = left[i]!;
    for (let j = 1; j < right.length; j += 1) {
      const ra = right[j - 1]!;
      const rb = right[j]!;
      // Both segments must be collinear on the same axis-aligned line.
      const sameHorizontal = la.y === lb.y && ra.y === rb.y && la.y === ra.y;
      const sameVertical = la.x === lb.x && ra.x === rb.x && la.x === ra.x;
      if (!sameHorizontal && !sameVertical) continue;
      if (sameHorizontal) {
        const start = Math.max(Math.min(la.x, lb.x), Math.min(ra.x, rb.x));
        const end = Math.min(Math.max(la.x, lb.x), Math.max(ra.x, rb.x));
        if (end > start) {
          return {
            bounds: { x: start, y: la.y, width: end - start, height: 0 },
          };
        }
      } else {
        const start = Math.max(Math.min(la.y, lb.y), Math.min(ra.y, rb.y));
        const end = Math.min(Math.max(la.y, lb.y), Math.max(ra.y, rb.y));
        if (end > start) {
          return {
            bounds: { x: la.x, y: start, width: 0, height: end - start },
          };
        }
      }
    }
  }
  return undefined;
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
        parameters: { placed: false },
      });
    } else if (!resolver.resolve(instance.symbolId, instance.symbolVariantId)) {
      diagnostics.push({
        code: "VISUAL_UNRESOLVED_SYMBOL",
        severity: "error",
        message: `Instance ${instance.id} has an unresolved symbol`,
        objectIds: [instance.id],
        point: instance.placement.position,
        parameters: { symbolId: instance.symbolId },
      });
    }
  }
  for (const [leftIndex, left] of bounds.entries()) {
    for (const right of bounds.slice(leftIndex + 1)) {
      if (rectanglesOverlap(left.bounds, right.bounds)) {
        const overlap = intersectionBounds(left.bounds, right.bounds);
        diagnostics.push({
          code: "VISUAL_SYMBOL_OVERLAP",
          severity: "warning",
          message: `Symbols ${left.id} and ${right.id} overlap`,
          objectIds: [left.id, right.id],
          ...(overlap ? { bounds: overlap } : {}),
        });
      }
    }
  }

  const annotationBounds = document.annotations
    .filter((annotation) => annotation.text.trim().length > 0)
    .map((annotation) => {
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
        const overlap = intersectionBounds(left.bounds, right.bounds);
        diagnostics.push({
          code: "VISUAL_LABEL_OVERLAP",
          severity: "warning",
          message: `Annotations ${left.id} and ${right.id} overlap`,
          objectIds: [left.id, right.id],
          ...(overlap ? { bounds: overlap } : {}),
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
          bounds: {
            x: Math.min(from.x, to.x),
            y: Math.min(from.y, to.y),
            width: Math.max(1, Math.abs(to.x - from.x)),
            height: Math.max(1, Math.abs(to.y - from.y)),
          },
          parameters: { segmentIndex: index - 1, length },
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
          point: junction.position,
          parameters: {
            junctionNetId: junction.netId,
            routeNetId: route.netId,
          },
        });
      }
    }
  }

  for (const constraint of document.constraints) {
    if (constraintViolation(document, constraint, boundsById)) {
      const violationBounds = enclosingBounds(
        constraint.objectIds.flatMap((id) => {
          const item = boundsById.get(id);
          return item ? [item] : [];
        }),
      );
      diagnostics.push({
        code: "VISUAL_CONSTRAINT_VIOLATION",
        severity: "warning",
        message: `Layout constraint ${constraint.id} is not satisfied`,
        objectIds: [constraint.id, ...constraint.objectIds],
        ...(violationBounds ? { bounds: violationBounds } : {}),
        parameters: { constraintKind: constraint.kind },
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
          bounds: item.bounds,
          parameters: { pageBounds: JSON.stringify(page) },
        });
      }
    }
  }
  // Read-only routing-quality metrics. These are evidence, not pass/fail
  // judges: they report wire-through-symbol, same-Net route overlap, and
  // terminal departure direction. They never move objects.
  pushRoutingQualityMetrics(diagnostics, document, resolver, boundsById);
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
