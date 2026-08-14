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
  childTerminalName: string;
  childNetId: string;
}

export interface NetTrace {
  primary: NetHighlight;
  crossCell: readonly CrossCellTraceFrame[];
}

export interface HierarchyNetRef {
  documentId: string;
  netId: string;
}

export interface HierarchyNetTraceHop {
  direction: "down" | "up";
  from: HierarchyNetRef;
  to: HierarchyNetRef;
  frame: CrossCellTraceFrame;
}

export interface HierarchyNetTrace {
  primary: NetHighlight;
  /** One highlight for every reachable logical net, including the primary. */
  highlights: readonly NetHighlight[];
  /** Every concrete parent-instance/child-port traversal edge. */
  hops: readonly HierarchyNetTraceHop[];
}

export function computeNetHighlight(
  index: ProjectConnectivityIndex,
  documentId: string,
  netId: string,
  origin?: EndpointRef,
): NetHighlight | undefined {
  const record = index.documents.get(documentId)?.nets.get(netId);
  if (!record) return undefined;
  const component = origin
    ? record.routedComponents.find((candidate) =>
        candidate.nodes.some((node) => node.key === endpointKey(origin)),
      )
    : undefined;
  if (origin && !component) return undefined;
  const visibleEndpoints = component
    ? component.nodes.map((node) => node.endpoint)
    : record.visibleEndpoints;
  const visibleEndpointKeys = new Set(visibleEndpoints.map(endpointKey));
  return {
    documentId,
    netId,
    visibleEndpoints,
    routes: component?.routes ?? record.routes,
    junctions: component
      ? component.nodes.flatMap((node) =>
          node.endpoint.kind === "junction" ? [node.endpoint.junctionId] : [],
        )
      : record.junctions,
    virtualEdges: component
      ? record.virtualEdges.filter(
          (edge) =>
            visibleEndpointKeys.has(endpointKey(edge.from)) &&
            visibleEndpointKeys.has(endpointKey(edge.to)),
        )
      : record.virtualEdges,
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
    crossCell.push({
      parentDocumentId: edge.parentDocumentId,
      instanceId: edge.instanceId,
      parentPinName: edge.parentPinName,
      childDocumentId: edge.childDocumentId,
      childTerminalName: edge.childTerminalName,
      childNetId: edge.childNetId,
    });
  }

  crossCell.sort(
    (left, right) =>
      left.instanceId.localeCompare(right.instanceId, "en") ||
      left.parentPinName.localeCompare(right.parentPinName, "en"),
  );

  return { primary, crossCell };
}

/**
 * Traverse hierarchy connectivity in both directions. The visited key is the
 * logical document/net pair, preventing cyclic hierarchy projects from looping;
 * hops are retained independently so two parent instances of one child Cell
 * remain distinguishable to a later hierarchy-aware UI.
 */
export function traceHierarchyNet(
  index: ProjectConnectivityIndex,
  documentId: string,
  netId: string,
  origin?: EndpointRef,
): HierarchyNetTrace | undefined {
  const primary = computeNetHighlight(index, documentId, netId, origin);
  if (!primary) return undefined;
  const queue: HierarchyNetRef[] = [{ documentId, netId }];
  const visited = new Set<string>();
  const highlights: NetHighlight[] = [];
  const hops: HierarchyNetTraceHop[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.documentId}\u0000${current.netId}`;
    if (visited.has(key)) continue;
    const highlight =
      current.documentId === documentId && current.netId === netId
        ? computeNetHighlight(index, current.documentId, current.netId, origin)
        : computeNetHighlight(index, current.documentId, current.netId);
    if (!highlight) continue;
    visited.add(key);
    highlights.push(highlight);
    const endpointToNet = index.documents.get(
      current.documentId,
    )?.endpointToNet;

    for (const edge of index.hierarchy.edges) {
      if (edge.parentDocumentId === current.documentId) {
        const parentNetId = endpointToNet?.get(
          endpointKey({
            kind: "terminal",
            instanceId: edge.instanceId,
            pinName: edge.parentPinName,
          }),
        );
        if (parentNetId !== current.netId) continue;
        const frame: CrossCellTraceFrame = { ...edge };
        const to = {
          documentId: edge.childDocumentId,
          netId: edge.childNetId,
        };
        hops.push({ direction: "down", from: current, to, frame });
        queue.push(to);
      }
      if (edge.childDocumentId === current.documentId) {
        if (edge.childNetId !== current.netId) continue;
        const parentNetId = index.documents
          .get(edge.parentDocumentId)
          ?.endpointToNet.get(
            endpointKey({
              kind: "terminal",
              instanceId: edge.instanceId,
              pinName: edge.parentPinName,
            }),
          );
        if (!parentNetId) continue;
        const frame: CrossCellTraceFrame = { ...edge };
        const to = { documentId: edge.parentDocumentId, netId: parentNetId };
        hops.push({ direction: "up", from: current, to, frame });
        queue.push(to);
      }
    }
  }

  highlights.sort((left, right) =>
    `${left.documentId}\u0000${left.netId}`.localeCompare(
      `${right.documentId}\u0000${right.netId}`,
      "en",
    ),
  );
  hops.sort((left, right) =>
    `${left.direction}\u0000${left.from.documentId}\u0000${left.from.netId}\u0000${left.frame.instanceId}\u0000${left.frame.parentPinName}`.localeCompare(
      `${right.direction}\u0000${right.from.documentId}\u0000${right.from.netId}\u0000${right.frame.instanceId}\u0000${right.frame.parentPinName}`,
      "en",
    ),
  );
  return { primary, highlights, hops };
}
