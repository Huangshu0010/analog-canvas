// Characterization tests for the explicit migration-only v1/v3 boundary and
// the sole hosted v2 production path.
//
// API v3 (ADR 0018) extends this contract additively: it adds the
// `artifact` and `collaborate` operations, Project/catalog/editor-state
// Snapshot targets, a runtime `projectRevision`, the Project edit inventory,
// Agent history, new scopes, and new error codes. These tests document what is
// frozen today so the v3 delta is visible when later work packages land. When v3
// arrives, extend these tests to assert the new surface explicitly; do not relax
// them just to make v3 pass.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "@icm/model";
import type { CircuitProject } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { AgentSessionScopeSchema } from "./envelope.js";
import {
  AGENT_API_V1_VERSION,
  AGENT_API_VERSION,
  AGENT_API_V3_VERSION,
  AGENT_SNAPSHOT_VERSION,
  AGENT_SNAPSHOT_V3_VERSION,
  AgentApiVersionSchema,
  AgentErrorResponseSchema,
  AgentLimitsSchema,
  AgentSessionSnapshotSchema,
} from "./schema.js";
import type { AgentPermissions } from "./schema.js";
import { AGENT_EDIT_KINDS, createAgentCircuitService } from "./service.js";
import { buildAgentSessionSnapshot } from "./snapshot.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);
const allPermissions: AgentPermissions = {
  query: true,
  render: true,
  sourceSpans: false,
  edit: { geometry: true, connectivity: true, presentation: true },
};

function fixtureProject(): CircuitProject {
  return parseProject(
    readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-5-dense-analog/project.icproj.json",
      ),
      "utf8",
    ),
  );
}

function readCapabilities(
  service: ReturnType<typeof createAgentCircuitService>,
  apiVersion: "1.0" | "2.0" | "3.0",
  requestId: string,
) {
  const response = service.handle({
    apiVersion,
    requestId,
    operation: "capabilities",
  });
  if (!response.ok || response.operation !== "capabilities") {
    throw new Error(
      `expected a capabilities response, got: ${JSON.stringify(response)}`,
    );
  }
  return response.capabilities;
}

