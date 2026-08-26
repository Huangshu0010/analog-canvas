import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import {
  isSchematicAnnotationVisible,
  type ResolvedRouteGeometry,
} from "@icm/derived";
import type { Annotation, RouteBranch, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";
import { resolveDocumentStyleProfile } from "@icm/derived";

import type { EditorTool } from "../interaction/interaction-state";
import {
  annotationAnchor,
  annotationHitBox,
  instanceHitBox,
} from "../features/wiring/route-interaction-geometry";
import { serializePolylinePoints } from "./canvas-geometry";

type Instance = SchematicDocument["instances"][number];
type StyleProfile = ReturnType<typeof resolveDocumentStyleProfile>;
type RouteGeometryRecord = {
  route: RouteBranch;
  geometry: ResolvedRouteGeometry;
};

export function EditorSelectionHitTargets({
  document,
  resolver,
  routeGeometryRecords,
  styleProfile,
  tool,
  selectedInstanceIds,
  selectedRouteId,
  supplementalRouteIds,
  selectedInternalRouteIds,
  selectedAnnotationId,
  supplementalAnnotationIds,
  cellSymbolLayoutInstanceId,
  onInstanceClick,
  onInstanceOpen,
  onInstancePointerDown,
  onRoutePointerDown,
  onAnnotationPointerDown,
  onAnnotationEdit,
  children,
}: {
  document: SchematicDocument;
  resolver: SymbolResolver;
  routeGeometryRecords: readonly RouteGeometryRecord[];
  styleProfile: StyleProfile;
  tool: EditorTool;
  selectedInstanceIds: readonly string[];
  selectedRouteId: string | null;
  supplementalRouteIds: readonly string[];
  selectedInternalRouteIds: ReadonlySet<string>;
  selectedAnnotationId: string | null;
  supplementalAnnotationIds: readonly string[];
  cellSymbolLayoutInstanceId: string | null;
  onInstanceClick: (instance: Instance, additive: boolean) => void;
  onInstanceOpen: (instance: Instance) => void;
  onInstancePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    instance: Instance,
  ) => void;
  onRoutePointerDown: (
    event: ReactPointerEvent<SVGPolylineElement>,
    routeId: string,
  ) => void;
  onAnnotationPointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    annotation: Annotation,
  ) => void;
  onAnnotationEdit: (annotation: Annotation) => void;
  /** Endpoint targets stay between Routes and Annotations in SVG hit order. */
  children?: ReactNode;
}) {
  return (
    <>
      {document.instances
        .filter((instance) => instance.placement !== null)
        .map((instance) => {
          const hitBox = instanceHitBox(instance, resolver);
          if (!hitBox || cellSymbolLayoutInstanceId === instance.id)
            return null;
          return (
            <rect
              key={instance.id}
              data-testid={`hit-${instance.id}`}
              data-canvas-hit-kind="instance"
              data-canvas-hit-id={instance.id}
              data-drag-object-id={instance.id}
              {...hitBox}
              className={
                selectedInstanceIds.includes(instance.id)
                  ? "hit-target selected"
                  : "hit-target"
              }
              onClick={(event) => {
                event.stopPropagation();
                onInstanceClick(instance, event.shiftKey || event.ctrlKey);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onInstanceOpen(instance);
              }}
              onPointerDown={(event) => onInstancePointerDown(event, instance)}
              pointerEvents={tool === "wire" ? "none" : undefined}
            />
          );
        })}
      {routeGeometryRecords.map(({ route, geometry }) => (
        <polyline
          key={route.id}
          data-testid={`route-hit-${route.id}`}
          data-canvas-hit-kind="route"
          data-canvas-hit-id={route.id}
          data-drag-object-id={route.id}
          className={
            selectedRouteId === route.id ||
            supplementalRouteIds.includes(route.id) ||
            selectedInternalRouteIds.has(route.id)
              ? "route-hit selected"
              : "route-hit"
          }
          points={serializePolylinePoints(geometry.centerline)}
          onPointerDown={(event) => onRoutePointerDown(event, route.id)}
          onClick={(event) => event.stopPropagation()}
        />
      ))}
      {children}
      {document.annotations
        .filter((annotation) =>
          isSchematicAnnotationVisible(document, annotation),
        )
        .map((annotation) => {
          const anchor = annotationAnchor(
            document,
            resolver,
            annotation,
            routeGeometryRecords,
            styleProfile,
          );
          const hitBox = annotationHitBox(
            document,
            annotation,
            anchor,
            routeGeometryRecords,
            styleProfile,
          );
          const selected =
            selectedAnnotationId === annotation.id ||
            supplementalAnnotationIds.includes(annotation.id);
          return (
            <rect
              key={`annotation-hit-${annotation.id}`}
              data-testid={`annotation-hit-${annotation.id}`}
              data-canvas-hit-kind="annotation"
              data-canvas-hit-id={annotation.id}
              data-drag-object-id={annotation.id}
              className={
                selected
                  ? "hit-target annotation-text-hit selected"
                  : "hit-target annotation-text-hit"
              }
              {...hitBox}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) =>
                onAnnotationPointerDown(event, annotation)
              }
              pointerEvents={tool === "wire" ? "none" : undefined}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onAnnotationEdit(annotation);
              }}
            />
          );
        })}
    </>
  );
}
