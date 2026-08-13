import { resolveDocumentRoutingGeometry, sha256Hex } from "@icm/derived";
import {
  executeTransaction,
  proposeWireIntent,
  SchematicEditSchema,
} from "@icm/edit-engine";
import type { SchematicEdit } from "@icm/edit-engine";
import { flattenRichText, transformPoint } from "@icm/model";
import type {
  CircuitProject,
  Point,
  Rect,
  SchematicDocument,
} from "@icm/model";
import { buildSvgScene, renderDocumentSvg } from "@icm/render-svg";
import type { SymbolResolver } from "@icm/symbols";

import { base64EncodeUtf8, utf8ByteLength } from "./platform.js";
import {
  agentDiagnosticIdentity,
  agentProjectDiagnostics,
  agentVisualDiagnostics,
} from "./diagnostics.js";
import type { AgentOperationHost } from "./host.js";
import {
  parseAgentCircuitRequest,
  parseCompatibleAgentCircuitRequest,
} from "./request-contract.js";
import {
  AGENT_API_V1_VERSION,
  AGENT_API_VERSION,
  AGENT_API_V3_VERSION,
  AGENT_SNAPSHOT_VERSION,
  AGENT_SNAPSHOT_V3_VERSION,
  AgentCircuitResponseSchema,
} from "./schema.js";
import type {
  AgentCircuitResponse,
  AgentDiagnostic,
  AgentDiff,
  AgentLimits,
  AgentObjectDescriptor,
  AgentPermissions,
  AgentQueryRequest,
  AgentRenderRequest,
  AgentTransactRequest,
} from "./schema.js";
import { buildAgentCatalogSnapshot } from "./catalog.js";
import {
  buildAgentDocumentSnapshotV3,
  buildAgentProjectSnapshot,
  buildAgentSessionSnapshot,
  canonicalSnapshotContent,
} from "./snapshot.js";

const V1_OPERATIONS = ["capabilities", "query", "transact", "render"] as const;
const V2_OPERATIONS = [
  "capabilities",
  "snapshot",
  "transact",
  "render",
] as const;
// v3 advertises the implemented operation set; `artifact` and `collaborate` are
// added by AP4/AP7 when those operations land.
const V3_OPERATIONS = [
  "capabilities",
  "snapshot",
  "transact",
  "render",
] as const;
const QUERY_SCOPES = [
  "summary",
  "selection",
  "objects",
  "region",
  "net",
  "constraints",
  "diagnostics",
  "changes",
] as const;
/**
 * The Edit Engine schema is the sole list of typed edit kinds. `wire` is the
 * one deliberate extra capability: it advertises the mutually-exclusive
 * high-level `wireIntent` transaction form, not a SchematicEdit member.
 */
export const AGENT_EDIT_KINDS = Object.freeze([
  ...SchematicEditSchema.options
    .map((option) => option.shape.kind.value)
    .filter((kind) => agentEditCategory(kind) !== "unsupported"),
  "wire",
]);

export const DEFAULT_AGENT_LIMITS: AgentLimits = {
  maxQueryObjects: 200,
  maxQueryBytes: 128_000,
  maxSnapshotBytes: 4_000_000,
  maxTransactionEdits: 64,
  maxRenderBytes: 1_000_000,
  maxRequestBytes: 256_000,
  changeHistoryEntries: 32,
};

export interface AgentDocumentStore {
  getDocument(documentId?: string): SchematicDocument;
  commitDocument(document: SchematicDocument): void;
  getProject?(): CircuitProject;
}

export interface AgentCircuitServiceOptions {
  agentId: string;
  store: AgentDocumentStore;
  resolver: SymbolResolver;
  permissions: AgentPermissions;
  limits?: Partial<AgentLimits>;
}

/**
 * Editor/browser host mode: the service reads the live Project/resolver and
 * dispatches `transact` through the host's unified controller/history path
 * (ADR 0016 / WP-WA2) instead of invoking `executeTransaction` + a private
 * commit. Use this in the browser; use {@link AgentCircuitServiceOptions} for
 * the in-process/loopback host.
 */
export interface AgentCircuitHostServiceOptions {
  agentId: string;
  host: AgentOperationHost;
  permissions: AgentPermissions;
  limits?: Partial<AgentLimits>;
}

export interface AgentCircuitService {
  readonly limits: AgentLimits;
  handle(input: unknown): AgentCircuitResponse;
}

