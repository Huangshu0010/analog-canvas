import {
  defaultInstanceLabelPlacement,
  measureRichTextDocument,
  richTextMetrics,
  resolveAnnotationPresentation,
  routeAttachmentPlacement,
} from "@icm/derived";
import type { RoutePolyline, SchematicStyleProfile } from "@icm/derived";
import type {
  Annotation,
  Point,
  Rect,
  RouteAnnotationAttachment,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import { schematicTextFontSize } from "@icm/render-svg";
import type { SymbolResolver } from "@icm/symbols";

import { clamp, closestPointOnSegment } from "../../canvas/canvas-geometry";
import { instanceVisibleHitBox } from "../../canvas/instance-geometry";

export interface RoutePolylineRecord {
  route: SchematicDocument["routes"][number];
  polyline: RoutePolyline;
}

export const ROUTED_MARKER_MIN_NORMAL_OFFSET = 12;
export const ROUTED_MARKER_MAX_NORMAL_OFFSET = 40;

export function endpointNetId(
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
      net.terminals.some(
        (terminal) =>
          terminal.instanceId === endpoint.instanceId &&
          terminal.pinName === endpoint.pinName,
      ),
    )?.id ?? null
  );
}

export function junctionRouteDegree(
  document: SchematicDocument,
  junctionId: string,
): number {
  return document.routes.filter(
    (route) =>
      (route.from.kind === "junction" &&
        route.from.junctionId === junctionId) ||
      (route.to.kind === "junction" && route.to.junctionId === junctionId),
  ).length;
}

export function isLooseRouteEndpoint(
  document: SchematicDocument,
  endpoint: RouteEndpoint,
): boolean {
  if (endpoint.kind !== "junction") return false;
  const junction = document.junctions.find(
    (candidate) => candidate.id === endpoint.junctionId,
  );
  if (!junction) return false;
  return (
    junction.role === "route-anchor" ||
    ((junction.role ?? "branch") === "branch" &&
      junctionRouteDegree(document, junction.id) === 1)
  );
}

export function looseRouteAnchorIds(
  document: SchematicDocument,
  route: SchematicDocument["routes"][number],
): [string, string] | null {
  if (
    route.from.kind !== "junction" ||
    route.to.kind !== "junction" ||
    route.from.junctionId === route.to.junctionId ||
    !isLooseRouteEndpoint(document, route.from) ||
    !isLooseRouteEndpoint(document, route.to)
  ) {
    return null;
  }
  return [route.from.junctionId, route.to.junctionId];
}

export function attachmentAtPoint(
  routePolylines: readonly RoutePolylineRecord[],
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

/**
 * Reposition an existing route marker from the desired label position. The
 * electrical route remains authoritative: the marker may slide along the
 * attached route and its label may move only within a small normal-offset
 * band around the arrow. Near the shaft, the existing side is retained so a
 * pointer crossing the conductor does not make the label flicker.
 */
export function dragRouteAttachmentAtPoint(
  routePolylines: readonly RoutePolylineRecord[],
  candidate: Point,
  current: RouteAnnotationAttachment,
): { routeAttachment: RouteAnnotationAttachment; position: Point } | null {
  const record = routePolylines.find(
    ({ route }) => route.id === current.routeId,
  );
  if (!record) return null;
  const candidates = record.polyline.points
    .slice(0, -1)
    .flatMap((from, segmentIndex) => {
      const to = record.polyline.points[segmentIndex + 1]!;
      const position = closestPointOnSegment(candidate, from, to);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared === 0) return [];
      const length = Math.sqrt(lengthSquared);
      const t = clamp(
        ((position.x - from.x) * dx + (position.y - from.y) * dy) /
          lengthSquared,
        0,
        1,
      );
      const normal = { x: -dy / length, y: dx / length };
      const rawNormalOffset =
        (candidate.x - position.x) * normal.x +
        (candidate.y - position.y) * normal.y;
      const previousSign = current.normalOffset >= 0 ? 1 : -1;
      const sign =
        Math.abs(rawNormalOffset) < ROUTED_MARKER_MIN_NORMAL_OFFSET
          ? previousSign
          : rawNormalOffset >= 0
            ? 1
            : -1;
      const normalOffset =
        sign *
        clamp(
          Math.abs(rawNormalOffset),
          ROUTED_MARKER_MIN_NORMAL_OFFSET,
          ROUTED_MARKER_MAX_NORMAL_OFFSET,
        );
      const labelPosition = {
        x: position.x + normal.x * normalOffset,
        y: position.y + normal.y * normalOffset,
      };
      return [
        {
          routeAttachment: {
            ...current,
            segmentIndex,
            t,
            normalOffset,
          },
          position: { x: Math.round(position.x), y: Math.round(position.y) },
          distanceSquared:
            (labelPosition.x - candidate.x) ** 2 +
            (labelPosition.y - candidate.y) ** 2,
        },
      ];
    })
    .sort((left, right) => left.distanceSquared - right.distanceSquared);
  const closest = candidates[0];
  return closest
    ? {
        routeAttachment: closest.routeAttachment,
        position: closest.position,
      }
    : null;
}

