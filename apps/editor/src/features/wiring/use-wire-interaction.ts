import type {
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  buildManualWirePath,
  createFreeWireAnchor,
  proposeVisualRouteDeletion,
  proposeLooseRouteTranslation,
  proposePowerRailEndpointResize,
  proposePowerRailTranslation,
  proposeWireSegmentMove,
  proposeWireCommitThroughContacts,
  type SchematicEdit,
  type WireSource,
} from "@icm/edit-engine";
import {
  derivePowerRailComponent,
  endpointKey,
  isMosBulkTerminal,
  resolveElectricalContactTargets,
  resolveRouteTap,
} from "@icm/derived";
import { snapCoordinate } from "../../snap/engine";
import { transformPoint } from "@icm/model";
import type { Flightline } from "@icm/derived";
import type { Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import {
  startCanvasDragSession,
  type CanvasDragSession,
} from "../../canvas/canvas-drag-session";
import { startCanvasDragVisual } from "../../canvas/canvas-drag-visual";
import {
  endpointNetId,
  looseRouteAnchorIds,
  type RouteGeometryRecord,
} from "./route-interaction-geometry";

export interface RouteStretchPreview {
  routeId: string;
  segmentIndex: number;
  intent:
    | "stretch-segment"
    | "move-loose-route"
    | "move-power-rail"
    | "resize-power-rail-start"
    | "resize-power-rail-end";
  start: Point;
  point: Point;
}

type TransactionResult = {
  ok: boolean;
  revision: number;
};

export interface UseWireInteractionOptions {
  document: SchematicDocument;
  resolver: SymbolResolver;
  selectedInstance: SchematicDocument["instances"][number] | undefined;
  selectedRouteId: string | null;
  visibleEndpoints: readonly WireSource[];
  routeGeometryRecords: readonly RouteGeometryRecord[];
  wireSource: WireSource | null;
  wireSourceRevision: number | null;
  wireWaypoints: readonly Point[];
  nextRoutingSuffix: () => number;
  transact: (
    edits: SchematicEdit[],
    options?: { completesWireSession?: boolean },
  ) => TransactionResult;
  setStatus: (status: string) => void;
  setTool: (tool: "wire") => void;
  setWireSource: (source: WireSource | null, revision: number | null) => void;
  setWirePreviewPoint: (point: Point | null) => void;
  setWireWaypoints: (waypoints: Point[]) => void;
  completeWire: () => void;
  clearTransientCanvasState: () => void;
  cancelInteraction: () => void;
  setBulkDrawInstanceId: (instanceId: string | null) => void;
  replaceRouteSelection: (routeIds: readonly string[]) => void;
  selectOnly: (kind: "route", ids: readonly string[]) => void;
  setSelectedRouteSegmentIndex: (segmentIndex: number | null) => void;
  setSelectedEndpoint: (endpoint: WireSource | null) => void;
  canvasDragSessionRef: MutableRefObject<CanvasDragSession | null>;
  setRouteStretchPreview: (preview: RouteStretchPreview | null) => void;
  pointFromClient: (
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
    snapToGrid: false,
  ) => Point;
  logicalRadiusForPixels: (svg: SVGSVGElement, pixels: number) => number;
  contactComponents: Parameters<typeof resolveElectricalContactTargets>[3];
  createRouteAnchor: (
    routeId: string,
    point: Point,
    segmentIndex: number,
  ) => WireSource;
}

/**
 * Owns wire sessions and route-specific drag lifecycles. The App remains the
 * cross-domain canvas pointer arbiter.
 */
export function useWireInteraction(options: UseWireInteractionOptions) {
  const freeWireAnchor = (
    point: Point,
    netId: string,
    createNet: boolean,
  ): WireSource =>
    createFreeWireAnchor(point, netId, createNet, options.nextRoutingSuffix());

  const commitWire = (candidate: WireSource): void => {
    if (!options.wireSource) return;
    if (options.wireSourceRevision !== options.document.revision) {
      options.clearTransientCanvasState();
      options.cancelInteraction();
      options.setBulkDrawInstanceId(null);
      options.setStatus("Wire cancelled because its source revision is stale");
      return;
    }
    const proposal = proposeWireCommitThroughContacts(
      options.wireSource,
      candidate,
      options.wireWaypoints,
      options.visibleEndpoints.filter(
        (endpoint) => endpoint.endpoint.kind === "terminal",
      ),
      options.nextRoutingSuffix(),
    );
    const bulkEndpoint = [options.wireSource.endpoint, candidate.endpoint].find(
      (endpoint) => endpoint.kind === "terminal" && endpoint.pinName === "B",
    );
    const defaultBoundInstance =
      bulkEndpoint?.kind === "terminal"
        ? options.document.instances.find(
            (instance) => instance.id === bulkEndpoint.instanceId,
          )
        : undefined;
    const edits = defaultBoundInstance?.mosBulkBinding
      ? [
          {
            kind: "clear_mos_bulk_default" as const,
            instanceId: defaultBoundInstance.id,
          },
          ...proposal.edits.map((edit) => {
            if (edit.kind !== "connect_endpoints") return edit;
            const target =
              edit.from.kind === "terminal" && edit.from.pinName === "B"
                ? edit.to
                : edit.from;
            return {
              ...edit,
              from: target,
              to: {
                kind: "terminal" as const,
                instanceId: defaultBoundInstance.id,
                pinName: "B",
              },
            };
          }),
        ]
      : proposal.edits;
    const result = options.transact(edits, { completesWireSession: true });
    if (result.ok) {
      options.completeWire();
      options.setBulkDrawInstanceId(null);
      options.setStatus(
        `Committed route at revision ${result.revision} · Wire remains active · Esc exits`,
      );
    }
  };

  const handleWireEndpoint = (
    event: ReactPointerEvent<SVGCircleElement>,
    candidate: WireSource,
  ): void => {
    event.stopPropagation();
    if (event.altKey) {
      options.setStatus("Snap suppressed while Alt is held");
      return;
    }
    options.setTool("wire");
    if (!options.wireSource) {
      options.setWireSource(candidate, options.document.revision);
      options.setWirePreviewPoint(candidate.point);
      options.setWireWaypoints([]);
      options.setStatus(`Wire source: ${endpointKey(candidate.endpoint)}`);
      return;
    }
    if (
      endpointKey(options.wireSource.endpoint) ===
      endpointKey(candidate.endpoint)
    ) {
      options.setStatus("Choose a different endpoint");
      return;
    }
    commitWire(candidate);
  };

  const handleFlightline = (
    event: ReactMouseEvent<SVGLineElement>,
    flightline: Flightline,
  ): void => {
    event.stopPropagation();
    const from: WireSource = {
      endpoint: flightline.from,
      netId: flightline.netId,
      point: flightline.fromPoint,
      preludeEdits: [],
      ...(isMosBulkTerminal(options.document, flightline.from)
        ? { routePresentation: "bulk-dashed" as const }
        : {}),
    };
    const to: WireSource = {
      endpoint: flightline.to,
      netId: flightline.netId,
      point: flightline.toPoint,
      preludeEdits: [],
      ...(isMosBulkTerminal(options.document, flightline.to)
        ? { routePresentation: "bulk-dashed" as const }
        : {}),
    };
    options.setTool("wire");
    if (options.wireSource) {
      const candidate =
        endpointKey(options.wireSource.endpoint) === endpointKey(from.endpoint)
          ? to
          : from;
      if (
        endpointKey(options.wireSource.endpoint) !==
        endpointKey(candidate.endpoint)
      ) {
        commitWire(candidate);
      }
      return;
    }
    options.setWireSource(from, options.document.revision);
    options.setWirePreviewPoint(to.point);
    options.setWireWaypoints([]);
    options.setStatus(`Wire source: flightline on ${flightline.netId}`);
  };

  const drawSelectedMosBulk = (): void => {
    const instance = options.selectedInstance;
    if (!instance?.placement) return;
    const resolved = options.resolver.resolve(
      instance.symbolId,
      instance.symbolVariantId,
    );
    const anchor = resolved?.variant?.auxiliaryPins?.find(
      (pin) => pin.name === "B",
    );
    if (!anchor) {
      options.setStatus("Selected instance has no Razavi bulk anchor");
      return;
    }
    const endpoint: RouteEndpoint = {
      kind: "terminal",
      instanceId: instance.id,
      pinName: "B",
    };
    const source: WireSource = {
      endpoint,
      netId: instance.mosBulkBinding
        ? null
        : endpointNetId(options.document, endpoint),
      point: transformPoint(
        anchor.at,
        instance.placement.position,
        instance.placement,
      ),
      preludeEdits: options.document.noConnects.flatMap((noConnect) =>
        noConnect.endpoint.kind === "terminal" &&
        noConnect.endpoint.instanceId === instance.id &&
        noConnect.endpoint.pinName === "B"
          ? [{ kind: "remove_no_connect" as const, noConnectId: noConnect.id }]
          : [],
      ),
      routePresentation: "bulk-dashed",
    };
    options.setBulkDrawInstanceId(instance.id);
    options.setTool("wire");
    options.setWireSource(source, options.document.revision);
    options.setWirePreviewPoint(source.point);
    options.setWireWaypoints([]);
    options.setStatus(`Drawing ${instance.id}.B bulk connection`);
  };

  const deleteSelectedRouteConnection = (): void => {
    if (!options.selectedRouteId) return;
    const route = options.document.routes.find(
      (candidate) => candidate.id === options.selectedRouteId,
    );
    if (!route) return;
    const result = options.transact(
      proposeVisualRouteDeletion(options.document, [route.id], []).edits,
    );
    if (result.ok) {
      options.replaceRouteSelection([]);
      options.setStatus(`Deleted wire ${route.id}`);
    }
  };

  const selectRoute = (routeId: string, segmentIndex = 0): void => {
    options.selectOnly("route", [routeId]);
    options.setSelectedRouteSegmentIndex(segmentIndex);
    options.setSelectedEndpoint(null);
    options.setStatus(`Selected route ${routeId}, segment ${segmentIndex + 1}`);
  };

  const completeRouteStretch = (
    preview: RouteStretchPreview,
    point: Point,
  ): void => {
    const record = options.routeGeometryRecords.find(
      (candidate) => candidate.route.id === preview.routeId,
    );
    if (!record) return;
    try {
      if (preview.intent === "move-loose-route") {
        const anchorIds = looseRouteAnchorIds(options.document, record.route);
        if (!anchorIds)
          throw new Error(
            "Only a route with two loose ends can move as a whole",
          );
        const delta = {
          x: snapCoordinate(
            point.x - preview.start.x,
            options.document.presentation.grid,
          ),
          y: snapCoordinate(
            point.y - preview.start.y,
            options.document.presentation.grid,
          ),
        };
        if (delta.x !== 0 || delta.y !== 0) {
          const result = options.transact(
            proposeLooseRouteTranslation(
              options.document,
              record.route.id,
              delta,
            ).edits,
          );
          if (result.ok)
            options.setStatus(`Moved loose route ${record.route.id}`);
        }
      } else if (preview.intent === "move-power-rail") {
        const delta = {
          x: snapCoordinate(
            point.x - preview.start.x,
            options.document.presentation.grid,
          ),
          y: snapCoordinate(
            point.y - preview.start.y,
            options.document.presentation.grid,
          ),
        };
        if (delta.x !== 0 || delta.y !== 0) {
          const result = options.transact(
            proposePowerRailTranslation(
              options.document,
              options.resolver,
              record.route.id,
              delta,
            ).edits,
          );
          if (result.ok) options.setStatus(`Moved VDD rail ${record.route.id}`);
        }
      } else if (
        preview.intent === "resize-power-rail-start" ||
        preview.intent === "resize-power-rail-end"
      ) {
        const result = options.transact(
          proposePowerRailEndpointResize(
            options.document,
            options.resolver,
            record.route.id,
            preview.intent === "resize-power-rail-start" ? "start" : "end",
            snapCoordinate(point.x, options.document.presentation.grid),
          ).edits,
        );
        if (result.ok) options.setStatus(`Resized VDD rail ${record.route.id}`);
      } else {
        const result = options.transact(
          proposeWireSegmentMove(
            options.document,
            options.resolver,
            record.route.id,
            preview.segmentIndex,
            {
              x: snapCoordinate(point.x, options.document.presentation.grid),
              y: snapCoordinate(point.y, options.document.presentation.grid),
            },
          ).edits,
        );
        if (result.ok)
          options.setStatus(`Moved route segment ${record.route.id}`);
      }
    } catch (error) {
      options.setStatus(
        error instanceof Error ? error.message : "Route move failed",
      );
    }
  };

  const beginRouteStretch = (
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    segmentIndex: number,
    intent: RouteStretchPreview["intent"] = "stretch-segment",
    hitTarget: SVGElement = event.currentTarget,
  ): void => {
    if (event.button !== 0) return;
    event.stopPropagation();
    options.canvasDragSessionRef.current?.cancel();
    const svg = hitTarget.ownerSVGElement!;
    const start = options.pointFromClient(
      event.clientX,
      event.clientY,
      svg,
      false,
    );
    const record = options.routeGeometryRecords.find(
      (candidate) => candidate.route.id === routeId,
    );
    if (!record) return;
    const powerRail =
      intent === "move-power-rail" ||
      intent === "resize-power-rail-start" ||
      intent === "resize-power-rail-end"
        ? derivePowerRailComponent(options.document, routeId)
        : null;
    const anchorIds =
      intent === "move-loose-route"
        ? (looseRouteAnchorIds(options.document, record.route) ?? [])
        : (powerRail?.junctionIds ?? []);
    const translatedRouteIds =
      intent === "move-power-rail"
        ? (powerRail?.routeIds ?? [routeId])
        : [routeId];
    let visual: ReturnType<typeof startCanvasDragVisual> | null = null;
    const dragVisual = () =>
      (visual ??= startCanvasDragVisual(svg, [
        ...translatedRouteIds,
        ...anchorIds,
      ]));
    const preview: RouteStretchPreview = {
      routeId,
      segmentIndex,
      intent,
      start,
      point: start,
    };
    options.setRouteStretchPreview(preview);
    options.canvasDragSessionRef.current = startCanvasDragSession({
      target: hitTarget,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      thresholdPx: 4,
      onPreview: (client) => {
        const point = options.pointFromClient(client.x, client.y, svg, false);
        if (intent === "move-loose-route" || intent === "move-power-rail") {
          dragVisual().translate({
            x: point.x - start.x,
            y: point.y - start.y,
          });
          return;
        }
        if (
          intent === "resize-power-rail-start" ||
          intent === "resize-power-rail-end"
        ) {
          return;
        }
        try {
          const plan = proposeWireSegmentMove(
            options.document,
            options.resolver,
            routeId,
            segmentIndex,
            point,
          );
          const proposal = plan.preview?.routes.find(
            (candidate) => candidate.routeId === routeId,
          );
          if (!proposal) return;
          dragVisual().setPolyline([
            record.geometry.centerline[0]!,
            ...proposal.waypoints,
            record.geometry.centerline.at(-1)!,
          ]);
        } catch {
          // Keep the last valid preview; commit reports the geometry error.
        }
      },
      onFinish: ({ client, dragged }) => {
        options.canvasDragSessionRef.current = null;
        visual?.restore();
        if (dragged) {
          completeRouteStretch(
            preview,
            options.pointFromClient(client.x, client.y, svg, false),
          );
        }
        options.setRouteStretchPreview(null);
      },
      onCancel: () => {
        options.canvasDragSessionRef.current = null;
        visual?.restore();
        options.setRouteStretchPreview(null);
      },
    });
  };

  const handleWireRoutePointerDown = (
    event: ReactPointerEvent<SVGElement>,
    routeId: string,
    hitTarget: SVGElement = event.currentTarget,
  ): void => {
    event.stopPropagation();
    if (event.altKey) {
      options.setStatus("Snap suppressed while Alt is held");
      return;
    }
    const record = options.routeGeometryRecords.find(
      (candidate) => candidate.route.id === routeId,
    );
    if (!record) return;
    const svg = (hitTarget.ownerSVGElement ?? hitTarget) as SVGSVGElement;
    const pointer = options.pointFromClient(
      event.clientX,
      event.clientY,
      svg,
      false,
    );
    const tap = resolveRouteTap(
      record.geometry,
      pointer,
      options.logicalRadiusForPixels(svg, 7),
    );
    if (!tap) {
      options.setStatus("Wire must start or end inside a route segment");
      return;
    }
    const overlappingTargets = options.routeGeometryRecords.flatMap(
      (candidate) => {
        const candidateTap = resolveRouteTap(
          candidate.geometry,
          pointer,
          options.logicalRadiusForPixels(svg, 7),
        );
        return candidateTap
          ? [
              {
                kind: "route" as const,
                id: `route:${candidate.route.id}:${candidateTap.address.segmentIndex}`,
                point: candidateTap.point,
                netId: candidate.route.netId,
                routeId: candidate.route.id,
                segmentIndex: candidateTap.address.segmentIndex,
              },
            ]
          : [];
      },
    );
    if (
      resolveElectricalContactTargets(
        options.document,
        options.resolver,
        overlappingTargets,
        options.contactComponents,
      ).length > 1
    ) {
      options.setStatus(
        "Ambiguous intersection: choose one conductor away from the crossing",
      );
      return;
    }
    const anchor = options.createRouteAnchor(
      routeId,
      tap.point,
      tap.address.segmentIndex,
    );
    if (!options.wireSource) {
      options.setWireSource(anchor, options.document.revision);
      options.setWirePreviewPoint(tap.point);
      options.setWireWaypoints([]);
      options.setStatus(`Wire source: route ${routeId}`);
      return;
    }
    commitWire(anchor);
  };

  const fixWirePoint = (point: Point): void => {
    if (!options.wireSource) {
      const source = freeWireAnchor(
        point,
        `net-ui-${options.nextRoutingSuffix()}`,
        true,
      );
      options.setWireSource(source, options.document.revision);
      options.setWirePreviewPoint(point);
      options.setWireWaypoints([]);
      options.setStatus("Wire source: free grid point");
      return;
    }
    const fixed = buildManualWirePath(
      options.wireSource,
      { point },
      options.wireWaypoints,
    );
    options.setWireWaypoints(fixed.points.slice(1));
    options.setWirePreviewPoint(point);
    options.setStatus(
      `Wire bend ${fixed.points.length - 1}; double-click or Enter to finish`,
    );
  };

  const finishWireAtPoint = (point: Point): void => {
    if (!options.wireSource) {
      fixWirePoint(point);
      return;
    }
    const netId =
      options.wireSource.netId ?? `net-ui-${options.nextRoutingSuffix()}`;
    commitWire(freeWireAnchor(point, netId, options.wireSource.netId === null));
  };

  return {
    beginRouteStretch,
    commitWire,
    completeRouteStretch,
    deleteSelectedRouteConnection,
    drawSelectedMosBulk,
    fixWirePoint,
    finishWireAtPoint,
    handleFlightline,
    handleWireRoutePointerDown,
    handleWireEndpoint,
    selectRoute,
  };
}
