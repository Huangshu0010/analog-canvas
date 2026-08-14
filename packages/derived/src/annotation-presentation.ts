import type { Annotation, Point, Rect, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { resolveVisualAnchor, type ResolvedAnchor } from "./anchor.js";
import {
  resolveDocumentRoutingGeometry,
  type ResolvedDocumentRoutingGeometry,
} from "./resolved-route-geometry.js";
import {
  measureRichTextDocument,
  richTextMetrics,
} from "./rich-text-layout.js";
import type { SchematicStyleProfile } from "./style-profile.js";

/** Shared SVG, editor-hit, marquee, and export presentation of an annotation. */
export interface AnnotationPresentation {
  readonly anchor: ResolvedAnchor;
  /** Visible SVG text baseline; never substitute fallback while resolved. */
  readonly position: Point;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly alignment: "start" | "middle" | "end";
  readonly bounds: Rect;
}

export function resolveAnnotationPresentation(
  document: SchematicDocument,
  resolver: SymbolResolver,
  annotation: Annotation,
  styleProfile: SchematicStyleProfile,
  routingGeometry: ResolvedDocumentRoutingGeometry = resolveDocumentRoutingGeometry(
    document,
    resolver,
  ),
): AnnotationPresentation {
  const anchor = resolveVisualAnchor(
    document,
    resolver,
    annotation.anchor,
    routingGeometry,
  );
  const sizeScale = annotation.sizeScale ?? 1;
  const fontSize = annotationFontSize(annotation, styleProfile) * sizeScale;
  const textLayout = measureRichTextDocument(annotation.content, {
    ...richTextMetrics(styleProfile, "label", sizeScale),
    fontSize,
  });
  const width = Math.max(fontSize * 0.6, textLayout.width);
  const height = Math.max(fontSize * 1.35, textLayout.height);
  const left =
    annotation.alignment === "start"
      ? anchor.position.x
      : annotation.alignment === "end"
        ? anchor.position.x - width
        : anchor.position.x - width / 2;
  const bounds =
    annotation.rotation === 90 || annotation.rotation === 270
      ? {
          x: anchor.position.x - height / 2,
          y: anchor.position.y - width / 2,
          width: height,
          height: width,
        }
      : {
          x: left,
          y: anchor.position.y - fontSize * 1.05,
          width,
          height,
        };
  return {
    anchor,
    position: anchor.position,
    rotation: annotation.rotation,
    alignment: annotation.alignment,
    bounds,
  };
}

function annotationFontSize(
  annotation: Annotation,
  profile: SchematicStyleProfile,
): number {
  switch (annotation.kind) {
    case "instance-label":
      return profile.typography.instanceFontSize;
    case "net-label":
      return profile.typography.netFontSize;
    case "power-label":
      return profile.typography.powerFontSize;
    default:
      return profile.typography.annotationFontSize;
  }
}
