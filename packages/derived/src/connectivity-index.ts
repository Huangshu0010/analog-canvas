import { deriveStableId } from "@icm/model";
import type {
  CircuitProject,
  Net,
  RouteEndpoint,
  SchematicDocument,
} from "@icm/model";
import type { SymbolResolver } from "@icm/symbols";

import {
  deriveFlightlines,
  deriveNetConnectivity,
  type Flightline,
  type RoutedComponent,
} from "./connectivity.js";
import { endpointKey, isVisibleEndpoint, netEndpoints } from "./endpoint.js";

/**
 * Unified read-only connectivity index (ADR 0013). Single source of
 * connectivity truth for flightline overlay, net highlight, cross-Cell trace,
 * project search, and ERC. Never persisted, exported, or mutated by GUI state.
 *
 * This first implementation is an additive facade over the existing tested
 * `derive*` primitives, plus the partition-invariant flightline id
 * normalization (ADR 0013 / WP-R0 finding), typed virtual edges, hierarchy
 * edges, and a project object index. Production consumers keep using the old
 * helpers until the R10 migration proves parity and switches them.
 */

export type EndpointRef = RouteEndpoint;

export interface VirtualConnectivityEdge {
  kind: "net-label" | "power-label" | "hierarchy-port";
  from: EndpointRef;
  to: EndpointRef;
  /** Label text or the parent-pin → child-port mapping evidence. */
  evidence: string;
}

export interface NetConnectivityRecord {
  netId: string;
  /** Terminals + ports — electrical truth, independent of geometry. */
  logicalEndpoints: readonly EndpointRef[];
  /** Visible graph participants (visible terminals/ports + the net's junctions). */
  visibleEndpoints: readonly EndpointRef[];
  routedComponents: readonly RoutedComponent[];
  routes: readonly string[];
  junctions: readonly string[];
  virtualEdges: readonly VirtualConnectivityEdge[];
  /** Flightlines with partition-invariant id/direction (ADR 0013). */
  flightlines: readonly Flightline[];
}

export interface DocumentConnectivityIndex {
  documentId: string;
  endpointToNet: ReadonlyMap<string, string>;
  nets: ReadonlyMap<string, NetConnectivityRecord>;
}

export interface HierarchyEdge {
  parentDocumentId: string;
  instanceId: string;
  parentPinName: string;
  childDocumentId: string;
  childPortId: string;
}

export interface HierarchyConnectivityIndex {
  edges: readonly HierarchyEdge[];
}

/**
 * Project-level object identity (ADR 0015 core). The full ADR 0015
 * `ObjectLocator` (with `hierarchyPath`, `endpoint`, `sourceRef`) is populated
 * by search/navigation in WP-R5; the index provides the document/kind/id core.
 */
export interface IndexObjectLocator {
  documentId: string;
  kind:
    | "document"
    | "instance"
    | "net"
    | "route"
    | "junction"
    | "port"
    | "annotation";
  objectId: string;
}

export interface ProjectObjectIndex {
  resolve(documentId: string, objectId: string): IndexObjectLocator | undefined;
}

export interface ProjectConnectivityIndex {
  projectId: string;
  documents: ReadonlyMap<string, DocumentConnectivityIndex>;
  hierarchy: HierarchyConnectivityIndex;
  objectIndex: ProjectObjectIndex;
}

const junctionEndpoint = (junctionId: string): EndpointRef => ({
  kind: "junction",
  junctionId,
});

const portEndpoint = (portId: string): EndpointRef => ({
  kind: "port",
  portId,
});

const terminalEndpoint = (
  instanceId: string,
  pinName: string,
): EndpointRef => ({ kind: "terminal", instanceId, pinName });

/**
 * Returns a flightline whose `from`/`to` are ordered by `endpointKey` and whose
 * `id` is recomputed from the ordered keys, so the same logical flightline
 * yields the same id regardless of how the visible wire is partitioned into
 * Routes (ADR 0013; resolves the WP-R0 partition-sensitivity finding).
 */
function normalizeFlightline(line: Flightline): Flightline {
  const swap =
    endpointKey(line.from).localeCompare(endpointKey(line.to), "en") > 0;
  const from = swap ? line.to : line.from;
  const to = swap ? line.from : line.to;
  const fromPoint = swap ? line.toPoint : line.fromPoint;
  const toPoint = swap ? line.fromPoint : line.toPoint;
  return {
    id: deriveStableId(
      "flightline",
      line.netId,
      endpointKey(from),
      endpointKey(to),
    ),
    netId: line.netId,
    from,
    to,
    fromPoint,
    toPoint,
    distance: line.distance,
  };
}

function buildDocumentIndex(
  document: SchematicDocument,
  resolver: SymbolResolver,
): DocumentConnectivityIndex {
  const endpointToNet = new Map<string, string>();
  for (const net of document.nets) {
    for (const endpoint of netEndpoints(document, net)) {
      endpointToNet.set(endpointKey(endpoint), net.id);
    }
  }

  const nets = new Map<string, NetConnectivityRecord>();
  for (const net of [...document.nets].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  )) {
    nets.set(net.id, buildNetRecord(document, resolver, net));
  }

  return { documentId: document.id, endpointToNet, nets };
}

