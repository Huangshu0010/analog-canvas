import { createHash } from "node:crypto";

import {
  diagnoseVisualQuality,
  electricalTopologyHash,
  resolveMosBulkConnection,
  resolveDraftingObjectGeometry,
  resolveDocumentRoutingGeometry,
} from "@icm/derived";
import { transformPoint } from "@icm/model";
import type {
  CircuitProject,
  Point,
  Rect,
  SchematicDocument,
} from "@icm/model";
import type { SymbolPin, SymbolResolver } from "@icm/symbols";

import {
  AGENT_SNAPSHOT_VERSION,
  AgentSessionSnapshotSchema,
} from "./schema.js";
import type {
  AgentDiagnostic,
  AgentSessionSnapshot,
  AgentSnapshotDocument,
} from "./schema.js";

type ProjectView = Pick<
  CircuitProject,
  "id" | "name" | "topDocumentId" | "documents"
>;

export interface BuildAgentSessionSnapshotOptions {
  project?: ProjectView;
  document: SchematicDocument;
  resolver: SymbolResolver;
  includeSourceSpans?: boolean;
  // ADR 0010 WP-R4: include guide axis/coordinate in the response.
  includeEditorGuides?: boolean;
}

function stableValue(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(stableValue);
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, value]) => [key, stableValue(value)]),
    );
  }
  return input;
}

export function canonicalSnapshotContent(input: unknown): string {
  return JSON.stringify(stableValue(input));
}

function pointBounds(point: Point): Rect {
  return { x: point.x, y: point.y, width: 1, height: 1 };
}

function enclosingBounds(items: readonly Rect[]): Rect | null {
  if (items.length === 0) return null;
  const x = Math.min(...items.map((item) => item.x));
  const y = Math.min(...items.map((item) => item.y));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function placedInstanceBounds(
  document: SchematicDocument,
  instanceId: string,
  resolver: SymbolResolver,
): Rect | null {
  const instance = document.instances.find((item) => item.id === instanceId);
  if (!instance?.placement) return null;
  const resolved = resolver.resolve(
    instance.symbolId,
    instance.symbolVariantId,
  );
  if (!resolved) return null;
  const box = resolved.definition.viewBox;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height },
  ].map((point) =>
    transformPoint(point, instance.placement!.position, instance.placement!),
  );
  const x = Math.min(...corners.map((point) => point.x));
  const y = Math.min(...corners.map((point) => point.y));
  const right = Math.max(...corners.map((point) => point.x));
  const bottom = Math.max(...corners.map((point) => point.y));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function primitiveRecord(
  input: Readonly<Record<string, string | number | boolean>>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) =>
      left.localeCompare(right, "en"),
    ),
  );
}

function instanceTarget(
  properties: Readonly<Record<string, string | number | boolean>>,
): string | null {
  const target = properties["spice.target"];
  return typeof target === "string" ? target : null;
}

function subcircuitTargetName(target: string | null): string | null {
  const prefix = "subcircuit:";
  return target?.toLowerCase().startsWith(prefix)
    ? target.slice(prefix.length)
    : null;
}

function projectDocuments(
  options: BuildAgentSessionSnapshotOptions,
): readonly SchematicDocument[] {
  if (!options.project) return [options.document];
  return options.project.documents.map((document) =>
    document.id === options.document.id ? options.document : document,
  );
}

function projectIndex(options: BuildAgentSessionSnapshotOptions) {
  const documents = projectDocuments(options);
  const documentIdByName = new Map<string, string>();
  for (const document of documents) {
    documentIdByName.set(document.name.toLowerCase(), document.id);
    if (document.sourceBinding) {
      documentIdByName.set(
        document.sourceBinding.cellName.toLowerCase(),
        document.id,
      );
    }
  }
  return {
    id: options.project?.id ?? `project-${options.document.id}`,
    name: options.project?.name ?? options.document.name,
    topDocumentId: options.project?.topDocumentId ?? options.document.id,
    documents: [...documents]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((document) => ({
        id: document.id,
        name: document.name,
        instanceCount: document.instances.length,
        portCount: document.ports.length,
        netCount: document.nets.length,
        references: document.instances
          .flatMap((instance) => {
            const targetName = subcircuitTargetName(
              instanceTarget(instance.properties),
            );
            return targetName
              ? [
                  {
                    instanceId: instance.id,
                    targetName,
                    targetDocumentId:
                      documentIdByName.get(targetName.toLowerCase()) ?? null,
                  },
                ]
              : [];
          })
          .sort((left, right) =>
            left.instanceId.localeCompare(right.instanceId, "en"),
          ),
      })),
  };
}