function errorResponse(
  apiVersion:
    | typeof AGENT_API_V1_VERSION
    | typeof AGENT_API_VERSION
    | typeof AGENT_API_V3_VERSION,
  requestId: string,
  operation: "error" | "query" | "snapshot" | "transact" | "render",
  code: string,
  message: string,
  revision?: number,
  diagnostics: AgentDiagnostic[] = [],
): AgentCircuitResponse {
  return AgentCircuitResponseSchema.parse({
    apiVersion,
    requestId,
    operation,
    ok: false,
    ...(revision === undefined ? {} : { revision }),
    error: { code, message },
    diagnostics,
  });
}

function collectResolvedRoutes(
  document: SchematicDocument,
  resolver: SymbolResolver,
  changedObjectIds: readonly string[],
): Array<{ routeId: string; polyline: Point[] }> {
  const changed = new Set(changedObjectIds);
  const routingGeometry = resolveDocumentRoutingGeometry(document, resolver);
  const result: Array<{ routeId: string; polyline: Point[] }> = [];
  for (const route of document.routes) {
    if (!changed.has(route.id)) continue;
    const polyline = routingGeometry.routes.get(route.id)?.centerline ?? null;
    if (polyline && polyline.length >= 2) {
      result.push({ routeId: route.id, polyline: [...polyline] });
    }
  }
  return result;
}

function sourceNetIds(document: SchematicDocument, objectId: string): string[] {
  return document.nets
    .filter(
      (net) =>
        net.id === objectId ||
        net.ports.includes(objectId) ||
        net.terminals.some((terminal) => terminal.instanceId === objectId),
    )
    .map((net) => net.id)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function instanceBounds(
  document: SchematicDocument,
  resolver: SymbolResolver,
  instanceId: string,
): Rect | undefined {
  const instance = document.instances.find((item) => item.id === instanceId);
  if (!instance?.placement) return undefined;
  const resolved = resolver.resolve(
    instance.symbolId,
    instance.symbolVariantId,
  );
  if (!resolved) return undefined;
  const box = resolved.definition.viewBox;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height },
  ].map((point) =>
    transformPoint(point, instance.placement!.position, instance.placement!),
  );
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

function limitedAttributes(
  input: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(input)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .slice(0, 32)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 256) : value,
      ]),
  );
}

function describeObjects(
  document: SchematicDocument,
  resolver: SymbolResolver,
  includeSourceSpans: boolean,
): AgentObjectDescriptor[] {
  const descriptors: AgentObjectDescriptor[] = [];
  for (const port of document.ports) {
    descriptors.push({
      id: port.id,
      kind: "port",
      name: port.name,
      ...(port.position ? { position: port.position } : {}),
      netIds: sourceNetIds(document, port.id),
      attributes: { direction: port.direction, placed: port.position !== null },
    });
  }
  for (const instance of document.instances) {
    const bounds = instanceBounds(document, resolver, instance.id);
    descriptors.push({
      id: instance.id,
      kind: "instance",
      ...(instance.placement ? { position: instance.placement.position } : {}),
      ...(bounds ? { bounds } : {}),
      netIds: sourceNetIds(document, instance.id),
      attributes: limitedAttributes({
        symbolId: instance.symbolId,
        ...(instance.symbolVariantId
          ? { symbolVariantId: instance.symbolVariantId }
          : {}),
        placed: instance.placement !== null,
        ...instance.properties,
      }),
      ...(includeSourceSpans && instance.sourceRef
        ? { sourceRef: instance.sourceRef }
        : {}),
    });
  }
  for (const net of document.nets) {
    descriptors.push({
      id: net.id,
      kind: "net",
      ...(net.name ? { name: net.name } : {}),
      netIds: [net.id],
      attributes: {
        scope: net.scope,
        terminalCount: net.terminals.length,
        portCount: net.ports.length,
      },
    });
  }
  for (const route of document.routes) {
    descriptors.push({
      id: route.id,
      kind: "route",
      netIds: [route.netId],
      attributes: {
        waypointCount: route.waypoints.length,
        locked: route.segmentModes.includes("locked"),
      },
    });
  }
  for (const junction of document.junctions) {
    descriptors.push({
      id: junction.id,
      kind: "junction",
      position: junction.position,
      netIds: [junction.netId],
      attributes: { role: junction.role ?? "branch" },
    });
  }
  for (const annotation of document.annotations) {
    descriptors.push({
      id: annotation.id,
      kind: "annotation",
      name: flattenRichText(annotation.content).slice(0, 128),
      position:
        annotation.anchor.kind === "free"
          ? annotation.anchor.position
          : annotation.anchor.fallbackPosition,
      netIds: annotation.netId ? [annotation.netId] : [],
      attributes: {
        kind: annotation.kind,
        locked: annotation.locked,
        anchorKind: annotation.anchor.kind,
      },
    });
  }
  for (const group of document.layoutGroups) {
    descriptors.push({
      id: group.id,
      kind: "layout-group",
      netIds: [],
      attributes: {
        kind: group.kind,
        objectCount: group.objectIds.length,
        locked: group.locked,
      },
    });
  }
  for (const constraint of document.constraints) {
    descriptors.push({
      id: constraint.id,
      kind: "constraint",
      netIds: [],
      attributes: {
        kind: constraint.kind,
        objectCount: constraint.objectIds.length,
        locked: constraint.locked,
      },
    });
  }
  return descriptors.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind, "en") ||
      left.id.localeCompare(right.id, "en"),
  );
}