export function effectiveRouteAttachment(
  annotation: Annotation,
): RouteAnnotationAttachment | null {
  if (
    annotation.kind === "route-marker" &&
    annotation.anchor.kind === "route"
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

export function isRoutedMarker(annotation: Annotation): boolean {
  return (
    annotation.kind === "route-marker" && annotation.markerKind === "current"
  );
}

export function annotationAnchor(
  document: SchematicDocument,
  resolver: SymbolResolver,
  annotation: Annotation,
  routePolylines: readonly RoutePolylineRecord[],
  styleProfile: SchematicStyleProfile,
): Point {
  const attachment = effectiveRouteAttachment(annotation);
  if (!isRoutedMarker(annotation) || !attachment) {
    return resolveAnnotationPresentation(
      document,
      resolver,
      annotation,
      styleProfile,
    ).position;
  }
  const record = routePolylines.find(
    ({ route }) => route.id === attachment.routeId,
  );
  return (
    (record &&
      routeAttachmentPlacement(record.polyline, attachment)?.position) ??
    resolveAnnotationPresentation(document, resolver, annotation, styleProfile)
      .position
  );
}

export function annotationHitBox(
  annotation: Annotation,
  anchor: Point,
  routePolylines: readonly RoutePolylineRecord[],
  styleProfile: SchematicStyleProfile,
): Rect {
  const sizeScale = annotation.sizeScale ?? 1;
  const fontSize =
    schematicTextFontSize(annotation.kind, styleProfile) * sizeScale;
  const textLayout = measureRichTextDocument(
    annotation.content,
    richTextMetrics(styleProfile, "label", sizeScale),
  );
  let labelPosition = anchor;
  let alignment = annotation.alignment;
  let rotation = annotation.rotation;
  let arrowBounds: Rect | null = null;

  if (isRoutedMarker(annotation)) {
    const routeAttachment = effectiveRouteAttachment(annotation);
    const record = routeAttachment
      ? routePolylines.find(({ route }) => route.id === routeAttachment.routeId)
      : undefined;
    const placement =
      record && routeAttachment
        ? routeAttachmentPlacement(record.polyline, routeAttachment)
        : null;
    rotation = placement?.rotation ?? annotation.rotation;
    const vertical = rotation === 90 || rotation === 270;
    labelPosition = placement?.labelPosition ?? {
      x: anchor.x + (vertical ? 15 : 0),
      y: anchor.y + (vertical ? 4 : -7),
    };
    alignment = placement
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
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

export function instanceHitBox(
  instance: SchematicDocument["instances"][number],
  resolver: SymbolResolver,
): Rect | null {
  if (!instance.placement) return null;
  const resolved = resolver.resolve(
    instance.symbolId,
    instance.symbolVariantId,
  );
  return resolved ? instanceVisibleHitBox(instance, resolved) : null;
}

export function defaultInstanceLabel(
  document: SchematicDocument,
  instance: SchematicDocument["instances"][number],
  resolver: SymbolResolver,
  styleProfile: SchematicStyleProfile,
): Annotation | null {
  if (!instance.placement) return null;
  if (
    document.annotations.some(
      (annotation) =>
        annotation.kind === "instance-label" &&
        annotation.anchor.kind === "object" &&
        annotation.anchor.objectId === instance.id,
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
    resolved,
    styleProfile,
    document.presentation.grid,
  );
  if (!placement) return null;
  const position = placement.position;
  return {
    id: `instance-label-${instance.id}`,
    kind: "instance-label",
    content: {
      runs: [
        {
          kind: "span",
          style: "italic",
          children: [
            {
              kind: "span",
              style: "bold",
              children: [{ kind: "text", value: instance.id }],
            },
          ],
        },
      ],
    },
    anchor: {
      kind: "object",
      objectId: instance.id,
      localOffset: {
        x: position.x - instance.placement.position.x,
        y: position.y - instance.placement.position.y,
      },
      fallbackPosition: position,
    },
    alignment: placement.alignment,
    rotation: 0,
    locked: false,
  };
}
