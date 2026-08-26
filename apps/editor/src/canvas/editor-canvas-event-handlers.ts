import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";

import type {
  Annotation,
  DraftingObject,
  Point,
  SchematicDocument,
} from "@icm/model";
import type { WireSource } from "@icm/edit-engine";
import type { SymbolResolver } from "@icm/symbols";

import type { EditorTool } from "../interaction/interaction-state";
import { rankCanvasHits } from "./canvas-hit-resolver";
import {
  proposeRectangleLabel,
  rectangleInteriorAt,
  rectangleLabelFor,
} from "../features/drafting/rectangle-label";

type CanvasMouseEvent = ReactMouseEvent<SVGSVGElement>;
type CanvasPointerEvent = ReactPointerEvent<SVGSVGElement>;
type DraftingTextObject = Extract<DraftingObject, { kind: "text" }>;
interface PointFromClient {
  (clientX: number, clientY: number, canvas: SVGSVGElement, snap?: true): Point;
  (clientX: number, clientY: number, canvas: SVGSVGElement, snap: false): Point;
}

interface CanvasEventHandlerDependencies {
  tool: EditorTool;
  document: SchematicDocument;
  resolver: SymbolResolver;
  interactionKind: () => string;
  pendingSymbolId: string | null;
  pendingComponentPlacement: boolean;
  vddRailMode: boolean;
  copyPlacementActive: boolean;
  cellSymbolLayoutEnabled: boolean;
  selectedDrafting: DraftingObject | null | undefined;
  wireSource: WireSource | null;
  wireDraftStepCount: number;
  draftingSourceActive: boolean;
  pointFromClient: PointFromClient;
  snapPlacementPoint: (point: Point) => Point;
  commitCommandMove: (
    point: Point,
    clientPoint: Point,
    canvas: SVGSVGElement,
  ) => void;
  commitCopyPlacement: (point: Point) => void;
  commitPendingPlacement: (point: Point) => void;
  exitCellSymbolLayout: () => void;
  clearDraftingSelection: () => void;
  handleCanvasHitPointerDown: (event: CanvasPointerEvent) => void;
  beginCanvasGesture: (event: CanvasPointerEvent) => void;
  continueCanvasGesture: (event: CanvasPointerEvent) => void;
  finishCanvasGesture: (event: CanvasPointerEvent) => void;
  clearComponentPreview: () => void;
  clearVddRailPreview: () => void;
  clearCopyPreview: () => void;
  handleDraftingCanvasClick: (
    point: Point,
    alternate: boolean,
    additive: boolean,
    logicalRadius: number,
  ) => void;
  logicalRadiusForPixels: (canvas: SVGSVGElement, pixels: number) => number;
  snapCaptureRadiusPixels: number;
  applyWireCanvasPoint: (
    point: Point,
    canvas: SVGSVGElement,
    alternate: boolean,
    finish: boolean,
  ) => void;
  beginAnnotationTextEditing: (annotation: Annotation) => void;
  cancelCanvasDrag: () => void;
  beginDraftingTextEditing: (object: DraftingTextObject) => void;
  nextRectangleLabelId: () => string;
  upsertDraftingObject: (object: DraftingObject) => boolean;
  finishDraftingCreate: () => void;
  resolveWireCanvasSnap: (
    point: Point,
    canvas: SVGSVGElement,
    alternate: boolean,
  ) => { point: Point };
  completeWire: () => void;
  cancelDraftingCreate: () => void;
  cancelWire: () => void;
  setStatus: (status: string) => void;
  onWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
  onDrop: (event: ReactDragEvent<SVGSVGElement>) => void;
}

