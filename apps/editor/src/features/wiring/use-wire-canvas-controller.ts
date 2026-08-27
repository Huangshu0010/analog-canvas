import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type {
  WireCornerOrder,
  WireDraftStep,
  WireRoutingMode,
  WireSource,
} from "@icm/edit-engine";
import {
  endpointKey,
  resolveRouteTap,
  type RoutedComponent,
} from "@icm/derived";
import type { Point, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import type { EditorTool } from "../../interaction/interaction-state";
import type { SnapGuideLine } from "../../snap/engine";
import type { VisualSelection } from "../selection/visual-selection";
import { planSelectionMove } from "../selection/selection-move-plan";
import {
  looseRouteAnchorIds,
  type RouteGeometryRecord,
} from "./route-interaction-geometry";
import type { RouteStretchPreview } from "./use-wire-interaction";
import {
  resolveWireCanvasSnap as resolveWireCanvasSnapModel,
  type WireCanvasSnapResult,
} from "./wire-canvas-snap";

const SNAP_CAPTURE_RADIUS_PX = 7;
const WIRE_CORNER_SHAPES = [
  {
    routingMode: "orthogonal",
    cornerOrder: "auto",
    label: "auto",
  },
  {
    routingMode: "orthogonal",
    cornerOrder: "vertical-first",
    label: "vertical first",
  },
  {
    routingMode: "orthogonal",
    cornerOrder: "horizontal-first",
    label: "horizontal first",
  },
  {
    routingMode: "octilinear",
    cornerOrder: "diagonal-first",
    label: "45° diagonal",
  },
  {
    routingMode: "free",
    cornerOrder: "auto",
    label: "any angle",
  },
] as const satisfies readonly {
  routingMode: WireRoutingMode;
  cornerOrder: WireCornerOrder;
  label: string;
}[];

export interface UseWireCanvasControllerOptions {
  document: SchematicDocument;
  resolver: SymbolResolver;
  wiringEndpoints: readonly WireSource[];
  routeGeometryRecords: readonly RouteGeometryRecord[];
  contactComponents: readonly RoutedComponent[];
  wireSource: WireSource | null;
  wireWaypoints: readonly Point[];
  wireDraftSteps: readonly WireDraftStep[];
  wireRoutingMode: WireRoutingMode;
  wireCornerOrder: WireCornerOrder;
  tool: EditorTool;
  vddRailMode: boolean;
  componentPlacementPending: boolean;
  selectedInstanceIds: readonly string[];
  selection: VisualSelection;
  getInteractionKind: () => string;
  beginInstanceMove: (
    event: ReactPointerEvent<SVGElement>,
    instanceId: string,
    hitTarget: SVGElement,
  ) => void;
  beginVisualSelectionMove: (
    event: ReactPointerEvent<SVGElement>,
    selection: VisualSelection,
    hitTarget: SVGElement,
  ) => void;
  cancelInteraction: () => void;
  handleWireRoutePointerDown: (
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    hitTarget: SVGElement,
  ) => void;
  selectRoute: (routeId: string, segmentIndex?: number) => void;
  beginRouteStretch: (
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    segmentIndex: number,
    intent: RouteStretchPreview["intent"],
    hitTarget: SVGElement,
  ) => void;
  createRouteAnchor: (
    routeId: string,
    point: Point,
    segmentIndex: number,
  ) => WireSource;
  pointFromClient: (
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
  ) => Point;
  logicalRadiusForPixels: (svg: SVGSVGElement, pixels: number) => number;
  paintSnapGuides: (guides: readonly SnapGuideLine[]) => void;
  setWireSource: (source: WireSource, revision: number) => void;
  setWirePreviewPoint: (point: Point | null) => void;
  setWireDraftSteps: (steps: WireDraftStep[]) => void;
  commitWire: (source: WireSource) => void;
  fixWirePoint: (point: Point) => void;
  finishWireAtPoint: (point: Point) => void;
  setWireRoutingMode: (mode: WireRoutingMode) => void;
  setWireCornerOrder: (order: WireCornerOrder) => void;
  setStatus: (status: string) => void;
}

/** Route hits, canvas wire snapping, and the remembered corner preference. */
export function useWireCanvasController({
  document,
  resolver,
  wiringEndpoints,
  routeGeometryRecords,
  contactComponents,
  wireSource,
  wireWaypoints,
  wireDraftSteps,
  wireRoutingMode,
  wireCornerOrder,
  tool,
  vddRailMode,
  componentPlacementPending,
  selectedInstanceIds,
  selection,
  getInteractionKind,
  beginInstanceMove,
  beginVisualSelectionMove,
  cancelInteraction,
  handleWireRoutePointerDown,
  selectRoute,
  beginRouteStretch,
  createRouteAnchor,
  pointFromClient,
  logicalRadiusForPixels,
  paintSnapGuides,
  setWireSource,
  setWirePreviewPoint,
  setWireDraftSteps,
  commitWire,
  fixWirePoint,
  finishWireAtPoint,
  setWireRoutingMode,
  setWireCornerOrder,
  setStatus,
}: UseWireCanvasControllerOptions) {
  const lastWireShapeRef = useRef<{
    routingMode: WireRoutingMode;
    cornerOrder: WireCornerOrder;
  }>({ routingMode: "orthogonal", cornerOrder: "auto" });

  useEffect(() => {
    if (tool !== "wire" || wireSource !== null || wireDraftSteps.length > 0) {
      return;
    }
    const remembered = lastWireShapeRef.current;
    if (remembered.routingMode !== wireRoutingMode) {
      setWireRoutingMode(remembered.routingMode);
    }
    if (remembered.cornerOrder !== wireCornerOrder) {
      setWireCornerOrder(remembered.cornerOrder);
    }
  }, [
    tool,
    wireSource,
    wireDraftSteps.length,
    wireRoutingMode,
    wireCornerOrder,
    setWireRoutingMode,
    setWireCornerOrder,
  ]);

  const resolveWireCanvasSnap = (
    point: Point,
    svg: SVGSVGElement,
    suppressSnap: boolean,
  ): WireCanvasSnapResult =>
    resolveWireCanvasSnapModel(
      {
        document,
        resolver,
        wiringEndpoints,
        routeGeometryRecords,
        contactComponents,
        wireSource,
        wireWaypoints,
        captureTolerance: logicalRadiusForPixels(svg, SNAP_CAPTURE_RADIUS_PX),
      },
      point,
      suppressSnap,
    );

  const cycleWireCornerShape = (): void => {
    // Auto is a real stop: vertical-first follows it so the first middle press
    // visibly changes the preview instead of repeating auto's horizontal leg.
    const index = WIRE_CORNER_SHAPES.findIndex(
      (shape) =>
        shape.routingMode === wireRoutingMode &&
        shape.cornerOrder === wireCornerOrder,
    );
    const next = WIRE_CORNER_SHAPES[(index + 1) % WIRE_CORNER_SHAPES.length]!;
    lastWireShapeRef.current = next;
    if (next.routingMode !== wireRoutingMode) {
      setWireRoutingMode(next.routingMode);
    }
    setWireCornerOrder(next.cornerOrder);
    setStatus(`Wire corner: ${next.label}`);
  };

  const applyWireCanvasPoint = (
    rawPoint: Point,
    svg: SVGSVGElement,
    suppressSnap: boolean,
    finish: boolean,
  ): void => {
    const resolved = resolveWireCanvasSnap(rawPoint, svg, suppressSnap);
    paintSnapGuides([]);
    // A double-click ends an existing wire and never starts a fresh one after
    // the first click has already committed onto an endpoint or Route.
    if (finish && !wireSource) return;
    if (resolved.ambiguous) {
      setStatus(
        "Ambiguous connection: choose one endpoint or conductor away from the overlap",
      );
      return;
    }
    if (resolved.endpoint) {
      if (!wireSource) {
        setWireSource(resolved.endpoint, document.revision);
        setWirePreviewPoint(resolved.endpoint.connection.contactPoint);
        setWireDraftSteps([]);
      } else if (
        endpointKey(wireSource.endpoint) !==
        endpointKey(resolved.endpoint.endpoint)
      ) {
        commitWire(resolved.endpoint);
      } else {
        setStatus("Choose a different endpoint");
      }
      return;
    }
    if (resolved.route) {
      const anchor = createRouteAnchor(
        resolved.route.routeId,
        resolved.route.point,
        resolved.route.segmentIndex,
      );
      if (!wireSource) {
        setWireSource(anchor, document.revision);
        setWirePreviewPoint(anchor.connection.contactPoint);
        setWireDraftSteps([]);
      } else {
        commitWire(anchor);
      }
      return;
    }
    if (finish) finishWireAtPoint(resolved.point);
    else fixWirePoint(resolved.point);
  };

  const handleRoutePointerDown = (
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    hitTarget: SVGElement = event.currentTarget,
  ): void => {
    if (vddRailMode || componentPlacementPending) return;
    if (
      getInteractionKind() === "moving-selection" &&
      selectedInstanceIds.length > 0
    ) {
      const primaryInstanceId = selectedInstanceIds.at(-1);
      if (primaryInstanceId) {
        beginInstanceMove(event, primaryInstanceId, hitTarget);
      }
      return;
    }
    if (tool !== "pointer") {
      handleWireRoutePointerDown(event, routeId, hitTarget);
      return;
    }
    event.stopPropagation();
    if (event.altKey) {
      setStatus("Snap suppressed while Alt is held");
      return;
    }
    const routeRecord = routeGeometryRecords.find(
      (candidate) => candidate.route.id === routeId,
    );
    if (!routeRecord) return;
    const svg = (hitTarget.ownerSVGElement ?? hitTarget) as SVGSVGElement;
    const pointer = pointFromClient(event.clientX, event.clientY, svg);
    const tap = resolveRouteTap(
      routeRecord.geometry,
      pointer,
      logicalRadiusForPixels(svg, SNAP_CAPTURE_RADIUS_PX),
    );
    const segmentIndex = tap?.address.segmentIndex ?? 0;
    if (getInteractionKind() === "moving-selection") {
      const movePlan = planSelectionMove(document, selection);
      if (movePlan.previewObjectIds.length > 0) {
        beginVisualSelectionMove(event, selection, hitTarget);
        return;
      }
      cancelInteraction();
    }
    selectRoute(routeId, segmentIndex);
    beginRouteStretch(
      event,
      routeId,
      segmentIndex,
      routeRecord.route.presentation === "power-rail"
        ? "move-power-rail"
        : looseRouteAnchorIds(document, routeRecord.route) !== null
          ? "move-loose-route"
          : "stretch-segment",
      hitTarget,
    );
  };

  return {
    resolveWireCanvasSnap,
    cycleWireCornerShape,
    applyWireCanvasPoint,
    handleRoutePointerDown,
  };
}
