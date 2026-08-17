import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  buildManualWirePath,
  createFreeWireAnchor,
  proposeWireCommitThroughContacts,
  type SchematicEdit,
  type WireSource,
} from "@icm/edit-engine";
import { endpointKey, isMosBulkTerminal } from "@icm/derived";
import { transformPoint } from "@icm/model";
import type { Flightline } from "@icm/derived";
import type { Point, RouteEndpoint, SchematicDocument } from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import { endpointNetId } from "./route-interaction-geometry";

type TransactionResult = {
  ok: boolean;
  revision: number;
};

export interface UseWireInteractionOptions {
  document: SchematicDocument;
  resolver: SymbolResolver;
  selectedInstance: SchematicDocument["instances"][number] | undefined;
  visibleEndpoints: readonly WireSource[];
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
}

/**
 * Owns the active Wire session only. Route hit testing and canvas drag
 * arbitration remain with the App until their selection/movement migration.
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
    commitWire,
    drawSelectedMosBulk,
    fixWirePoint,
    finishWireAtPoint,
    handleFlightline,
    handleWireEndpoint,
  };
}
