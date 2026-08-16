import { deriveStableId, flattenRichText } from "@icm/model";
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
import { directObjectLocator, type ObjectLocator } from "./object-locator.js";
import { resolveNetLabelBindings } from "./net-label.js";
import {
  resolveDocumentRoutingGeometry,
  type ResolvedRouteGeometry,
} from "./resolved-route-geometry.js";

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
  kind: "net-label" | "power-label";
  from: EndpointRef;
  to: EndpointRef;
  /** Label text binding the two endpoints. */
  evidence: string;
}

export interface NetConnectivityRecord {
  netId: string;
  /** Instance terminals — electrical truth, independent of geometry. */
  logicalEndpoints: readonly EndpointRef[];
  /** Visible graph participants (visible terminals + the Net's Junctions). */
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
  routeGeometry: ReadonlyMap<string, ResolvedRouteGeometry>;
}

export interface HierarchyEdge {
  parentDocumentId: string;
  instanceId: string;
  parentPinName: string;
  childDocumentId: string;
  childTerminalName: string;
  childNetId: string;
}

export interface HierarchyConnectivityIndex {
  edges: readonly HierarchyEdge[];
}

/**
 * Project-level object identity (ADR 0015). Direct-document locators carry an
 * empty hierarchy path; C6 later supplies non-empty paths for navigation.
 */
export interface ProjectObjectIndex {
  resolve(documentId: string, objectId: string): ObjectLocator | undefined;
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

const terminalEndpoint = (
  instanceId: string,
  pinName: string,
): EndpointRef => ({ kind: "terminal", instanceId, pinName });

interface CachedDocumentIndex {
  revision: number;
  resolver: SymbolResolver;
  index: DocumentConnectivityIndex;
}

/** Derived-only cache: never persisted and invalidated by revision/resolver. */
const documentIndexCache = new WeakMap<
  SchematicDocument,
  CachedDocumentIndex
>();

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
  const cached = documentIndexCache.get(document);
  if (cached?.revision === document.revision && cached.resolver === resolver) {
    return cached.index;
  }
  const endpointToNet = new Map<string, string>();
  for (const net of document.nets) {
    for (const endpoint of netEndpoints(document, net)) {
      endpointToNet.set(endpointKey(endpoint), net.id);
    }
  }

  const flightlinesByNet = new Map<string, Flightline[]>();
  for (const line of deriveFlightlines(document, resolver)) {
    const lines = flightlinesByNet.get(line.netId) ?? [];
    lines.push(normalizeFlightline(line));
    flightlinesByNet.set(line.netId, lines);
  }

  const nets = new Map<string, NetConnectivityRecord>();
  for (const net of [...document.nets].sort((a, b) =>
    a.id.localeCompare(b.id, "en"),
  )) {
    nets.set(
      net.id,
      buildNetRecord(
        document,
        resolver,
        net,
        flightlinesByNet.get(net.id) ?? [],
      ),
    );
  }

  const index = {
    documentId: document.id,
    endpointToNet,
    nets,
    routeGeometry: resolveDocumentRoutingGeometry(document, resolver).routes,
  };
  documentIndexCache.set(document, {
    revision: document.revision,
    resolver,
    index,
  });
  return index;
}

function buildNetRecord(
  document: SchematicDocument,
  resolver: SymbolResolver,
  net: Net,
  flightlines: readonly Flightline[],
): NetConnectivityRecord {
  const logicalEndpoints: EndpointRef[] = [
    ...net.terminals.map((terminal) =>
      terminalEndpoint(terminal.instanceId, terminal.pinName),
    ),
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

  const virtualEdges = deriveLabelVirtualEdges(document, resolver, net);

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
 * Typed net-label/power-label virtual edges. Net Labels are bound to a Net id
 * and resolved to the nearest routed component; the old Junction-id overload
 * is deliberately not accepted. Power labels retain their legacy Junction
 * compatibility until their separate symbol binding contract is migrated.
 */
function deriveLabelVirtualEdges(
  document: SchematicDocument,
  resolver: SymbolResolver,
  net: Net,
): VirtualConnectivityEdge[] {
  const groups = new Map<
    string,
    { kind: VirtualConnectivityEdge["kind"]; endpoints: EndpointRef[] }
  >();
  for (const binding of resolveNetLabelBindings(document, resolver, net.id)) {
    const annotation = document.annotations.find(
      (candidate) => candidate.id === binding.annotationId,
    )!;
    const label = flattenRichText(annotation.content).trim();
    if (label.length === 0) continue;
    const group = groups.get(label) ?? {
      kind: "net-label",
      endpoints: [],
    };
    group.endpoints.push(binding.endpoint);
    groups.set(label, group);
  }
  for (const annotation of document.annotations) {
    if (annotation.kind !== "power-label" || annotation.netId !== net.id) {
      continue;
    }
    const binding = resolveNetLabelBindings(document, resolver, net.id).find(
      (candidate) => candidate.annotationId === annotation.id,
    );
    if (!binding) continue;
    const label = flattenRichText(annotation.content).trim();
    if (label.length === 0) continue;
    const group = groups.get(label) ?? {
      kind: annotation.kind,
      endpoints: [],
    };
    group.endpoints.push(binding.endpoint);
    groups.set(label, group);
  }
  const edges: VirtualConnectivityEdge[] = [];
  for (const [label, group] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "en"),
  )) {
    const ordered = [
      ...new Map(
        group.endpoints.map((endpoint) => [endpointKey(endpoint), endpoint]),
      ).values(),
    ].sort((a, b) => endpointKey(a).localeCompare(endpointKey(b), "en"));
    for (let index = 0; index < ordered.length - 1; index += 1) {
      edges.push({
        kind: group.kind,
        from: ordered[index]!,
        to: ordered[index + 1]!,
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
        const childTerminal = child.netlist?.terminals.find(
          (terminal) => terminal.name === pin.name,
        );
        if (!childTerminal) continue;
        edges.push({
          parentDocumentId: parent.id,
          instanceId: instance.id,
          parentPinName: pin.name,
          childDocumentId: childId,
          childTerminalName: childTerminal.name,
          childNetId: childTerminal.netId,
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
  const binding = instance.netlist?.binding;
  const childId =
    binding?.kind === "subcircuit" ? binding.childDocumentId : undefined;
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
        return directObjectLocator(documentId, "document", objectId);
      }
      if (document.instances.some((candidate) => candidate.id === objectId)) {
        return directObjectLocator(documentId, "instance", objectId);
      }
      if (document.nets.some((candidate) => candidate.id === objectId)) {
        return directObjectLocator(documentId, "net", objectId);
      }
      if (document.routes.some((candidate) => candidate.id === objectId)) {
        return directObjectLocator(documentId, "route", objectId);
      }
      if (document.junctions.some((candidate) => candidate.id === objectId)) {
        return directObjectLocator(documentId, "junction", objectId);
      }
      if (document.annotations.some((candidate) => candidate.id === objectId)) {
        return directObjectLocator(documentId, "annotation", objectId);
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