function diagnosticSnapshot(
  document: SchematicDocument,
  resolver: SymbolResolver,
): AgentDiagnostic[] {
  return diagnoseVisualQuality(document, resolver).map((item) => ({
    code: item.code,
    severity: item.severity,
    category: item.category,
    confidence: item.confidence,
    gateEligible: item.gateEligible,
    message: item.message,
    objectIds: [...item.objectIds],
    revision: document.revision,
    ...(item.bounds ? { bounds: item.bounds } : {}),
    ...(item.point ? { point: item.point } : {}),
    ...(item.parameters ? { parameters: { ...item.parameters } } : {}),
  }));
}

function documentSnapshot(
  options: BuildAgentSessionSnapshotOptions,
): AgentSnapshotDocument {
  const { document, resolver } = options;
  const terminalNetByKey = new Map<string, string>();
  for (const net of document.nets) {
    for (const terminal of net.terminals) {
      terminalNetByKey.set(
        `${terminal.instanceId}\u0000${terminal.pinName}`,
        net.id,
      );
    }
  }
  const portNetById = new Map<string, string>();
  for (const net of document.nets) {
    for (const portId of net.ports) portNetById.set(portId, net.id);
  }

  const instances = [...document.instances]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((instance) => {
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      const pinByName = new Map<string, SymbolPin | undefined>(
        (resolved?.definition.pins ?? []).map((pin) => [pin.name, pin]),
      );
      for (const net of document.nets) {
        for (const terminal of net.terminals) {
          if (
            terminal.instanceId === instance.id &&
            !pinByName.has(terminal.pinName)
          ) {
            pinByName.set(terminal.pinName, undefined);
          }
        }
      }
      const hidden = new Set(resolved?.variant?.hiddenPinNames ?? []);
      const properties = primitiveRecord(instance.properties);
      const parameters = Object.fromEntries(
        Object.entries(properties)
          .filter(([key]) => key.startsWith("spice.param."))
          .map(
            ([key, value]) =>
              [key.slice("spice.param.".length), value] as const,
          )
          .sort(([left], [right]) => left.localeCompare(right, "en")),
      );
      const target = instanceTarget(properties);
      const model = target?.toLowerCase().startsWith("model:")
        ? target.slice("model:".length)
        : null;
      const sourceName = properties["spice.name"];
      const mosBulk = resolveMosBulkConnection(document, instance);
      return {
        id: instance.id,
        name: typeof sourceName === "string" ? sourceName : instance.id,
        symbolId: instance.symbolId,
        symbolVariantId: instance.symbolVariantId ?? null,
        target,
        model,
        properties,
        parameters,
        placement: instance.placement
          ? structuredClone(instance.placement)
          : null,
        bounds: placedInstanceBounds(document, instance.id, resolver),
        pins: [...pinByName.entries()]
          .sort(([left], [right]) => left.localeCompare(right, "en"))
          .map(([name, pin]) => ({
            name,
            role: pin?.role ?? null,
            direction: pin?.direction ?? null,
            visibility: pin
              ? hidden.has(name)
                ? ("conditional" as const)
                : pin.presentation.visibility
              : ("unknown" as const),
            localPosition: pin ? { ...pin.at } : null,
            pagePosition:
              pin && instance.placement
                ? transformPoint(
                    pin.at,
                    instance.placement.position,
                    instance.placement,
                  )
                : null,
            netId: terminalNetByKey.get(`${instance.id}\u0000${name}`) ?? null,
          })),
        ...(mosBulk
          ? {
              mosBulk: {
                status: mosBulk.status,
                netId: mosBulk.net?.id ?? null,
              },
            }
          : {}),
        ...(options.includeSourceSpans && instance.sourceRef
          ? { sourceRef: structuredClone(instance.sourceRef) }
          : {}),
      };
    });

  const routingGeometry = resolveDocumentRoutingGeometry(document, resolver);
  const routes = [...document.routes]
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((route) => {
      const geometry = routingGeometry.routes.get(route.id);
      return {
        id: route.id,
        netId: route.netId,
        from: structuredClone(route.from),
        to: structuredClone(route.to),
        waypoints: structuredClone(route.waypoints),
        segmentModes: [...route.segmentModes],
        ...(route.presentation ? { presentation: route.presentation } : {}),
        polyline: geometry ? [...geometry.centerline] : null,
      };
    });

  const bounds = enclosingBounds([
    ...instances.flatMap((instance) =>
      instance.bounds ? [instance.bounds] : [],
    ),
    ...document.ports.flatMap((port) =>
      port.position ? [pointBounds(port.position)] : [],
    ),
    ...document.junctions.map((junction) => pointBounds(junction.position)),
    ...document.annotations.map((annotation) =>
      pointBounds(annotation.position),
    ),
    ...routes.flatMap(
      (route) => route.polyline?.map((point) => pointBounds(point)) ?? [],
    ),
  ]);

  return {
    id: document.id,
    name: document.name,
    revision: document.revision,
    sourceStatus: document.sourceStatus,
    ...(document.sourceBinding
      ? {
          sourceBinding: {
            cellName: document.sourceBinding.cellName,
            ...(options.includeSourceSpans
              ? { sourceRef: structuredClone(document.sourceBinding.sourceRef) }
              : {}),
          },
        }
      : {}),
    bounds,
    presentation: structuredClone(document.presentation),
    ports: [...document.ports]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((port) => ({
        id: port.id,
        name: port.name,
        direction: port.direction,
        position: port.position ? { ...port.position } : null,
        netId: portNetById.get(port.id) ?? null,
      })),
    instances,
    nets: [...document.nets]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((net) => ({
        id: net.id,
        name: net.name ?? null,
        scope: net.scope,
        terminals: [...net.terminals].sort(
          (left, right) =>
            left.instanceId.localeCompare(right.instanceId, "en") ||
            left.pinName.localeCompare(right.pinName, "en"),
        ),
        portIds: [...net.ports].sort((left, right) =>
          left.localeCompare(right, "en"),
        ),
        routeIds: document.routes
          .filter((route) => route.netId === net.id)
          .map((route) => route.id)
          .sort((left, right) => left.localeCompare(right, "en")),
        junctionIds: document.junctions
          .filter((junction) => junction.netId === net.id)
          .map((junction) => junction.id)
          .sort((left, right) => left.localeCompare(right, "en")),
      })),
    routes,
    junctions: [...document.junctions]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((junction) => structuredClone(junction)),
    noConnects: [...document.noConnects]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((noConnect) => structuredClone(noConnect)),
    annotations: [...document.annotations]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((annotation) => structuredClone(annotation)),
    // ADR 0010 WP-R4: each drafting object carries its canonical shape plus the
    // derived resolved geometry (position(s)/bounds/diagnostics) from the
    // single resolveDraftingObjectGeometry entry; the Document's anchor JSON is
    // unchanged. Guides expose id/visible/locked by default; axis/coordinate
    // are included only when the request sets includeEditorGuides.
    drafting: {
      objects: [...(document.drafting?.objects ?? [])]
        .sort((left, right) => left.id.localeCompare(right.id, "en"))
        .map((object) => {
          const geometry = resolveDraftingObjectGeometry(
            document,
            resolver,
            object,
          );
          return {
            object: structuredClone(object),
            resolvedGeometry: geometry,
            diagnostics: geometry.diagnostics,
          };
        }),
      guides: [...(document.drafting?.guides ?? [])]
        .sort((left, right) => left.id.localeCompare(right.id, "en"))
        .map((guide) => ({
          id: guide.id,
          visible: guide.visible,
          locked: guide.locked,
          ...(options.includeEditorGuides
            ? { axis: guide.axis, coordinate: guide.coordinate }
            : {}),
        })),
    },
    layoutGroups: [...document.layoutGroups]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((group) => structuredClone(group)),
    constraints: [...document.constraints]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
      .map((constraint) => structuredClone(constraint)),
    diagnostics: diagnosticSnapshot(document, resolver),
  };
}

export function buildAgentSessionSnapshot(
  options: BuildAgentSessionSnapshotOptions,
): AgentSessionSnapshot {
  const content = {
    project: projectIndex(options),
    document: documentSnapshot(options),
  };
  const canonical = canonicalSnapshotContent(content);
  // ADR 0010: the Snapshot identity hash covers only electrical facts
  // (instances and pin inventory, ports, Nets and their membership,
  // hierarchical edges). Placement, route geometry, Junction placement,
  // annotations, drafting objects, guides, and diagnostics never change it, so
  // an electrically identical Document hashes identically across the schema-2
  // migration. When only a single Document is available (no Project view), the
  // hash is computed over that one Document's electrical projection.
  const projectView: Pick<
    CircuitProject,
    "id" | "topDocumentId" | "documents"
  > = options.project ?? {
    id: "anonymous",
    topDocumentId: options.document.id,
    documents: [options.document],
  };
  const topologyHash = electricalTopologyHash(projectView);
  return AgentSessionSnapshotSchema.parse({
    snapshotVersion: AGENT_SNAPSHOT_VERSION,
    electricalTopologyHash: topologyHash,
    byteLength: Buffer.byteLength(canonical, "utf8"),
    ...content,
  });
}