/** DOM event boundary for the editor canvas; domain mutations stay injected. */
export function createEditorCanvasEventHandlers({
  tool,
  document,
  resolver,
  interactionKind,
  pendingSymbolId,
  pendingComponentPlacement,
  vddRailMode,
  copyPlacementActive,
  cellSymbolLayoutEnabled,
  selectedDrafting,
  wireSource,
  wireDraftStepCount,
  draftingSourceActive,
  pointFromClient,
  snapPlacementPoint,
  commitCommandMove,
  commitCopyPlacement,
  commitPendingPlacement,
  exitCellSymbolLayout,
  clearDraftingSelection,
  handleCanvasHitPointerDown,
  beginCanvasGesture,
  continueCanvasGesture,
  finishCanvasGesture,
  clearComponentPreview,
  clearVddRailPreview,
  clearCopyPreview,
  handleDraftingCanvasClick,
  logicalRadiusForPixels,
  snapCaptureRadiusPixels,
  applyWireCanvasPoint,
  beginAnnotationTextEditing,
  cancelCanvasDrag,
  beginDraftingTextEditing,
  nextRectangleLabelId,
  upsertDraftingObject,
  finishDraftingCreate,
  resolveWireCanvasSnap,
  completeWire,
  cancelDraftingCreate,
  cancelWire,
  setStatus,
  onWheel,
  onDrop,
}: CanvasEventHandlerDependencies) {
  return {
    onWheel,
    onClickCapture(event: CanvasMouseEvent) {
      const kind = interactionKind();
      if (kind === "moving-selection") {
        if (event.detail === 1) {
          event.preventDefault();
          event.stopPropagation();
          commitCommandMove(
            pointFromClient(event.clientX, event.clientY, event.currentTarget),
            { x: event.clientX, y: event.clientY },
            event.currentTarget,
          );
        }
        return;
      }
      if (kind === "copy-placement") {
        if (event.detail > 1) return;
        event.preventDefault();
        event.stopPropagation();
        commitCopyPlacement(
          snapPlacementPoint(
            pointFromClient(event.clientX, event.clientY, event.currentTarget),
          ),
        );
        return;
      }
      if (!vddRailMode && (!pendingSymbolId || !pendingComponentPlacement))
        return;
      if (event.detail > 1) return;
      event.stopPropagation();
      commitPendingPlacement(
        snapPlacementPoint(
          pointFromClient(event.clientX, event.clientY, event.currentTarget),
        ),
      );
    },
    onPointerDownCapture(event: CanvasPointerEvent) {
      const target = event.target as Element;
      if (target.closest('[data-testid="canvas-text-editor"]')) return;
      if (
        cellSymbolLayoutEnabled &&
        target.closest('[data-testid="cell-symbol-layout-overlay"]')
      )
        return;
      if (cellSymbolLayoutEnabled) exitCellSymbolLayout();
      if (interactionKind() === "moving-selection") {
        event.stopPropagation();
        return;
      }
      if (
        selectedDrafting &&
        (selectedDrafting.kind === "arrow" ||
          selectedDrafting.kind === "construction-line" ||
          selectedDrafting.kind === "rectangle") &&
        !target.closest(
          `[data-testid="drafting-hit-${selectedDrafting.id}"]`,
        ) &&
        !target.closest(
          `[data-testid="drafting-handles-${selectedDrafting.id}"]`,
        )
      ) {
        clearDraftingSelection();
      }
      handleCanvasHitPointerDown(event);
    },
    onPointerDown: beginCanvasGesture,
    onPointerMove: continueCanvasGesture,
    onPointerLeave() {
      const kind = interactionKind();
      if (pendingSymbolId) clearComponentPreview();
      if (vddRailMode) clearVddRailPreview();
      if (kind === "copy-placement") clearCopyPreview();
    },
    onPointerUp: finishCanvasGesture,
    onPointerCancel: finishCanvasGesture,
    onClick(event: CanvasMouseEvent) {
      const target = event.target as Element;
      const onBackground =
        target === event.currentTarget || target.tagName === "rect";
      if (
        (tool === "arrow" ||
          tool === "construction-line" ||
          tool === "rectangle") &&
        event.detail === 1 &&
        onBackground
      ) {
        handleDraftingCanvasClick(
          pointFromClient(event.clientX, event.clientY, event.currentTarget),
          event.altKey,
          event.shiftKey,
          logicalRadiusForPixels(event.currentTarget, snapCaptureRadiusPixels),
        );
        return;
      }
      if (tool !== "wire" || event.detail !== 1) return;
      applyWireCanvasPoint(
        pointFromClient(
          event.clientX,
          event.clientY,
          event.currentTarget,
          false,
        ),
        event.currentTarget,
        event.altKey,
        false,
      );
    },
    onDoubleClick(event: CanvasMouseEvent) {
      const target = event.target as Element;
      if (tool === "pointer") {
        const pointHits = rankCanvasHits(
          event.currentTarget.ownerDocument.elementsFromPoint(
            event.clientX,
            event.clientY,
          ),
        );
        const annotationHit = pointHits.find(
          (hit) => hit.kind === "annotation",
        );
        const annotation = annotationHit
          ? document.annotations.find(
              (candidate) => candidate.id === annotationHit.id,
            )
          : undefined;
        if (annotation) {
          event.preventDefault();
          event.stopPropagation();
          cancelCanvasDrag();
          beginAnnotationTextEditing(annotation);
          return;
        }
        const electricalHit = pointHits.some(
          (hit) =>
            hit.kind !== "annotation" &&
            hit.kind !== "instance-label" &&
            hit.kind !== "drafting",
        );
        const interiorPoint = pointFromClient(
          event.clientX,
          event.clientY,
          event.currentTarget,
        );
        const rectangle = electricalHit
          ? null
          : rectangleInteriorAt(document, resolver, interiorPoint);
        if (rectangle) {
          event.preventDefault();
          event.stopPropagation();
          cancelCanvasDrag();
          const existingLabel = rectangleLabelFor(document, rectangle.id);
          if (existingLabel) {
            beginDraftingTextEditing(existingLabel);
            return;
          }
          const label = proposeRectangleLabel(
            rectangle,
            nextRectangleLabelId(),
          );
          if (upsertDraftingObject(label)) {
            beginDraftingTextEditing(label);
            setStatus(`Editing label of ${rectangle.id}`);
          }
          return;
        }
      }
      if (
        tool === "arrow" ||
        tool === "construction-line" ||
        tool === "rectangle"
      ) {
        if (target !== event.currentTarget && target.tagName !== "rect") return;
        finishDraftingCreate();
        return;
      }
      if (tool !== "wire") return;
      if (wireSource && wireDraftStepCount === 0) {
        completeWire();
        setStatus("Wire finished · Esc exits");
        return;
      }
      if (target !== event.currentTarget && target.tagName !== "rect") return;
      const point = pointFromClient(
        event.clientX,
        event.clientY,
        event.currentTarget,
        false,
      );
      const resolved = resolveWireCanvasSnap(
        point,
        event.currentTarget,
        event.altKey,
      );
      if (
        wireSource &&
        wireDraftStepCount === 0 &&
        wireSource.connection.contactPoint.x === resolved.point.x &&
        wireSource.connection.contactPoint.y === resolved.point.y
      ) {
        completeWire();
        setStatus("Wire finished · Esc exits");
        return;
      }
      if (
        wireSource?.endpoint.kind === "junction" &&
        wireSource.preludeEdits.some(
          (edit) => edit.kind === "add_junction" && edit.createNet,
        ) &&
        wireSource.connection.contactPoint.x === resolved.point.x &&
        wireSource.connection.contactPoint.y === resolved.point.y
      ) {
        setStatus("Wire finished · Esc exits");
        completeWire();
        return;
      }
      applyWireCanvasPoint(point, event.currentTarget, event.altKey, true);
    },
    onContextMenu(event: CanvasMouseEvent) {
      event.preventDefault();
      if (
        tool === "arrow" ||
        tool === "construction-line" ||
        tool === "rectangle"
      ) {
        if (draftingSourceActive) {
          cancelDraftingCreate();
          setStatus("Drawing cancelled");
        }
        return;
      }
      if (tool === "wire") cancelWire();
    },
    onDragOver(event: ReactDragEvent<SVGSVGElement>) {
      event.preventDefault();
    },
    onDrop,
  };
}