describe("Agent Circuit API frozen v1/v2 boundary (characterization)", () => {
  it("freezes apiVersion to v1.0, v2.0, and the additive v3.0", () => {
    expect([...AgentApiVersionSchema.options]).toEqual([
      AGENT_API_V1_VERSION,
      AGENT_API_VERSION,
      AGENT_API_V3_VERSION,
    ]);
    expect([
      AGENT_API_V1_VERSION,
      AGENT_API_VERSION,
      AGENT_API_V3_VERSION,
    ]).toEqual(["1.0", "2.0", "3.0"]);
  });

  it("publishes four operations per version and advertises v3 snapshot targets", () => {
    const project = fixtureProject();
    const document = structuredClone(project.documents[0]!);
    const service = createAgentCircuitService({
      agentId: "agent-characterization",
      resolver,
      permissions: allPermissions,
      store: {
        getDocument: () => document,
        commitDocument: () => undefined,
        getProject: () => project,
      },
    });

    const v1 = readCapabilities(service, "1.0", "capabilities-v1");
    const v2 = readCapabilities(service, "2.0", "capabilities-v2");
    const v3 = readCapabilities(service, "3.0", "capabilities-v3");

    expect(v1.operations).toEqual([
      "capabilities",
      "query",
      "transact",
      "render",
    ]);
    expect(v2.operations).toEqual([
      "capabilities",
      "snapshot",
      "transact",
      "render",
    ]);
    expect(v3.operations).toEqual([
      "capabilities",
      "snapshot",
      "transact",
      "render",
    ]);
    expect(v2.apiVersions).toEqual(["2.0"]);
    expect(v2.snapshotVersions).toEqual([AGENT_SNAPSHOT_VERSION]);
    expect(v2).not.toHaveProperty("queryScopes");
    expect(v2.permissions).not.toHaveProperty("query");
    expect(v2.limits).not.toHaveProperty("maxQueryObjects");
    expect(v2.limits).not.toHaveProperty("maxQueryBytes");
    expect(v1.apiVersions).toEqual(["1.0", "2.0", "3.0"]);
    expect(v3.snapshotVersions).toEqual([
      AGENT_SNAPSHOT_VERSION,
      AGENT_SNAPSHOT_V3_VERSION,
    ]);
    expect([...v2.editKinds]).toEqual([...AGENT_EDIT_KINDS]);
  });

  it("exposes Document-level edits plus wire, but not undo/redo or Project/catalog ops", () => {
    // Existing Document-level kinds that remain exposed today.
    expect(AGENT_EDIT_KINDS).toContain("add_instance");
    expect(AGENT_EDIT_KINDS).toContain("set_cell_netlist_interface");
    expect(AGENT_EDIT_KINDS).toContain("wire");

    // Agent undo/redo are rejected edit kinds, not exposed operations.
    expect(AGENT_EDIT_KINDS).not.toContain("undo");
    expect(AGENT_EDIT_KINDS).not.toContain("redo");

    // Project-structural and semantic ops added only by v3 (ADR 0018 / AP2-AP3)
    // are absent from the current edit inventory.
    for (const kind of [
      "rename_project",
      "create_document",
      "remove_document",
      "rename_document",
      "set_top_document",
      "set_instance_cell_binding",
      "duplicate_subgraph",
    ]) {
      expect(AGENT_EDIT_KINDS).not.toContain(kind);
    }
  });

  it("rejects Agent undo/redo transact edits as UNSUPPORTED_EDIT", () => {
    const project = fixtureProject();
    const document = structuredClone(project.documents[0]!);
    const service = createAgentCircuitService({
      agentId: "agent-characterization",
      resolver,
      permissions: allPermissions,
      store: {
        getDocument: () => document,
        commitDocument: () => undefined,
        getProject: () => project,
      },
    });

    for (const kind of ["undo", "redo"] as const) {
      const response = service.handle({
        apiVersion: "2.0",
        requestId: `reject-${kind}`,
        operation: "transact",
        documentId: document.id,
        transactionId: `tx-${kind}`,
        expectedRevision: document.revision,
        edits: [{ kind }],
      });
      expect(response.ok).toBe(false);
      if (response.ok) continue;
      expect(response.error.code).toBe("UNSUPPORTED_EDIT");
    }
  });

  it("keeps the Snapshot Document-scoped with no runtime projectRevision", () => {
    expect(Object.keys(AgentSessionSnapshotSchema.shape)).toEqual([
      "snapshotVersion",
      "electricalTopologyHash",
      "byteLength",
      "project",
      "document",
    ]);

    const project = fixtureProject();
    const document = project.documents[0]!;
    const snapshot = buildAgentSessionSnapshot({ project, document, resolver });

    expect(snapshot.snapshotVersion).toBe(AGENT_SNAPSHOT_VERSION);
    expect(snapshot).not.toHaveProperty("projectRevision");
    expect(snapshot.project).not.toHaveProperty("projectRevision");
  });

  it("freezes circuit, semantic, and separately-scoped File Resource permissions", () => {
    expect([...AgentSessionScopeSchema.options]).toEqual([
      "circuit.snapshot",
      "circuit.render",
      "circuit.source-spans",
      "circuit.edit.geometry",
      "circuit.edit.connectivity",
      "circuit.edit.presentation",
      "editor.semantic-control",
      "project.download",
      "project.import",
      "visual.download",
    ]);
  });

  it("freezes the capabilities limits set and the error envelope shape", () => {
    expect(Object.keys(AgentLimitsSchema.shape)).toEqual([
      "maxQueryObjects",
      "maxQueryBytes",
      "maxSnapshotBytes",
      "maxTransactionEdits",
      "maxRenderBytes",
      "maxRequestBytes",
      "changeHistoryEntries",
    ]);

    const errorOperation = AgentErrorResponseSchema.shape
      .operation as unknown as {
      options: readonly string[];
    };
    expect([...errorOperation.options]).toEqual([
      "error",
      "query",
      "snapshot",
      "transact",
      "render",
    ]);
    for (const key of ["ok", "error", "diagnostics"]) {
      expect(AgentErrorResponseSchema.shape).toHaveProperty(key);
    }
  });
});
