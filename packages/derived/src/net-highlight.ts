import type { ProjectConnectivityIndex } from "./connectivity-index.js";
import type {
  EndpointRef,
  VirtualConnectivityEdge,
} from "./connectivity-index.js";
import type { Flightline } from "./connectivity.js";
import { endpointKey } from "./endpoint.js";

/**
 * Net highlight and cross-cell trace (ADR 0013 index / roadmap WP-R6 core).
 * Pure computation over the `ProjectConnectivityIndex`; the editor overlay that
 * paints the highlight is deferred to WP-R9.
 */

export interface NetHighlight {
  documentId: string;
  netId: string;
  visibleEndpoints: readonly EndpointRef[];
  routes: readonly string[];
  junctions: readonly string[];
  virtualEdges: readonly VirtualConnectivityEdge[];
  flightlines: readonly Flightline[];
}

export interface CrossCellTraceFrame {
  parentDocumentId: string;
  instanceId: string;
  parentPinName: string;
  childDocumentId: string;
  childPortId: string;
  /** Net in the child Document that the traced port belongs to, if any. */
  childNetId: string | undefined;
}

export interface NetTrace {
  primary: NetHighlight;
  crossCell: readonly CrossCellTraceFrame[];
}

export function computeNetHighlight(
  index: ProjectConnectivityIndex,
  documentId: string,
  netId: string,
): NetHighlight | undefined {
  const record = index.documents.get(documentId)?.nets.get(netId);
  if (!record) return undefined;
  return {
    documentId,
    netId,
    visibleEndpoints: record.visibleEndpoints,
    routes: record.routes,
    junctions: record.junctions,
    virtualEdges: record.virtualEdges,
    flightlines: record.flightlines,
  };
}

export function traceNet(
  index: ProjectConnectivityIndex,
  documentId: string,
  netId: string,
): NetTrace | undefined {
  const primary = computeNetHighlight(index, documentId, netId);
  if (!primary) return undefined;

  const parentEndpointToNet = index.documents.get(documentId)?.endpointToNet;
  const crossCell: CrossCellTraceFrame[] = [];
  for (const edge of index.hierarchy.edges) {
    if (edge.parentDocumentId !== documentId) continue;
    const parentPinKey = endpointKey({
      kind: "terminal",
      instanceId: edge.instanceId,
      pinName: edge.parentPinName,
    });
    if (parentEndpointToNet?.get(parentPinKey) !== netId) continue;
    const childNetId = index.documents
      .get(edge.childDocumentId)
      ?.endpointToNet.get(
        endpointKey({ kind: "port", portId: edge.childPortId }),
      );
    crossCell.push({
      parentDocumentId: edge.parentDocumentId,
      instanceId: edge.instanceId,
      parentPinName: edge.parentPinName,
      childDocumentId: edge.childDocumentId,
      childPortId: edge.childPortId,
      childNetId,
    });
  }

  crossCell.sort(
    (left, right) =>
      left.instanceId.localeCompare(right.instanceId, "en") ||
      left.parentPinName.localeCompare(right.parentPinName, "en"),
  );

  return { primary, crossCell };
}