function pointInBounds(point: Point, bounds: Rect): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function selectQueryIds(
  request: AgentQueryRequest,
  document: SchematicDocument,
  resolver: SymbolResolver,
  changes: readonly AgentDiff[],
): { ids: Set<string>; selectedChanges?: AgentDiff[] } {
  const scope = request.scope;
  switch (scope.kind) {
    case "summary":
    case "diagnostics":
      return { ids: new Set() };
    case "selection":
    case "objects":
      return { ids: new Set(scope.objectIds) };
    case "constraints":
      return {
        ids: new Set([
          ...document.layoutGroups.map((item) => item.id),
          ...document.constraints.map((item) => item.id),
        ]),
      };
    case "net": {
      const net = document.nets.find((item) => item.id === scope.netId);
      if (!net) return { ids: new Set([scope.netId]) };
      return {
        ids: new Set([
          net.id,
          ...net.ports,
          ...net.terminals.map((terminal) => terminal.instanceId),
          ...document.routes
            .filter((route) => route.netId === net.id)
            .map((route) => route.id),
          ...document.junctions
            .filter((junction) => junction.netId === net.id)
            .map((junction) => junction.id),
          ...document.annotations
            .filter((annotation) => annotation.netId === net.id)
            .map((annotation) => annotation.id),
        ]),
      };
    }
    case "region": {
      const ids = new Set<string>();
      const routingGeometry = resolveDocumentRoutingGeometry(
        document,
        resolver,
      );
      for (const instance of document.instances) {
        if (
          instance.placement &&
          pointInBounds(instance.placement.position, scope.bounds)
        )
          ids.add(instance.id);
      }
      for (const port of document.ports) {
        if (port.position && pointInBounds(port.position, scope.bounds))
          ids.add(port.id);
      }
      for (const junction of document.junctions) {
        if (pointInBounds(junction.position, scope.bounds))
          ids.add(junction.id);
      }
      for (const annotation of document.annotations) {
        const position =
          annotation.anchor.kind === "free"
            ? annotation.anchor.position
            : annotation.anchor.fallbackPosition;
        if (pointInBounds(position, scope.bounds)) ids.add(annotation.id);
      }
      for (const route of document.routes) {
        const polyline = routingGeometry.routes.get(route.id);
        if (
          polyline?.centerline.some((point) =>
            pointInBounds(point, scope.bounds),
          )
        )
          ids.add(route.id);
      }
      return { ids };
    }
    case "changes": {
      const selectedChanges = changes.filter(
        (change) => change.toRevision > scope.sinceRevision,
      );
      return {
        ids: new Set(
          selectedChanges.flatMap((change) => change.changedObjectIds),
        ),
        selectedChanges,
      };
    }
  }
}