function buildNetRecord(
  document: SchematicDocument,
  resolver: SymbolResolver,
  net: Net,
): NetConnectivityRecord {
  const logicalEndpoints: EndpointRef[] = [
    ...net.terminals.map((terminal) =>
      terminalEndpoint(terminal.instanceId, terminal.pinName),
    ),
    ...net.ports.map((portId) => portEndpoint(portId)),
  ].sort((a, b) => endpointKey(a).localeCompare(endpointKey(b), "en"));

  const visibleEndpoints = netEndpoints(document, net).filter((endpoint) =>
    isVisibleEndpoint(document, resolver, endpoint),
  );

  const routedComponents = deriveNetConnectivity(
    document,
    resolver,
    net,
  ).components;

  const routes = document.routes
    .filter((route) => route.netId === net.id)
    .map((route) => route.id)
    .sort((a, b) => a.localeCompare(b, "en"));

  const junctions = document.junctions
    .filter((junction) => junction.netId === net.id)
    .map((junction) => junction.id)
    .sort((a, b) => a.localeCompare(b, "en"));

  const virtualEdges = deriveLabelVirtualEdges(document, net);

  const flightlines = deriveFlightlines(document, resolver)
    .filter((line) => line.netId === net.id)
    .map(normalizeFlightline);

  return {
    netId: net.id,
    logicalEndpoints,
    visibleEndpoints,
    routedComponents,
    routes,
    junctions,
    virtualEdges,
    flightlines,
  };
}

/**
 * Typed net-label/power-label virtual edges. Two same-net junctions carrying
 * matching label text are connected by a virtual edge, mirroring the union that
 * `deriveNetConnectivity` applies. Edges form a stable chain within each label
 * group, ordered by junction endpoint key.
 */
function deriveLabelVirtualEdges(
  document: SchematicDocument,
  net: Net,
): VirtualConnectivityEdge[] {
  const groups = new Map<
    string,
    { kind: VirtualConnectivityEdge["kind"]; junctions: string[] }
  >();
  for (const annotation of document.annotations) {
    if (
      (annotation.kind !== "net-label" && annotation.kind !== "power-label") ||
      !annotation.attachedObjectId
    ) {
      continue;
    }
    const junction = document.junctions.find(
      (candidate) => candidate.id === annotation.attachedObjectId,
    );
    if (!junction || junction.netId !== net.id) continue;
    const label = annotation.text.trim();
    if (label.length === 0) continue;
    const group = groups.get(label) ?? { kind: annotation.kind, junctions: [] };
    group.junctions.push(junction.id);
    groups.set(label, group);
  }
  const edges: VirtualConnectivityEdge[] = [];
  for (const [label, group] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "en"),
  )) {
    const ordered = [...new Set(group.junctions)].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    for (let index = 0; index < ordered.length - 1; index += 1) {
      edges.push({
        kind: group.kind,
        from: junctionEndpoint(ordered[index]!),
        to: junctionEndpoint(ordered[index + 1]!),
        evidence: label,
      });
    }
  }
  return edges;
}

function buildHierarchyIndex(
  project: CircuitProject,
  resolver: SymbolResolver,
): HierarchyConnectivityIndex {
  const edges: HierarchyEdge[] = [];
  for (const parent of project.documents) {
    for (const instance of parent.instances) {
      const childId = referencedDocumentId(project, instance);
      if (!childId) continue;
      const child = project.documents.find(
        (candidate) => candidate.id === childId,
      );
      if (!child) continue;
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) continue;
      for (const pin of resolved.definition.pins) {
        const childPort = child.ports.find((port) => port.name === pin.name);
        if (!childPort) continue;
        edges.push({
          parentDocumentId: parent.id,
          instanceId: instance.id,
          parentPinName: pin.name,
          childDocumentId: childId,
          childPortId: childPort.id,
        });
      }
    }
  }
  edges.sort(
    (a, b) =>
      a.parentDocumentId.localeCompare(b.parentDocumentId, "en") ||
      a.instanceId.localeCompare(b.instanceId, "en") ||
      a.parentPinName.localeCompare(b.parentPinName, "en"),
  );
  return { edges };
}

/** Resolve only the stable imported hierarchy link written by the importer. */
function referencedDocumentId(
  project: CircuitProject,
  instance: SchematicDocument["instances"][number],
): string | null {
  const childId = instance.properties["spice.childDocumentId"];
  if (
    typeof childId === "string" &&
    project.documents.some((candidate) => candidate.id === childId)
  ) {
    return childId;
  }
  return null;
}

function buildObjectIndex(project: CircuitProject): ProjectObjectIndex {
  return {
    resolve(documentId, objectId) {
      const document = project.documents.find(
        (candidate) => candidate.id === documentId,
      );
      if (!document) return undefined;
      if (document.id === objectId) {
        return { documentId, kind: "document", objectId };
      }
      if (document.instances.some((candidate) => candidate.id === objectId)) {
        return { documentId, kind: "instance", objectId };
      }
      if (document.nets.some((candidate) => candidate.id === objectId)) {
        return { documentId, kind: "net", objectId };
      }
      if (document.routes.some((candidate) => candidate.id === objectId)) {
        return { documentId, kind: "route", objectId };
      }
      if (document.junctions.some((candidate) => candidate.id === objectId)) {
        return { documentId, kind: "junction", objectId };
      }
      if (document.ports.some((candidate) => candidate.id === objectId)) {
        return { documentId, kind: "port", objectId };
      }
      if (document.annotations.some((candidate) => candidate.id === objectId)) {
        return { documentId, kind: "annotation", objectId };
      }
      return undefined;
    },
  };
}

export function buildProjectConnectivityIndex(
  project: CircuitProject,
  resolver: SymbolResolver,
): ProjectConnectivityIndex {
  const documents = new Map<string, DocumentConnectivityIndex>();
  for (const document of project.documents) {
    documents.set(document.id, buildDocumentIndex(document, resolver));
  }
  return {
    projectId: project.id,
    documents,
    hierarchy: buildHierarchyIndex(project, resolver),
    objectIndex: buildObjectIndex(project),
  };
}
