import {
  measureRichTextDocument,
  richTextMetrics,
  routeAttachmentPlacement,
} from "@icm/derived";
import type { RoutePolyline } from "@icm/derived";
import type {
  Annotation,
  Point,
  Rect,
  RouteAnnotationAttachment,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import {
  defaultInstanceLabelPlacement,
  schematicTextDocument,
  schematicTextFontSize,
} from "@icm/render-svg";
import type { SchematicStyleProfile } from "@icm/render-svg";
import type { SymbolResolver } from "@icm/symbols";

import { clamp, closestPointOnSegment } from "./canvas-geometry";
import { instanceVisibleHitBox } from "./selection-geometry";

export interface RoutePolylineRecord {
  route: SchematicDocument["routes"][number];
  polyline: RoutePolyline;
}

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

export function effectiveRouteAttachment(
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

export function isRoutedMarker(annotation: Annotation): boolean {
  return (
    annotation.kind === "route-marker" && annotation.markerKind === "current"
  );
}

export function annotationAnchor(
  annotation: Annotation,
  routePolylines: readonly RoutePolylineRecord[],
): Point {
  const attachment = effectiveRouteAttachment(annotation);
  if (!isRoutedMarker(annotation) || !attachment) {
    if (
      annotation.kind === "route-marker" &&
      (annotation.anchor?.kind === "object" ||
        annotation.anchor?.kind === "route")
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
