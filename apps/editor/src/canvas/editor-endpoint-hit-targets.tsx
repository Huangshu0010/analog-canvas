import type { PointerEvent as ReactPointerEvent } from "react";

import { derivePowerRailComponent } from "@icm/derived";
import type { WireSource } from "@icm/edit-engine";
import type { SchematicDocument } from "@icm/model";

import type { EditorTool } from "../interaction/interaction-state";

type Route = SchematicDocument["routes"][number];
type StretchIntent = "resize-power-rail-start" | "resize-power-rail-end";

export function EditorEndpointHitTargets({
  document,
  endpoints,
  tool,
  selectedRoute,
  selectedRouteSegmentIndex,
  selectedEndpoint,
  supplementalJunctionIds,
  endpointLabel,
  onEndpointActions,
  onPowerRailStretch,
  onJunctionSelect,
  onWireEndpoint,
}: {
  document: SchematicDocument;
  endpoints: readonly WireSource[];
  tool: EditorTool;
  selectedRoute: Route | undefined;
  selectedRouteSegmentIndex: number | null;
  selectedEndpoint: WireSource | null;
  supplementalJunctionIds: readonly string[];
  endpointLabel: (endpoint: WireSource["endpoint"]) => string;
  onEndpointActions: (endpoint: WireSource) => void;
  onPowerRailStretch: (
    event: ReactPointerEvent<SVGCircleElement>,
    routeId: string,
    segmentIndex: number,
    intent: StretchIntent,
  ) => void;
  onJunctionSelect: (endpoint: WireSource) => void;
  onWireEndpoint: (
    event: ReactPointerEvent<SVGCircleElement>,
    endpoint: WireSource,
  ) => void;
}) {
  const powerRailEnds =
    selectedRoute?.presentation === "power-rail"
      ? (derivePowerRailComponent(document, selectedRoute.id)
          ?.endpointJunctionIds.map((junctionId) =>
            document.junctions.find((junction) => junction.id === junctionId),
          )
          .filter((junction): junction is NonNullable<typeof junction> =>
            Boolean(junction),
          )
          .sort((left, right) => left.position.x - right.position.x) ?? [])
      : [];
  return endpoints.map((candidate) => {
    const candidateJunctionId =
      candidate.endpoint.kind === "junction"
        ? candidate.endpoint.junctionId
        : null;
    const powerRailEndIndex =
      candidateJunctionId !== null
        ? powerRailEnds.findIndex(
            (junction) => junction.id === candidateJunctionId,
          )
        : -1;
    const label = endpointLabel(candidate.endpoint);
    return (
      <circle
        key={`${candidate.netId}:${label}`}
        data-testid={label}
        data-canvas-hit-kind={
          candidate.endpoint.kind === "junction" ? "junction" : undefined
        }
        data-canvas-hit-id={candidateJunctionId ?? undefined}
        data-drag-object-id={candidateJunctionId ?? undefined}
        className={
          tool === "wire" ||
          (candidateJunctionId !== null &&
            supplementalJunctionIds.includes(candidateJunctionId)) ||
          (selectedEndpoint?.endpoint.kind === "junction" &&
            candidateJunctionId !== null &&
            selectedEndpoint.endpoint.junctionId === candidateJunctionId)
            ? "endpoint-hit active"
            : "endpoint-hit"
        }
        cx={candidate.connection.contactPoint.x}
        cy={candidate.connection.contactPoint.y}
        r={4}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onEndpointActions(candidate);
        }}
        onPointerDown={(event) => {
          if (tool === "pointer" && selectedRoute && powerRailEndIndex >= 0) {
            onPowerRailStretch(
              event,
              selectedRoute.id,
              selectedRouteSegmentIndex ?? 0,
              powerRailEndIndex === 0
                ? "resize-power-rail-start"
                : "resize-power-rail-end",
            );
            return;
          }
          if (tool === "pointer" && candidate.endpoint.kind === "junction") {
            event.stopPropagation();
            onJunctionSelect(candidate);
            return;
          }
          onWireEndpoint(event, candidate);
        }}
      />
    );
  });
}
