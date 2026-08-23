import {
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  clipboardPlacementAnchor,
  copyPlacementOrientationEdits,
  copySelection,
  proposePaste,
} from "../clipboard/clipboard";
import type { SchematicClipboard } from "../clipboard/clipboard";
import {
  createConnectivityProposal,
  executeTransaction,
  gateConnectivityProposal,
  proposeVisualRouteDeletion,
  proposeGroupMoveEdits,
  proposeGroupReflectionEdits,
  proposeGroupRotationEdits,
  type ConnectivityIntent,
  type SchematicEdit,
  type WireSource,
} from "@icm/edit-engine";
import {
  resolveDocumentRoutingGeometry,
  resolveEndpointPoint,
} from "@icm/derived";
import type { Point, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";
import type { SnapGuideLine, SnapResult } from "../../snap/engine";

import type { InteractionState } from "../../interaction/interaction-state";
import {
  startCanvasDragSession,
  type CanvasDragSession,
} from "../../canvas/canvas-drag-session";
import { startCanvasDragVisual } from "../../canvas/canvas-drag-visual";
import {
  IDENTITY_CANVAS_TRANSFORM,
  composeCanvasTransforms,
  quarterTurnTransform,
  reflectionTransform,
  translationTransform,
  type CanvasAffineTransform,
} from "../../canvas/canvas-affine-transform";
import type { ScreenFlip } from "../../interaction/shortcut-orientation";
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

interface CommandMoveSession {
  documentId: string;
  baseRevision: number;
  movePlan: SelectionMovePlan;
  instancePreview: InstanceMovePreview | null;
  pointerOrigin: Point;
  visual: ReturnType<typeof startCanvasDragVisual> | null;
  routeVisual: ReturnType<typeof startCanvasDragVisual> | null;
  projectedDocument: SchematicDocument;
  prefixEdits: SchematicEdit[];
  orientationRouteIds: Set<string>;
  pivot: Point | null;
  orientation: CanvasAffineTransform;
  latestPoint: Point | null;
  svg: SVGSVGElement | null;
  lastResolvedMove: {
    snap: SnapResult;
    moves: { instanceId: string; position: Point }[];
  } | null;
  lastSnap?: SnapResult;
  lastDelta: Point;
}

export interface ProjectedInstanceMove {
  document: SchematicDocument;
  prefixEdits: readonly SchematicEdit[];
  resolvedMove?: {
    snap: SnapResult;
    moves: { instanceId: string; position: Point }[];
  };
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
  getInteractionState: () => InteractionState<SchematicClipboard>;
  transact: (
    edits: SchematicEdit[],
    options?: { preserveInteraction?: boolean },
  ) => TransactionResult;
  transactProjectDocument: (
    transactionId: string,
    edits: readonly SchematicEdit[],
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
    projectedDocument?: SchematicDocument,
  ) => { snap: SnapResult; moves: { instanceId: string; position: Point }[] };
  completeInstanceMove: (
    preview: InstanceMovePreview,
    position: Point,
    tolerance: number,
    suppressSnap: boolean,
    previous?: SnapResult,
    projection?: ProjectedInstanceMove,
  ) => void;
  logicalRadiusForPixels: (svg: SVGSVGElement, pixels: number) => number;
  snapGuides: (guides: SnapGuideLine[]) => void;
  beginSelectionMoveInteraction: () => void;
  visualMoveOrigin: (movePlan: SelectionMovePlan) => Point;
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
  const commandMoveSessionRef = useRef<CommandMoveSession | null>(null);
  const transactConnectivity = (
    intent: ConnectivityIntent,
    edits: readonly SchematicEdit[],
    preview?: unknown,
    options_: { preserveInteraction?: boolean } = {},
  ): TransactionResult => {
    const gate = gateConnectivityProposal(
      options.document,
      createConnectivityProposal(options.document, {
        intent,
        diagnostics: [],
        edits,
        ...(preview === undefined ? {} : { preview }),
      }),
    );
    if (!gate.ok) {
      options.setStatus(gate.message);
      return { ok: false, revision: options.document.revision };
    }
    return options.transact([...gate.edits], options_);
  };

  const moveSelectionPivot = (movePlan: SelectionMovePlan): Point | null => {
    const positions = movePlan.instanceIds.flatMap((instanceId) => {
      const placement = options.document.instances.find(
        (instance) => instance.id === instanceId,
      )?.placement;
      return placement ? [placement.position] : [];
    });
    if (positions.length === 0) return null;
    const grid = options.document.presentation.grid;
    const snap = (value: number): number =>
      grid > 0 ? Math.round(value / grid) * grid : value;
    const xs = positions.map((point) => point.x);
    const ys = positions.map((point) => point.y);
    return {
      x: snap((Math.min(...xs) + Math.max(...xs)) / 2),
      y: snap((Math.min(...ys) + Math.max(...ys)) / 2),
    };
  };

  const projectedInstancePreview = (
    session: CommandMoveSession,
  ): InstanceMovePreview | null => {
    const primaryInstanceId = session.instancePreview?.primaryInstanceId;
    if (!primaryInstanceId) return null;
    const primary = session.projectedDocument.instances.find(
      (instance) => instance.id === primaryInstanceId,
    );
    if (!primary?.placement) return null;
    return {
      instanceIds: session.movePlan.instanceIds,
      primaryInstanceId,
      originalPositions: Object.fromEntries(
        session.movePlan.instanceIds.flatMap((instanceId) => {
          const placement = session.projectedDocument.instances.find(
            (instance) => instance.id === instanceId,
          )?.placement;
          return placement
            ? [[instanceId, { ...placement.position }] as const]
            : [];
        }),
      ),
      pointerStart: { ...primary.placement.position },
      movePlan: session.movePlan,
    };
  };

  const commandMoveTransformReason = (): string | null => {
    const session = commandMoveSessionRef.current;
    if (!session) return "Move is not active";
    if (
      session.documentId !== options.document.id ||
      session.baseRevision !== options.document.revision
    ) {
      return "The document changed; restart Move before transforming";
    }
    if (!session.instancePreview || !session.pivot) {
      return "Rotate and mirror during Move require a component selection";
    }
    if (
      session.movePlan.looseRouteIds.length > 0 ||
      session.movePlan.freeAnnotationIds.length > 0 ||
      session.movePlan.draftingIds.length > 0
    ) {
      return "Rotate and mirror during Move require a component-and-wire closure";
    }
    return null;
  };

  const clearCommandMoveSession = (): void => {
    commandMoveSessionRef.current?.visual?.restore();
    commandMoveSessionRef.current?.routeVisual?.restore();
    commandMoveSessionRef.current = null;
  };

  const beginKeyboardSelectionMove = (): void => {
    if (commandMoveSessionRef.current) {
      options.setStatus(
        "Move is already active · click to place · Esc cancels",
      );
      return;
    }
    const movePlan = planSelectionMove(
      options.document,
      options.visualSelection,
    );
    if (movePlan.previewObjectIds.length === 0) {
      options.setStatus(
        "Selected objects are attached or locked and cannot move",
      );
      return;
    }
    const primaryInstanceId =
      options.selectedIds.at(-1) ?? movePlan.instanceIds.at(0) ?? null;
    const primary = primaryInstanceId
      ? options.document.instances.find((item) => item.id === primaryInstanceId)
      : undefined;
    const instancePreview = primary?.placement
      ? {
          instanceIds: movePlan.instanceIds,
          primaryInstanceId: primaryInstanceId!,
          originalPositions: Object.fromEntries(
            movePlan.instanceIds.flatMap((id) => {
              const item = options.document.instances.find(
                (candidate) => candidate.id === id,
              );
              return item?.placement
                ? [[id, { ...item.placement.position }] as const]
                : [];
            }),
          ),
          pointerStart: { ...primary.placement.position },
          movePlan,
        }
      : null;
    commandMoveSessionRef.current = {
      documentId: options.document.id,
      baseRevision: options.document.revision,
      movePlan,
      instancePreview,
      pointerOrigin: instancePreview
        ? instancePreview.pointerStart
        : options.visualMoveOrigin(movePlan),
      visual: null,
      routeVisual: null,
      projectedDocument: structuredClone(options.document),
      prefixEdits: [],
      orientationRouteIds: new Set(),
      pivot: moveSelectionPivot(movePlan),
      orientation: IDENTITY_CANVAS_TRANSFORM,
      latestPoint: null,
      svg: null,
      lastResolvedMove: null,
      lastDelta: { x: 0, y: 0 },
    };
    options.beginSelectionMoveInteraction();
    options.setStatus(
      "Move: move the pointer, then click to place (Esc to cancel)",
    );
  };

  const updateCommandMovePreview = (
    point: Point,
    svg: SVGSVGElement,
    suppressSnap: boolean,
  ): boolean => {
    const session = commandMoveSessionRef.current;
    if (!session || session.documentId !== options.document.id) return false;
    if (session.baseRevision !== options.document.revision) {
      clearCommandMoveSession();
      options.snapGuides([]);
      options.cancelInteraction();
      options.setStatus("Move cancelled because the document changed");
      return false;
    }
    session.latestPoint = point;
    session.svg = svg;
    session.visual ??= startCanvasDragVisual(
      svg,
      session.movePlan.previewObjectIds,
    );
    let resolvedInstanceMove: {
      snap: SnapResult;
      moves: { instanceId: string; position: Point }[];
    } | null = null;
    if (session.instancePreview) {
      resolvedInstanceMove = options.resolveInstanceMove(
        session.instancePreview,
        point,
        options.logicalRadiusForPixels(svg, 7),
        suppressSnap,
        session.lastSnap,
        session.projectedDocument,
      );
      session.lastResolvedMove = resolvedInstanceMove;
      session.lastSnap = resolvedInstanceMove.snap;
      const primary = resolvedInstanceMove.moves.find(
        (move) =>
          move.instanceId === session.instancePreview!.primaryInstanceId,
      );
      const original =
        session.instancePreview.originalPositions[
          session.instancePreview.primaryInstanceId
        ];
      if (!primary || !original) return false;
      session.lastDelta = {
        x: primary.position.x - original.x,
        y: primary.position.y - original.y,
      };
      options.snapGuides(resolvedInstanceMove.snap.guides);
    } else {
      session.lastDelta = {
        x: options.snapCoordinate(
          point.x - session.pointerOrigin.x,
          options.document.presentation.grid,
        ),
        y: options.snapCoordinate(
          point.y - session.pointerOrigin.y,
          options.document.presentation.grid,
        ),
      };
      options.snapGuides([]);
    }
    session.visual.transform(
      composeCanvasTransforms(
        translationTransform(session.lastDelta),
        session.orientation,
      ),
    );
    if (session.instancePreview && resolvedInstanceMove) {
      try {
        const groupMove = proposeGroupMoveEdits(
          session.projectedDocument,
          options.resolver,
          resolvedInstanceMove.moves,
        );
        const internalRouteIds = new Set(session.movePlan.translatedRouteIds);
        const boundaryRouteIds = new Set([
          ...session.orientationRouteIds,
          ...groupMove.preview.routes.map((route) => route.routeId),
        ]);
        for (const routeId of internalRouteIds)
          boundaryRouteIds.delete(routeId);
        if (boundaryRouteIds.size > 0) {
          session.routeVisual ??= startCanvasDragVisual(svg, [
            ...boundaryRouteIds,
          ]);
          // Preview and commit share the same Engine edit sequence. Manually
          // patching only positions/waypoints misses route normalization and
          // terminal-departure geometry, producing a one-grid visual jump on
          // click for rotated connected parts.
          const projectedResult = executeTransaction(
            session.projectedDocument,
            {
              transactionId: "selection-move-position-preview",
              documentId: session.projectedDocument.id,
              expectedRevision: session.projectedDocument.revision,
              actor: { kind: "human", id: "selection-move-preview" },
              dryRun: true,
              edits: groupMove.edits,
            },
            { symbolResolver: options.resolver },
          );
          if (!projectedResult.ok)
            throw new Error(projectedResult.error.message);
          const routingGeometry = resolveDocumentRoutingGeometry(
            projectedResult.document,
            options.resolver,
          );
          for (const routeId of boundaryRouteIds) {
            const geometry = routingGeometry.routes.get(routeId);
            if (!geometry) continue;
            session.routeVisual.setObjectPolyline(routeId, geometry.centerline);
          }
        }
      } catch {
        // The shared rigid preview remains valid even if a protected boundary
        // Route cannot be stretched. Commit reports the deterministic planner
        // failure without leaving stale DOM state behind.
      }
    }
    return true;
  };

  const transformCommandMove = (
    transform:
      | { kind: "rotate"; deltaDegrees: 90 | -90 }
      | { kind: "mirror"; direction: ScreenFlip },
  ): boolean => {
    const reason = commandMoveTransformReason();
    if (reason) {
      options.setStatus(reason);
      return false;
    }
    const session = commandMoveSessionRef.current!;
    try {
      const plan =
        transform.kind === "rotate"
          ? proposeGroupRotationEdits(
              session.projectedDocument,
              options.resolver,
              session.movePlan.instanceIds,
              transform.deltaDegrees,
            )
          : proposeGroupReflectionEdits(
              session.projectedDocument,
              options.resolver,
              session.movePlan.instanceIds,
              transform.direction,
            );
      const result = executeTransaction(
        session.projectedDocument,
        {
          transactionId: "selection-move-orientation-preview",
          documentId: session.projectedDocument.id,
          expectedRevision: session.projectedDocument.revision,
          actor: { kind: "human", id: "selection-move-preview" },
          dryRun: true,
          edits: plan.edits,
        },
        { symbolResolver: options.resolver },
      );
      if (!result.ok) {
        options.setStatus(
          result.diagnostics[0]?.message ?? "Move transform was rejected",
        );
        return false;
      }
      session.projectedDocument = result.document;
      session.prefixEdits.push(...plan.edits);
      for (const route of plan.preview.routes) {
        session.orientationRouteIds.add(route.routeId);
      }
      session.orientation = composeCanvasTransforms(
        transform.kind === "rotate"
          ? quarterTurnTransform(session.pivot!, transform.deltaDegrees)
          : reflectionTransform(session.pivot!, transform.direction),
        session.orientation,
      );
      session.instancePreview = projectedInstancePreview(session);
      session.lastResolvedMove = null;
      delete session.lastSnap;
      session.routeVisual?.restore();
      session.routeVisual = null;
      if (session.latestPoint && session.svg) {
        updateCommandMovePreview(session.latestPoint, session.svg, false);
      }
      options.setStatus(
        transform.kind === "rotate"
          ? "Move preview rotated · click to place · Esc cancels"
          : `Move preview mirrored ${
              transform.direction === "left-right" ? "left/right" : "top/bottom"
            } · click to place · Esc cancels`,
      );
      return true;
    } catch (error) {
      options.setStatus(
        error instanceof Error ? error.message : "Move transform failed",
      );
      return false;
    }
  };

  const commitCommandMove = (point: Point, svg: SVGSVGElement): void => {
    const pending = commandMoveSessionRef.current;
    if (!pending) return;
    // The painted frame is the commit authority. Re-resolving an unchanged
    // click advances snap hysteresis and can land one grid away from the ghost
    // the user accepted. Pointer events already publish every visible frame;
    // only a click-only/touch interaction needs its first projection here.
    if (!pending.latestPoint && !updateCommandMovePreview(point, svg, false)) {
      return;
    }
    const session = commandMoveSessionRef.current!;
    session.visual?.restore();
    session.routeVisual?.restore();
    commandMoveSessionRef.current = null;
    if (session.instancePreview) {
      options.completeInstanceMove(
        session.instancePreview,
        point,
        options.logicalRadiusForPixels(svg, 7),
        false,
        session.lastSnap,
        {
          document: session.projectedDocument,
          prefixEdits: session.prefixEdits,
          ...(session.lastResolvedMove
            ? { resolvedMove: session.lastResolvedMove }
            : {}),
        },
      );
    } else {
      options.completeVisualSelectionMove(session.movePlan, session.lastDelta);
    }
    options.snapGuides([]);
    options.cancelInteraction();
  };

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
    if (options.getInteractionState().kind === "moving-selection") {
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
    let routeVisual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const routeIdSet = new Set(
      options.document.routes.map((route) => route.id),
    );
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(
        svg,
        movePlan.previewObjectIds.filter((id) => !routeIdSet.has(id)),
      ));
    const paintMovePreview = (
      moves: readonly { instanceId: string; position: Point }[],
      delta: Point,
    ): void => {
      dragVisual().translate(delta);
      const groupMove = proposeGroupMoveEdits(
        options.document,
        options.resolver,
        moves,
      );
      if (groupMove.preview.routes.length === 0) return;
      routeVisual ??= startCanvasDragVisual(
        svg,
        groupMove.preview.routes.map((route) => route.routeId),
      );
      const projected = structuredClone(options.document);
      for (const move of moves) {
        const instance = projected.instances.find(
          (candidate) => candidate.id === move.instanceId,
        );
        if (instance?.placement) instance.placement.position = move.position;
      }
      for (const move of groupMove.preview.junctions) {
        const junction = projected.junctions.find(
          (candidate) => candidate.id === move.junctionId,
        );
        if (junction) junction.position = move.position;
      }
      for (const routeMove of groupMove.preview.routes) {
        const route = projected.routes.find(
          (candidate) => candidate.id === routeMove.routeId,
        );
        if (!route) continue;
        const from = resolveEndpointPoint(
          projected,
          options.resolver,
          route.from,
        );
        const to = resolveEndpointPoint(projected, options.resolver, route.to);
        if (!from || !to) continue;
        routeVisual.setObjectPolyline(route.id, [
          from,
          ...routeMove.waypoints,
          to,
        ]);
      }
    };
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
        const delta = {
          x: primary.position.x - original.x,
          y: primary.position.y - original.y,
        };
        try {
          paintMovePreview(resolved.moves, delta);
        } catch {
          // Final edits surface protected or unresolved geometry on release;
          // retain the responsive Instance preview during the gesture.
          dragVisual().translate(delta);
        }
      },
      onFinish: ({ client, dragged }) => {
        options.canvasDragSessionRef.current = null;
        visual?.restore();
        routeVisual?.restore();
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
        routeVisual?.restore();
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
    const result = transactConnectivity(
      "remove_wire_geometry",
      proposal.edits,
      proposal,
    );
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
      const result = transactConnectivity("add_or_remove_no_connect", [
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
    const result = transactConnectivity("add_or_remove_no_connect", [
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
        const result = transactConnectivity(
          "delete_connection_intent",
          [
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
          ],
          visualRouteDeletion,
        );
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
      const deletion = proposeConnectedInstanceDeletion(
        options.document,
        options.resolver,
        options.selectedIds,
        options.nextUniqueSuffix(),
      );
      const result = transactConnectivity("delete_connection_intent", deletion);
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
    const interactionKind = options.getInteractionState().kind;
    if (interactionKind === "copy-placement") {
      options.setStatus("Copy placement is already active · Esc cancels");
      return;
    }
    if (interactionKind !== "idle") {
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
    const interaction = options.getInteractionState();
    if (interaction.kind !== "copy-placement") return;
    const copyPlacement = interaction.copy;
    copyCounter.current += 1;
    const proposal = proposePaste(
      options.document,
      copyPlacement.clipboard,
      {
        x: point.x - copyPlacement.anchor.x,
        y: point.y - copyPlacement.anchor.y,
      },
      copyCounter.current,
    );
    if (proposal.errors.length > 0) {
      copyCounter.current -= 1;
      options.setStatus(proposal.errors[0]!);
      options.cancelAllTransientInteraction();
      return;
    }
    const orientationEdits = copyPlacementOrientationEdits(
      copyPlacement.clipboard.instances,
      proposal.instanceIds,
      copyPlacement.orientationOperations,
    );
    const edits = [...proposal.edits, ...orientationEdits];
    const editsCellInterface = edits.some(
      (edit) => edit.kind === "update_cell_terminal",
    );
    let result: TransactionResult;
    if (editsCellInterface) {
      const gate = gateConnectivityProposal(
        options.document,
        createConnectivityProposal(options.document, {
          intent: "connect_without_wire",
          diagnostics: [],
          edits,
          preview: proposal,
        }),
      );
      if (!gate.ok) {
        options.setStatus(gate.message);
        result = { ok: false, revision: options.document.revision };
      } else {
        result = options.transactProjectDocument(
          "copy-formal-port-marker",
          gate.edits,
        );
      }
    } else {
      result = transactConnectivity("connect_without_wire", edits, proposal, {
        preserveInteraction: true,
      });
    }
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
    beginKeyboardSelectionMove,
    beginMove,
    beginVisualSelectionMove,
    commitCopyPlacement,
    commitCommandMove,
    clearCommandMoveSession,
    deleteSelectedJunction,
    deleteSelection,
    toggleSelectedNoConnect,
    updateCommandMovePreview,
    canBeginKeyboardSelectionMove: () =>
      planSelectionMove(options.document, options.visualSelection)
        .previewObjectIds.length > 0,
    canTransformCommandMove: () => commandMoveTransformReason() === null,
    rotateCommandMove: (deltaDegrees: 90 | -90) =>
      transformCommandMove({ kind: "rotate", deltaDegrees }),
    mirrorCommandMove: (direction: ScreenFlip) =>
      transformCommandMove({ kind: "mirror", direction }),
    selectInstance,
  };
}
