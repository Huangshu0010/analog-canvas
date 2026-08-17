import {
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  clipboardPlacementAnchor,
  copySelection,
  proposePaste,
} from "../clipboard/clipboard";
import type { SchematicClipboard } from "../clipboard/clipboard";
import {
  proposeVisualRouteDeletion,
  type SchematicEdit,
  type WireSource,
} from "@icm/edit-engine";
import type { Orientation, Point, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";
import type { SnapGuideLine, SnapResult } from "../../snap/engine";

import type {
  CopyPlacement,
  InteractionState,
} from "../../interaction/interaction-state";
import {
  startCanvasDragSession,
  type CanvasDragSession,
} from "../../canvas/canvas-drag-session";
import { startCanvasDragVisual } from "../../canvas/canvas-drag-visual";
import type { PlacementOrientationOperation } from "../../interaction/shortcut-orientation";
import {
  explicitAnnotationRemovals,
  proposeConnectedInstanceDeletion,
} from "./delete-selection";
import type { VisualSelection } from "./visual-selection";
import {
  planSelectionMove,
  type SelectionMovePlan,
} from "./selection-move-plan";

type TransactionResult = { ok: boolean; revision: number };

export interface InstanceMovePreview {
  instanceIds: string[];
  primaryInstanceId: string;
  originalPositions: Record<string, Point>;
  pointerStart: Point;
  movePlan: SelectionMovePlan;
}

export interface UseSelectionInteractionOptions {
  document: SchematicDocument;
  resolver: SymbolResolver;
  visualSelection: VisualSelection;
  selectedIds: readonly string[];
  selectedRouteId: string | null;
  selectedAnnotationId: string | null;
  selectedDraftingId: string | null;
  selectedEndpoint: WireSource | null;
  selectedNoConnect: SchematicDocument["noConnects"][number] | undefined;
  selectedEndpointNetId: string | null;
  copyPlacement: CopyPlacement<SchematicClipboard> | null;
  interactionKind: InteractionState["kind"];
  transact: (
    edits: SchematicEdit[],
    options?: { preserveInteraction?: boolean },
  ) => TransactionResult;
  setStatus: (status: string) => void;
  setSelectedEndpoint: (endpoint: WireSource | null) => void;
  resetSelection: () => void;
  replaceSelectionKind: (
    kind: "instance" | "drafting",
    ids: readonly string[],
  ) => void;
  selectOnly: (kind: "instance", ids: readonly string[]) => void;
  deleteSelectedRouteConnection: () => void;
  deleteSelectedAnnotation: () => void;
  clearTransientCanvasState: () => void;
  cancelAllTransientInteraction: () => void;
  cancelInteraction: () => void;
  cancelCanvasDrag: () => void;
  paintSnapGuides: (guides: []) => void;
  beginCopyPlacementInteraction: (
    clipboard: SchematicClipboard,
    anchor: Point,
  ) => void;
  setCopyPreviewPoint: (point: Point) => void;
  applyOrientationOperations: (
    orientation: Orientation,
    operations: readonly PlacementOrientationOperation[],
  ) => Orientation;
  nextUniqueSuffix: () => number;
  nextNoConnectId: () => string;
  endpointTestId: (endpoint: WireSource["endpoint"]) => string;
  tool: string;
  canvasDragSessionRef: MutableRefObject<CanvasDragSession | null>;
  pointFromClient: (
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
    snapToGrid: false,
  ) => Point;
  completeVisualSelectionMove: (
    movePlan: SelectionMovePlan,
    delta: Point,
  ) => void;
  snapCoordinate: (value: number, grid: number) => number;
  updateInstanceSelection: (instanceId: string, additive: boolean) => void;
  suppressInstanceClickRef: MutableRefObject<boolean>;
  resolveInstanceMove: (
    preview: InstanceMovePreview,
    position: Point,
    tolerance: number,
    suppressSnap: boolean,
    previous?: SnapResult,
  ) => { snap: SnapResult; moves: { instanceId: string; position: Point }[] };
  completeInstanceMove: (
    preview: InstanceMovePreview,
    position: Point,
    tolerance: number,
    suppressSnap: boolean,
    previous?: SnapResult,
  ) => void;
  logicalRadiusForPixels: (svg: SVGSVGElement, pixels: number) => number;
  snapGuides: (guides: SnapGuideLine[]) => void;
}

/**
 * Owns commands whose meaning is the current visual selection. Pointer move
 * orchestration is added here separately so the existing selection reducer
 * remains the sole source of selected object identities.
 */
export function useSelectionInteraction(
  options: UseSelectionInteractionOptions,
) {
  const copyCounter = useRef(0);

  const selectInstance = (instanceId: string, additive: boolean): void => {
    options.setSelectedEndpoint(null);
    options.updateInstanceSelection(instanceId, additive);
  };

  const beginMove = (
    event: ReactPointerEvent<SVGElement>,
    instanceId: string,
    hitTarget: SVGElement = event.currentTarget,
  ): void => {
    if (options.tool !== "pointer" || event.button !== 0) return;
    if (options.interactionKind === "moving-selection") {
      options.cancelInteraction();
    }
    event.stopPropagation();
    const instance = options.document.instances.find(
      (candidate) => candidate.id === instanceId,
    );
    if (!instance?.placement) return;
    const hasSelectionModifier =
      event.shiftKey || event.ctrlKey || event.metaKey;
    options.suppressInstanceClickRef.current =
      hitTarget.getAttribute("data-canvas-hit-kind") === "instance";
    if (hasSelectionModifier) {
      selectInstance(instanceId, true);
      options.setStatus(`Selected ${instanceId}`);
      return;
    }
    const movingSelection: VisualSelection = options.selectedIds.includes(
      instanceId,
    )
      ? options.visualSelection
      : {
          instanceIds: [instanceId],
          routeIds: [],
          junctionIds: [],
          annotationIds: [],
          draftingIds: [],
        };
    const movePlan = planSelectionMove(options.document, movingSelection);
    const movingIds = movePlan.instanceIds;
    if (!options.selectedIds.includes(instanceId))
      selectInstance(instanceId, false);
    if (movingIds.length === 0) return;
    options.canvasDragSessionRef.current?.cancel();
    const svg = (hitTarget.ownerSVGElement ?? hitTarget) as SVGSVGElement;
    const pointerStart = options.pointFromClient(
      event.clientX,
      event.clientY,
      svg,
      false,
    );
    const preview: InstanceMovePreview = {
      instanceIds: movingIds,
      primaryInstanceId: instanceId,
      originalPositions: Object.fromEntries(
        movingIds.map((id) => {
          const candidate = options.document.instances.find(
            (item) => item.id === id,
          )!;
          return [id, { ...candidate.placement!.position }];
        }),
      ),
      pointerStart,
      movePlan,
    };
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, movePlan.previewObjectIds));
    const tolerance = options.logicalRadiusForPixels(svg, 7);
    let lastSnap: SnapResult | undefined;
    options.canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: 4,
      onPreview: (client) => {
        const resolved = options.resolveInstanceMove(
          preview,
          options.pointFromClient(client.x, client.y, svg, false),
          tolerance,
          Boolean(client.altKey),
          lastSnap,
        );
        lastSnap = resolved.snap;
        options.snapGuides(resolved.snap.guides);
        const primary = resolved.moves.find(
          (move) => move.instanceId === preview.primaryInstanceId,
        )!;
        const original = preview.originalPositions[preview.primaryInstanceId]!;
        dragVisual().translate({
          x: primary.position.x - original.x,
          y: primary.position.y - original.y,
        });
      },
      onFinish: ({ client, dragged }) => {
        options.canvasDragSessionRef.current = null;
        visual?.restore();
        options.snapGuides([]);
        if (dragged) {
          options.completeInstanceMove(
            preview,
            options.pointFromClient(client.x, client.y, svg, false),
            tolerance,
            Boolean(client.altKey),
            lastSnap,
          );
        }
      },
      onCancel: () => {
        options.canvasDragSessionRef.current = null;
        visual?.restore();
        options.snapGuides([]);
      },
    });
  };

  const beginVisualSelectionMove = (
    event: ReactPointerEvent<SVGElement>,
    selection: VisualSelection,
    hitTarget: SVGElement = event.currentTarget,
  ): void => {
    if (options.tool !== "pointer" || event.button !== 0) return;
    const movePlan = planSelectionMove(options.document, selection);
    if (movePlan.previewObjectIds.length === 0) {
      options.cancelInteraction();
      options.setStatus(
        "Selected objects are attached or locked and cannot move",
      );
      return;
    }
    options.cancelInteraction();
    event.preventDefault();
    event.stopPropagation();
    options.canvasDragSessionRef.current?.cancel();
    const svg = (hitTarget.ownerSVGElement ?? hitTarget) as SVGSVGElement;
    const start = options.pointFromClient(
      event.clientX,
      event.clientY,
      svg,
      false,
    );
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, movePlan.previewObjectIds));
    const deltaAt = (client: Point): Point => {
      const point = options.pointFromClient(client.x, client.y, svg, false);
      return {
        x: options.snapCoordinate(
          point.x - start.x,
          options.document.presentation.grid,
        ),
        y: options.snapCoordinate(
          point.y - start.y,
          options.document.presentation.grid,
        ),
      };
    };
    options.canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: 4,
      onPreview: (client) => {
        dragVisual().translate(deltaAt(client));
        options.paintSnapGuides([]);
      },
      onFinish: ({ client, dragged }) => {
        options.canvasDragSessionRef.current = null;
        visual?.restore();
        options.paintSnapGuides([]);
        if (dragged) {
          options.completeVisualSelectionMove(movePlan, deltaAt(client));
        }
      },
      onCancel: () => {
        options.canvasDragSessionRef.current = null;
        visual?.restore();
        options.paintSnapGuides([]);
      },
    });
  };

  const deleteSelectedJunction = (): void => {
    if (options.selectedEndpoint?.endpoint.kind !== "junction") return;
    const junctionId = options.selectedEndpoint.endpoint.junctionId;
    const proposal = proposeVisualRouteDeletion(
      options.document,
      [],
      [junctionId],
    );
    const result = options.transact(proposal.edits);
    if (result.ok) {
      options.setSelectedEndpoint(null);
      options.setStatus(
        `Deleted junction and ${proposal.routeIds.length} attached routes`,
      );
    }
  };

  const toggleSelectedNoConnect = (): void => {
    const endpoint = options.selectedEndpoint?.endpoint;
    if (!endpoint || endpoint.kind === "junction") return;
    if (options.selectedNoConnect) {
      const result = options.transact([
        {
          kind: "remove_no_connect",
          noConnectId: options.selectedNoConnect.id,
        },
      ]);
      if (result.ok) {
        options.setStatus(
          `Cleared No Connect on ${options.endpointTestId(endpoint)}`,
        );
      }
      return;
    }
    if (options.selectedEndpointNetId) {
      options.setStatus(
        "Disconnect this endpoint before marking it No Connect",
      );
      return;
    }
    const result = options.transact([
      {
        kind: "add_no_connect",
        noConnect: { id: options.nextNoConnectId(), endpoint },
      },
    ]);
    if (result.ok) {
      options.setStatus(
        `Marked ${options.endpointTestId(endpoint)} No Connect`,
      );
    }
  };

  const deleteSelection = (): void => {
    const initialRouteIds = new Set(options.visualSelection.routeIds);
    const selectedAnnotationIds = new Set(
      options.visualSelection.annotationIds,
    );
    const selectedDraftingIds = new Set(options.visualSelection.draftingIds);
    const selectedJunctionIds = new Set([
      ...options.visualSelection.junctionIds,
      ...(options.selectedEndpoint?.endpoint.kind === "junction"
        ? [options.selectedEndpoint.endpoint.junctionId]
        : []),
    ]);
    const hasMixedSelection =
      initialRouteIds.size > 0 ||
      selectedAnnotationIds.size > 0 ||
      selectedDraftingIds.size > 0 ||
      selectedJunctionIds.size > 0;
    if (
      initialRouteIds.size === 1 &&
      selectedAnnotationIds.size === 0 &&
      selectedDraftingIds.size === 0 &&
      selectedJunctionIds.size === 0 &&
      options.selectedIds.length === 0
    ) {
      options.deleteSelectedRouteConnection();
      return;
    }
    if (hasMixedSelection) {
      const visualRouteDeletion = proposeVisualRouteDeletion(
        options.document,
        [...initialRouteIds],
        [...selectedJunctionIds],
      );
      try {
        const instanceEdits =
          options.selectedIds.length > 0
            ? proposeConnectedInstanceDeletion(
                options.document,
                options.resolver,
                options.selectedIds,
                options.nextUniqueSuffix(),
              )
            : [];
        const explicitAnnotationIds = explicitAnnotationRemovals(
          options.document,
          options.selectedIds,
          [...selectedAnnotationIds].filter(
            (annotationId) =>
              !visualRouteDeletion.annotationIds.includes(annotationId),
          ),
        );
        const result = options.transact([
          ...instanceEdits,
          ...visualRouteDeletion.edits,
          ...explicitAnnotationIds.map((annotationId): SchematicEdit => ({
            kind: "remove_schematic_annotation",
            annotationId,
          })),
          ...[...selectedDraftingIds].map((objectId): SchematicEdit => ({
            kind: "remove_drafting_object",
            objectId,
          })),
        ]);
        if (result.ok) {
          options.resetSelection();
          options.setSelectedEndpoint(null);
          options.setStatus("Deleted selected schematic objects");
        }
      } catch (error) {
        options.setStatus(
          error instanceof Error ? error.message : "Delete failed",
        );
      }
      return;
    }
    if (options.selectedEndpoint?.endpoint.kind === "junction") {
      deleteSelectedJunction();
      return;
    }
    if (options.selectedAnnotationId) {
      options.deleteSelectedAnnotation();
      return;
    }
    if (options.selectedDraftingId) {
      const result = options.transact([
        {
          kind: "remove_drafting_object",
          objectId: options.selectedDraftingId,
        },
      ]);
      if (result.ok) {
        options.replaceSelectionKind("drafting", []);
        options.setStatus(
          `Deleted drafting object ${options.selectedDraftingId}`,
        );
      }
      return;
    }
    if (options.selectedRouteId) {
      options.deleteSelectedRouteConnection();
      return;
    }
    if (options.selectedIds.length === 0) return;
    try {
      const result = options.transact(
        proposeConnectedInstanceDeletion(
          options.document,
          options.resolver,
          options.selectedIds,
          options.nextUniqueSuffix(),
        ),
      );
      if (result.ok) {
        options.replaceSelectionKind("instance", []);
        options.setStatus(
          "Deleted component selection; connected wires remain dangling",
        );
      }
    } catch (error) {
      options.setStatus(
        error instanceof Error ? error.message : "Delete failed",
      );
    }
  };

  const beginCopyPlacement = (): void => {
    if (options.interactionKind === "copy-placement") {
      options.setStatus("Copy placement is already active · Esc cancels");
      return;
    }
    if (options.interactionKind !== "idle") {
      options.setStatus("Finish or cancel the active tool before copying");
      return;
    }
    const copied = copySelection(options.document, options.selectedIds);
    if (!copied) {
      options.setStatus("Select at least one component to copy");
      return;
    }
    const anchor = clipboardPlacementAnchor(copied);
    if (!anchor) {
      options.setStatus("Selected components have no placeable origin");
      return;
    }
    options.cancelCanvasDrag();
    options.clearTransientCanvasState();
    options.paintSnapGuides([]);
    options.beginCopyPlacementInteraction(copied, anchor);
    options.setStatus(
      `Place copy of ${copied.instances.length} components · R rotates · Shift+R / Ctrl+R mirrors · Esc cancels`,
    );
  };

  const commitCopyPlacement = (point: Point): void => {
    if (!options.copyPlacement) return;
    copyCounter.current += 1;
    const proposal = proposePaste(
      options.document,
      options.copyPlacement.clipboard,
      {
        x: point.x - options.copyPlacement.anchor.x,
        y: point.y - options.copyPlacement.anchor.y,
      },
      copyCounter.current,
    );
    if (proposal.errors.length > 0) {
      copyCounter.current -= 1;
      options.setStatus(proposal.errors[0]!);
      options.cancelAllTransientInteraction();
      return;
    }
    const orientationEdits = proposal.instanceIds.flatMap(
      (instanceId, index): SchematicEdit[] => {
        const source =
          options.copyPlacement!.clipboard.instances[index]?.placement;
        if (!source) return [];
        const orientation = options.applyOrientationOperations(
          source,
          options.copyPlacement!.orientationOperations,
        );
        return [
          ...(orientation.mirror === source.mirror
            ? []
            : [
                {
                  kind: "mirror_instance" as const,
                  instanceId,
                  mirror: orientation.mirror,
                },
              ]),
          ...(orientation.rotation === source.rotation
            ? []
            : [
                {
                  kind: "rotate_instance" as const,
                  instanceId,
                  rotation: orientation.rotation,
                },
              ]),
        ];
      },
    );
    const result = options.transact([...proposal.edits, ...orientationEdits], {
      preserveInteraction: true,
    });
    if (result.ok) {
      options.selectOnly("instance", proposal.instanceIds);
      options.setCopyPreviewPoint(point);
      options.setStatus(
        `Copied ${proposal.instanceIds.length} components · click to place another · Esc exits`,
      );
    }
  };

  return {
    beginCopyPlacement,
    beginMove,
    beginVisualSelectionMove,
    commitCopyPlacement,
    deleteSelectedJunction,
    deleteSelection,
    toggleSelectedNoConnect,
    selectInstance,
  };
}