export function agentEditCategory(
  kind: SchematicEdit["kind"],
): "geometry" | "connectivity" | "presentation" | "unsupported" {
  switch (kind) {
    case "noop":
    case "add_instance":
    case "remove_instance":
    case "set_instance_symbol":
    case "place_instance":
    case "move_instance":
    case "rotate_instance":
    case "mirror_instance":
    case "add_port":
    case "place_port":
    case "move_port":
    case "move_junction":
    case "align_instances":
      return "geometry";
    case "patch_instance_properties":
      return "presentation";
    case "set_instance_netlist":
    case "set_cell_netlist_interface":
    case "remove_port":
    case "rename_port":
    case "set_port_direction":
      return "connectivity";
    case "set_route_points":
    case "route_orthogonal":
    case "add_junction":
    case "attach_endpoint_to_route":
    case "remove_junction":
    case "make_flightline":
    case "cut_connection":
    case "connect_endpoints":
    case "add_power_rail":
    case "merge_nets":
    case "set_net_name":
    case "set_net_power_domain":
    case "normalize_power_nets":
    case "clear_document":
    case "set_mos_bulk_defaults":
    case "reconcile_mos_bulk":
    case "clear_mos_bulk_default":
    case "disconnect_endpoint":
    case "add_no_connect":
    case "remove_no_connect":
      return "connectivity";
    case "upsert_schematic_annotation":
    case "remove_schematic_annotation":
    case "upsert_drafting_object":
    case "remove_drafting_object":
    case "set_presentation_style":
    case "set_port_presentation":
    case "set_layout_group":
    case "remove_layout_group":
    case "set_layout_constraint":
    case "remove_layout_constraint":
      return "presentation";
    case "undo":
    case "redo":
      return "unsupported";
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderArtifact(
  request: AgentRenderRequest,
  document: SchematicDocument,
  resolver: SymbolResolver,
  diagnostics: AgentDiagnostic[],
): { svg: string; diagnostics: AgentDiagnostic[] } {
  const options = request.bounds ? { bounds: request.bounds } : {};
  let svg = renderDocumentSvg(document, resolver, options);
  if (request.mode === "diagnostics") {
    const scene = buildSvgScene(document, resolver, options);
    const lines = diagnostics
      .slice(0, 20)
      .map(
        (item, index) =>
          `<text x="${scene.viewBox.x + 6}" y="${scene.viewBox.y + 16 + index * 14}">${escapeXml(`${item.severity.toUpperCase()} ${item.code}: ${item.objectIds?.join(", ") ?? ""}`)}</text>`,
      )
      .join("");
    svg = svg.replace(
      "</svg>",
      `<g data-layer="agent-diagnostics" fill="#b00020" font-family="sans-serif" font-size="10px">${lines}</g></svg>`,
    );
  }
  return { svg, diagnostics };
}

export function createAgentCircuitService(
  options: AgentCircuitServiceOptions | AgentCircuitHostServiceOptions,
): AgentCircuitService {
  const limits = { ...DEFAULT_AGENT_LIMITS, ...options.limits };
  const history: AgentDiff[] = [];
  const response = (input: unknown): AgentCircuitResponse =>
    AgentCircuitResponseSchema.parse(input);
  const useHost = "host" in options;
  const host = useHost
    ? (options as AgentCircuitHostServiceOptions).host
    : null;
  const storeOptions = (
    useHost ? null : options
  ) as AgentCircuitServiceOptions | null;

  return {
    limits,
    handle(input: unknown): AgentCircuitResponse {
      // A browser-host service is the hosted public path and always parses the
      // production v2 contract. The in-process store service retains only the
      // explicit local v1/v3 migration reader.
      const parsed = useHost
        ? parseAgentCircuitRequest(input)
        : parseCompatibleAgentCircuitRequest(input);
      if (!parsed.success) {
        return parsed.response;
      }
      const request = parsed.data;
      const fail = (
        operation: "error" | "query" | "snapshot" | "transact" | "render",
        code: string,
        message: string,
        revision?: number,
        diagnostics: AgentDiagnostic[] = [],
      ) =>
        errorResponse(
          request.apiVersion,
          request.requestId,
          operation,
          code,
          message,
          revision,
          diagnostics,
        );
      if (request.operation === "capabilities") {
        const snapshotPermission =
          options.permissions.snapshot ?? options.permissions.query;
        const semanticControl = Boolean(
          options.permissions.semanticControl &&
          host?.semanticControlAvailable?.(),
        );
        const { query: _queryPermission, ...productionPermissions } = {
          ...options.permissions,
          snapshot: snapshotPermission,
          semanticControl,
        };
        const {
          maxQueryObjects: _maxQueryObjects,
          maxQueryBytes: _maxQueryBytes,
          ...productionLimits
        } = limits;
        return response({
          apiVersion: request.apiVersion,
          requestId: request.requestId,
          operation: "capabilities",
          ok: true,
          capabilities: {
            apiVersions:
              request.apiVersion === AGENT_API_VERSION
                ? [AGENT_API_VERSION]
                : [
                    AGENT_API_V1_VERSION,
                    AGENT_API_VERSION,
                    AGENT_API_V3_VERSION,
                  ],
            snapshotVersions:
              request.apiVersion === AGENT_API_VERSION
                ? [AGENT_SNAPSHOT_VERSION]
                : [AGENT_SNAPSHOT_VERSION, AGENT_SNAPSHOT_V3_VERSION],
            operations:
              request.apiVersion === AGENT_API_V1_VERSION
                ? V1_OPERATIONS
                : request.apiVersion === AGENT_API_V3_VERSION
                  ? V3_OPERATIONS
                  : V2_OPERATIONS,
            ...(request.apiVersion === AGENT_API_V1_VERSION
              ? { queryScopes: QUERY_SCOPES }
              : {}),
            editKinds: AGENT_EDIT_KINDS,
            permissions:
              request.apiVersion === AGENT_API_VERSION
                ? productionPermissions
                : {
                    ...options.permissions,
                    snapshot: snapshotPermission,
                    semanticControl,
                  },
            limits:
              request.apiVersion === AGENT_API_VERSION
                ? productionLimits
                : limits,
          },
        });
      }

      if (
        request.operation === "snapshot" &&
        request.apiVersion === AGENT_API_V3_VERSION
      ) {
        if (!(options.permissions.snapshot ?? options.permissions.query)) {
          return fail(
            "snapshot",
            "PERMISSION_DENIED",
            "Snapshot permission is not granted",
          );
        }
        const includeSourceSpans = request.includeSourceSpans === true;
        if (includeSourceSpans && !options.permissions.sourceSpans) {
          return fail(
            "snapshot",
            "PERMISSION_DENIED",
            "Source-span permission is not granted",
          );
        }
        const resolver = host ? host.getResolver() : storeOptions!.resolver;
        const project = host
          ? host.getProject?.()
          : storeOptions!.store.getProject?.();

        if (request.target === "catalog") {
          const symbolLibrary = project?.symbolLibrary ?? {
            id: "razavi-symbols",
            version: "1",
          };
          const catalog = buildAgentCatalogSnapshot({ symbolLibrary });
          const catalogBytes = utf8ByteLength(
            canonicalSnapshotContent(catalog),
          );
          if (catalogBytes > limits.maxSnapshotBytes) {
            return fail(
              "snapshot",
              "SNAPSHOT_TOO_LARGE",
              `Snapshot content exceeds ${limits.maxSnapshotBytes} bytes`,
            );
          }
          return response({
            apiVersion: request.apiVersion,
            requestId: request.requestId,
            operation: "snapshot",
            ok: true,
            target: "catalog",
            catalog,
            diagnostics: [],
          });
        }

        if (request.target === "project") {
          if (!project) {
            return fail(
              "snapshot",
              "INVALID_REQUEST",
              "The project target requires an active Project",
            );
          }
          const projectSnapshot = buildAgentProjectSnapshot({ project });
          const projectBytes = utf8ByteLength(
            canonicalSnapshotContent(projectSnapshot),
          );
          if (projectBytes > limits.maxSnapshotBytes) {
            return fail(
              "snapshot",
              "SNAPSHOT_TOO_LARGE",
              `Snapshot content exceeds ${limits.maxSnapshotBytes} bytes`,
            );
          }
          return response({
            apiVersion: request.apiVersion,
            requestId: request.requestId,
            operation: "snapshot",
            ok: true,
            target: "project",
            project: projectSnapshot,
            diagnostics: [],
          });
        }

        // request.target === "document"
        const documentId = request.documentId;
        if (!documentId) {
          return fail(
            "snapshot",
            "INVALID_REQUEST",
            "The document target requires a documentId",
          );
        }
        const document = host
          ? host.getDocument(documentId)
          : storeOptions!.store.getDocument(documentId);
        if (!document || documentId !== document.id) {
          return fail(
            "snapshot",
            "DOCUMENT_NOT_FOUND",
            `The service is not bound to Document ${documentId}`,
            document?.revision,
          );
        }
        const base = buildAgentSessionSnapshot({
          ...(project ? { project } : {}),
          document,
          resolver,
          includeSourceSpans,
        });
        const documentSnapshot = buildAgentDocumentSnapshotV3({
          ...(project ? { project } : {}),
          document,
          resolver,
          includeSourceSpans,
        });
        const documentBytes = utf8ByteLength(
          canonicalSnapshotContent({
            project: base.project,
            document: documentSnapshot,
          }),
        );
        if (documentBytes > limits.maxSnapshotBytes) {
          return fail(
            "snapshot",
            "SNAPSHOT_TOO_LARGE",
            `Snapshot content exceeds ${limits.maxSnapshotBytes} bytes`,
            document.revision,
          );
        }
        return response({
          apiVersion: request.apiVersion,
          requestId: request.requestId,
          operation: "snapshot",
          ok: true,
          target: "document",
          revision: document.revision,
          electricalTopologyHash: base.electricalTopologyHash,
          byteLength: documentBytes,
          project: base.project,
          document: documentSnapshot,
          diagnostics: documentSnapshot.diagnostics,
        });
      }

      // The v3 snapshot branch above returned; every remaining operation
      // (v2 snapshot, query, transact, render) carries a required documentId.
      const documentId = request.documentId!;
      const document = host
        ? host.getDocument(documentId)
        : storeOptions!.store.getDocument(documentId);
      if (!document || documentId !== document.id) {
        return fail(
          request.operation,
          "DOCUMENT_NOT_FOUND",
          `The service is not bound to Document ${documentId}`,
          document?.revision,
        );
      }
      const resolver = host ? host.getResolver() : storeOptions!.resolver;
      const project = host
        ? host.getProject?.()
        : storeOptions!.store.getProject?.();

      if (request.operation === "snapshot") {
        if (!(options.permissions.snapshot ?? options.permissions.query)) {
          return fail(
            "snapshot",
            "PERMISSION_DENIED",
            "Snapshot permission is not granted",
            document.revision,
          );
        }
        const includeSourceSpans = request.includeSourceSpans === true;
        if (includeSourceSpans && !options.permissions.sourceSpans) {
          return fail(
            "snapshot",
            "PERMISSION_DENIED",
            "Source-span permission is not granted",
            document.revision,
          );
        }
        const snapshot = buildAgentSessionSnapshot({
          ...(project ? { project } : {}),
          document,
          resolver,
          includeSourceSpans,
        });
        if (snapshot.byteLength > limits.maxSnapshotBytes) {
          return fail(
            "snapshot",
            "SNAPSHOT_TOO_LARGE",
            `Snapshot content exceeds ${limits.maxSnapshotBytes} bytes`,
            document.revision,
          );
        }
        return response({
          apiVersion: request.apiVersion,
          requestId: request.requestId,
          operation: "snapshot",
          ok: true,
          revision: document.revision,
          snapshot,
          diagnostics: snapshot.document.diagnostics,
        });
      }

      if (request.operation === "query") {
        if (!options.permissions.query) {
          return fail(
            "query",
            "PERMISSION_DENIED",
            "Query permission is not granted",
            document.revision,
          );
        }
        const includeSourceSpans = request.includeSourceSpans === true;
        if (includeSourceSpans && !options.permissions.sourceSpans) {
          return fail(
            "query",
            "PERMISSION_DENIED",
            "Source-span permission is not granted",
            document.revision,
          );
        }
        const all = describeObjects(document, resolver, includeSourceSpans);
        const selected = selectQueryIds(request, document, resolver, history);
        const requested = all.filter((item) => selected.ids.has(item.id));
        const requestedLimit = Math.min(
          request.limit ?? limits.maxQueryObjects,
          limits.maxQueryObjects,
        );
        const objects: AgentObjectDescriptor[] = [];
        let bytes = 0;
        for (const item of requested) {
          const itemBytes = utf8ByteLength(JSON.stringify(item));
          if (
            objects.length >= requestedLimit ||
            bytes + itemBytes > limits.maxQueryBytes
          ) {
            break;
          }
          objects.push(item);
          bytes += itemBytes;
        }
        const missingIds = [...selected.ids].filter(
          (id) => !all.some((item) => item.id === id),
        );
        const diagnostics = [
          ...(project
            ? agentProjectDiagnostics(
                project,
                resolver,
                document.id,
                document.revision,
              )
            : agentVisualDiagnostics(document, resolver)),
          ...missingIds.map((id) => ({
            code: "AGENT_QUERY_OBJECT_NOT_FOUND",
            severity: "info" as const,
            message: `Object ${id} is not present in the current Document`,
            objectIds: [id],
          })),
        ];
        return response({
          apiVersion: request.apiVersion,
          requestId: request.requestId,
          operation: "query",
          ok: true,
          revision: document.revision,
          ...(request.scope.kind === "summary"
            ? {
                summary: {
                  name: document.name,
                  styleProfileId: document.presentation.styleProfileId,
                  counts: {
                    ports: document.ports.length,
                    instances: document.instances.length,
                    nets: document.nets.length,
                    routes: document.routes.length,
                    junctions: document.junctions.length,
                    annotations: document.annotations.length,
                    layoutGroups: document.layoutGroups.length,
                    constraints: document.constraints.length,
                  },
                },
              }
            : {}),
          objects,
          ...(selected.selectedChanges
            ? { changes: selected.selectedChanges }
            : {}),
          diagnostics,
          truncated: objects.length < requested.length,
          omittedCount: requested.length - objects.length,
        });
      }

      if (request.operation === "transact") {
        if (request.semanticIntent) {
          if (!options.permissions.semanticControl) {
            return fail(
              "transact",
              "PERMISSION_DENIED",
              "Semantic editor-control permission is not granted",
              document.revision,
            );
          }
          if (
            !host?.applySemanticIntent ||
            !host.semanticControlAvailable?.()
          ) {
            return fail(
              "transact",
              "SEMANTIC_CONTROL_UNAVAILABLE",
              "This Agent host does not provide a live editor control surface",
              document.revision,
            );
          }
          if (request.expectedRevision !== document.revision) {
            return fail(
              "transact",
              "STALE_REVISION",
              `Expected revision ${request.expectedRevision}, current revision is ${document.revision}`,
              document.revision,
            );
          }
          const semantic = host.applySemanticIntent({
            documentId: request.documentId,
            intent: request.semanticIntent,
          });
          if (!semantic.ok) {
            return fail(
              "transact",
              semantic.code,
              semantic.message,
              document.revision,
            );
          }
          const diagnostics = project
            ? agentProjectDiagnostics(
                project,
                resolver,
                document.id,
                document.revision,
              )
            : agentVisualDiagnostics(document, resolver);
          return response({
            apiVersion: request.apiVersion,
            requestId: request.requestId,
            operation: "transact",
            ok: true,
            applied: false,
            revision: document.revision,
            proposedRevision: document.revision,
            diff: {
              documentId: document.id,
              fromRevision: document.revision,
              toRevision: document.revision,
              editKinds: [],
              changedObjectIds: [],
            },
            diagnostics,
            semantic: {
              kind: semantic.kind,
              documentId: semantic.documentId,
              objectIds: [...semantic.objectIds],
              ...(semantic.netId ? { netId: semantic.netId } : {}),
            },
          });
        }
        if (request.wireIntent) {
          if (
            !options.permissions.edit.geometry ||
            !options.permissions.edit.connectivity
          ) {
            return fail(
              "transact",
              "PERMISSION_DENIED",
              "Wire intent requires geometry and connectivity edit permissions",
              document.revision,
            );
          }
        }
        const plannedWire = request.wireIntent
          ? proposeWireIntent(document, resolver, request.wireIntent)
          : null;
        if (typeof plannedWire === "string") {
          return fail(
            "transact",
            "EDIT_PRECONDITION",
            plannedWire,
            document.revision,
          );
        }
        const edits = request.edits ?? plannedWire?.edits ?? [];
        if (edits.length > limits.maxTransactionEdits) {
          return fail(
            "transact",
            "LIMIT_EXCEEDED",
            `A transaction may contain at most ${limits.maxTransactionEdits} edits`,
            document.revision,
          );
        }
        for (const edit of edits) {
          const category = agentEditCategory(edit.kind);
          if (category === "unsupported") {
            return fail(
              "transact",
              "UNSUPPORTED_EDIT",
              `Edit ${edit.kind} is not exposed by Agent Circuit API ${request.apiVersion}`,
              document.revision,
            );
          }
          if (!options.permissions.edit[category]) {
            return fail(
              "transact",
              "PERMISSION_DENIED",
              `${category} edit permission is not granted`,
              document.revision,
            );
          }
        }
        const result = host
          ? host.dispatchTransaction({
              transactionId: request.transactionId,
              documentId: request.documentId,
              expectedRevision: request.expectedRevision,
              actor: { kind: "agent", id: options.agentId },
              ...(request.dryRun === undefined
                ? {}
                : { dryRun: request.dryRun }),
              edits,
            })
          : executeTransaction(
              document,
              {
                transactionId: request.transactionId,
                documentId: request.documentId,
                expectedRevision: request.expectedRevision,
                actor: { kind: "agent", id: options.agentId },
                ...(request.dryRun === undefined
                  ? {}
                  : { dryRun: request.dryRun }),
                edits,
              },
              { symbolResolver: resolver },
            );
        if (!result.ok) {
          return fail(
            "transact",
            result.error.code,
            result.error.message,
            result.revision,
            result.diagnostics.map((item) => ({
              code: item.code,
              severity: item.severity,
              message: item.message,
              revision: result.revision,
              ...(item.objectIds ? { objectIds: [...item.objectIds] } : {}),
              ...(item.path ? { path: [...item.path] } : {}),
              ...(item.parameters
                ? { parameters: { ...item.parameters } }
                : {}),
            })),
          );
        }
        if (result.applied) {
          // The browser host commits through the controller/history dispatch;
          // only the in-process/loopback store commits independently here.
          if (!useHost) {
            storeOptions!.store.commitDocument(result.document);
          }
          history.push({
            ...result.diff,
            editKinds: [...result.diff.editKinds],
            changedObjectIds: [...result.diff.changedObjectIds],
          });
          if (history.length > limits.changeHistoryEntries) history.shift();
        }
        // Surface the actual stored geometry for Routes this transaction
        // touched, so a caller learns the post-normalization polyline (e.g.
        // after set_route_points collapses collinear waypoints) without a
        // fresh Snapshot. dryRun reports the proposed geometry the same way.
        const resolvedRoutes = collectResolvedRoutes(
          result.document,
          resolver,
          result.diff.changedObjectIds,
        );
        const proposedProject = project
          ? {
              ...project,
              documents: project.documents.map((candidate) =>
                candidate.id === result.document.id
                  ? result.document
                  : candidate,
              ),
            }
          : undefined;
        const diagnostics = proposedProject
          ? agentProjectDiagnostics(
              proposedProject,
              resolver,
              result.document.id,
              result.proposedRevision,
            )
          : agentVisualDiagnostics(result.document, resolver);
        const beforeDiagnostics = project
          ? agentProjectDiagnostics(
              project,
              resolver,
              document.id,
              document.revision,
            )
          : agentVisualDiagnostics(document, resolver);
        const beforeIds = new Set(
          beforeDiagnostics.map(agentDiagnosticIdentity),
        );
        const afterIds = new Set(diagnostics.map(agentDiagnosticIdentity));
        return response({
          apiVersion: request.apiVersion,
          requestId: request.requestId,
          operation: "transact",
          ok: true,
          applied: result.applied,
          revision: result.revision,
          proposedRevision: result.proposedRevision,
          diff: result.diff,
          diagnostics,
          diagnosticDelta: {
            added: diagnostics.filter(
              (diagnostic) =>
                !beforeIds.has(agentDiagnosticIdentity(diagnostic)),
            ),
            removed: beforeDiagnostics.filter(
              (diagnostic) =>
                !afterIds.has(agentDiagnosticIdentity(diagnostic)),
            ),
          },
          ...(resolvedRoutes.length === 0 ? {} : { resolvedRoutes }),
        });
      }

      if (!options.permissions.render) {
        return fail(
          "render",
          "PERMISSION_DENIED",
          "Render permission is not granted",
          document.revision,
        );
      }
      try {
        const rendered = renderArtifact(
          request,
          document,
          resolver,
          project
            ? agentProjectDiagnostics(
                project,
                resolver,
                document.id,
                document.revision,
              )
            : agentVisualDiagnostics(document, resolver),
        );
        const byteLength = utf8ByteLength(rendered.svg);
        if (byteLength > limits.maxRenderBytes) {
          return fail(
            "render",
            "RENDER_TOO_LARGE",
            `Render artifact exceeds ${limits.maxRenderBytes} bytes`,
            document.revision,
          );
        }
        return response({
          apiVersion: request.apiVersion,
          requestId: request.requestId,
          operation: "render",
          ok: true,
          revision: document.revision,
          artifact: {
            mediaType: "image/svg+xml",
            encoding: "base64",
            data: base64EncodeUtf8(rendered.svg),
            sha256: sha256Hex(rendered.svg),
            byteLength,
            mode: request.mode,
          },
          diagnostics: rendered.diagnostics,
        });
      } catch (error) {
        return fail(
          "render",
          "RENDER_FAILED",
          error instanceof Error ? error.message : String(error),
          document.revision,
        );
      }
    },
  };
}
