import { createHash } from "node:crypto";

import { diagnoseVisualQuality, routePolyline } from "@icm/derived";
import { executeTransaction } from "@icm/edit-engine";
import type { SchematicEdit } from "@icm/edit-engine";
import { transformPoint } from "@icm/model";
import type { Point, Rect, SchematicDocument } from "@icm/model";
import { buildSvgScene, renderDocumentSvg } from "@icm/render-svg";
import type { SymbolResolver } from "@icm/symbols";

import {
  AGENT_API_VERSION,
  AgentCircuitRequestSchema,
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

const OPERATIONS = ["capabilities", "query", "transact", "render"] as const;
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
export const AGENT_EDIT_KINDS = [
  "noop",
  "add_instance",
  "remove_instance",
  "place_instance",
  "move_instance",
  "rotate_instance",
  "mirror_instance",
  "set_route_points",
  "add_junction",
  "remove_junction",
  "move_junction",
  "make_flightline",
  "connect_endpoints",
  "merge_nets",
  "set_net_name",
  "disconnect_endpoint",
  "upsert_annotation",
  "remove_annotation",
  "set_layout_group",
  "remove_layout_group",
  "set_layout_constraint",
  "remove_layout_constraint",
  "align_instances",
] as const;

export const DEFAULT_AGENT_LIMITS: AgentLimits = {
  maxQueryObjects: 200,
  maxQueryBytes: 128_000,
  maxTransactionEdits: 64,
  maxRenderBytes: 1_000_000,
  maxRequestBytes: 256_000,
  changeHistoryEntries: 32,
};

export interface AgentDocumentStore {
  getDocument(): SchematicDocument;
  commitDocument(document: SchematicDocument): void;
}

export interface AgentCircuitServiceOptions {
  agentId: string;
  store: AgentDocumentStore;
  resolver: SymbolResolver;
  permissions: AgentPermissions;
  limits?: Partial<AgentLimits>;
}

export interface AgentCircuitService {
  readonly limits: AgentLimits;
  handle(input: unknown): AgentCircuitResponse;
}

function errorResponse(
  requestId: string,
  operation: "error" | "query" | "transact" | "render",
  code: string,
  message: string,
  revision?: number,
  diagnostics: AgentDiagnostic[] = [],
): AgentCircuitResponse {
  return AgentCircuitResponseSchema.parse({
    apiVersion: AGENT_API_VERSION,
    requestId,
    operation,
    ok: false,
    ...(revision === undefined ? {} : { revision }),
    error: { code, message },
    diagnostics,
  });
}

function visualDiagnostics(
  document: SchematicDocument,
  resolver: SymbolResolver,
): AgentDiagnostic[] {
  return diagnoseVisualQuality(document, resolver).map((item) => ({
    code: item.code,
    severity: item.severity,
    message: item.message,
    objectIds: [...item.objectIds],
  }));
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
      attributes: {},
    });
  }
  for (const annotation of document.annotations) {
    descriptors.push({
      id: annotation.id,
      kind: "annotation",
      name: annotation.text.slice(0, 128),
      position: annotation.position,
      netIds: annotation.attachedObjectId
        ? sourceNetIds(document, annotation.attachedObjectId)
        : [],
      attributes: {
        kind: annotation.kind,
        locked: annotation.locked,
        attached: annotation.attachedObjectId !== undefined,
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
            .filter((annotation) => annotation.attachedObjectId === net.id)
            .map((annotation) => annotation.id),
        ]),
      };
    }
    case "region": {
      const ids = new Set<string>();
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
        if (pointInBounds(annotation.position, scope.bounds))
          ids.add(annotation.id);
      }
      for (const route of document.routes) {
        const polyline = routePolyline(document, resolver, route);
        if (
          polyline?.points.some((point) => pointInBounds(point, scope.bounds))
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

function editCategory(
  edit: SchematicEdit,
): "geometry" | "connectivity" | "presentation" | "unsupported" {
  switch (edit.kind) {
    case "noop":
    case "add_instance":
    case "remove_instance":
    case "place_instance":
    case "move_instance":
    case "rotate_instance":
    case "mirror_instance":
    case "move_junction":
    case "align_instances":
      return "geometry";
    case "set_route_points":
    case "add_junction":
    case "remove_junction":
    case "make_flightline":
    case "connect_endpoints":
    case "merge_nets":
    case "set_net_name":
    case "disconnect_endpoint":
      return "connectivity";
    case "upsert_annotation":
    case "remove_annotation":
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
): { svg: string; diagnostics: AgentDiagnostic[] } {
  const options = request.bounds ? { bounds: request.bounds } : {};
  let svg = renderDocumentSvg(document, resolver, options);
  const diagnostics = visualDiagnostics(document, resolver);
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
  options: AgentCircuitServiceOptions,
): AgentCircuitService {
  const limits = { ...DEFAULT_AGENT_LIMITS, ...options.limits };
  const history: AgentDiff[] = [];
  const response = (input: unknown): AgentCircuitResponse =>
    AgentCircuitResponseSchema.parse(input);

  return {
    limits,
    handle(input: unknown): AgentCircuitResponse {
      const parsed = AgentCircuitRequestSchema.safeParse(input);
      if (!parsed.success) {
        const candidate = input as { requestId?: unknown } | null;
        const requestId =
          candidate && typeof candidate.requestId === "string"
            ? candidate.requestId
            : "invalid-request";
        return errorResponse(
          requestId,
          "error",
          "INVALID_REQUEST",
          parsed.error.issues.map((issue) => issue.message).join("; "),
        );
      }
      const request = parsed.data;
      if (request.operation === "capabilities") {
        return response({
          apiVersion: AGENT_API_VERSION,
          requestId: request.requestId,
          operation: "capabilities",
          ok: true,
          capabilities: {
            operations: OPERATIONS,
            queryScopes: QUERY_SCOPES,
            editKinds: AGENT_EDIT_KINDS,
            permissions: options.permissions,
            limits,
          },
        });
      }

      const document = options.store.getDocument();
      if (request.documentId !== document.id) {
        return errorResponse(
          request.requestId,
          request.operation,
          "DOCUMENT_NOT_FOUND",
          `The service is not bound to Document ${request.documentId}`,
          document.revision,
        );
      }

      if (request.operation === "query") {
        if (!options.permissions.query) {
          return errorResponse(
            request.requestId,
            "query",
            "PERMISSION_DENIED",
            "Query permission is not granted",
            document.revision,
          );
        }
        const includeSourceSpans = request.includeSourceSpans === true;
        if (includeSourceSpans && !options.permissions.sourceSpans) {
          return errorResponse(
            request.requestId,
            "query",
            "PERMISSION_DENIED",
            "Source-span permission is not granted",
            document.revision,
          );
        }
        const all = describeObjects(
          document,
          options.resolver,
          includeSourceSpans,
        );
        const selected = selectQueryIds(
          request,
          document,
          options.resolver,
          history,
        );
        const requested = all.filter((item) => selected.ids.has(item.id));
        const requestedLimit = Math.min(
          request.limit ?? limits.maxQueryObjects,
          limits.maxQueryObjects,
        );
        const objects: AgentObjectDescriptor[] = [];
        let bytes = 0;
        for (const item of requested) {
          const itemBytes = Buffer.byteLength(JSON.stringify(item), "utf8");
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
          ...visualDiagnostics(document, options.resolver),
          ...missingIds.map((id) => ({
            code: "AGENT_QUERY_OBJECT_NOT_FOUND",
            severity: "info" as const,
            message: `Object ${id} is not present in the current Document`,
            objectIds: [id],
          })),
        ];
        return response({
          apiVersion: AGENT_API_VERSION,
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
        if (request.edits.length > limits.maxTransactionEdits) {
          return errorResponse(
            request.requestId,
            "transact",
            "LIMIT_EXCEEDED",
            `A transaction may contain at most ${limits.maxTransactionEdits} edits`,
            document.revision,
          );
        }
        for (const edit of request.edits) {
          const category = editCategory(edit);
          if (category === "unsupported") {
            return errorResponse(
              request.requestId,
              "transact",
              "UNSUPPORTED_EDIT",
              `Edit ${edit.kind} is not exposed by Agent Circuit API v1`,
              document.revision,
            );
          }
          if (!options.permissions.edit[category]) {
            return errorResponse(
              request.requestId,
              "transact",
              "PERMISSION_DENIED",
              `${category} edit permission is not granted`,
              document.revision,
            );
          }
        }
        const result = executeTransaction(
          document,
          {
            transactionId: request.transactionId,
            documentId: request.documentId,
            expectedRevision: request.expectedRevision,
            actor: { kind: "agent", id: options.agentId },
            ...(request.dryRun === undefined ? {} : { dryRun: request.dryRun }),
            edits: request.edits,
          },
          { symbolResolver: options.resolver },
        );
        if (!result.ok) {
          return errorResponse(
            request.requestId,
            "transact",
            result.error.code,
            result.error.message,
            result.revision,
            result.diagnostics.map((item) => ({
              code: item.code,
              severity: item.severity,
              message: item.message,
              ...(item.path ? { path: [...item.path] } : {}),
            })),
          );
        }
        if (result.applied) {
          options.store.commitDocument(result.document);
          history.push({
            ...result.diff,
            editKinds: [...result.diff.editKinds],
            changedObjectIds: [...result.diff.changedObjectIds],
          });
          if (history.length > limits.changeHistoryEntries) history.shift();
        }
        return response({
          apiVersion: AGENT_API_VERSION,
          requestId: request.requestId,
          operation: "transact",
          ok: true,
          applied: result.applied,
          revision: result.revision,
          proposedRevision: result.proposedRevision,
          diff: result.diff,
          diagnostics: result.diagnostics,
        });
      }

      if (!options.permissions.render) {
        return errorResponse(
          request.requestId,
          "render",
          "PERMISSION_DENIED",
          "Render permission is not granted",
          document.revision,
        );
      }
      try {
        const rendered = renderArtifact(request, document, options.resolver);
        const bytes = Buffer.from(rendered.svg, "utf8");
        if (bytes.byteLength > limits.maxRenderBytes) {
          return errorResponse(
            request.requestId,
            "render",
            "RENDER_TOO_LARGE",
            `Render artifact exceeds ${limits.maxRenderBytes} bytes`,
            document.revision,
          );
        }
        return response({
          apiVersion: AGENT_API_VERSION,
          requestId: request.requestId,
          operation: "render",
          ok: true,
          revision: document.revision,
          artifact: {
            mediaType: "image/svg+xml",
            encoding: "base64",
            data: bytes.toString("base64"),
            sha256: createHash("sha256").update(bytes).digest("hex"),
            byteLength: bytes.byteLength,
            mode: request.mode,
          },
          diagnostics: rendered.diagnostics,
        });
      } catch (error) {
        return errorResponse(
          request.requestId,
          "render",
          "RENDER_FAILED",
          error instanceof Error ? error.message : String(error),
          document.revision,
        );
      }
    },
  };
}
