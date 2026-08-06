import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { executeTransaction } from "@icm/edit-engine";
import { parseProject } from "@icm/model";
import type { SchematicDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { agentCircuitOpenApi } from "./openapi.js";
import {
  AgentCircuitRequestJsonSchema,
  AgentCircuitRequestSchema,
  AgentCircuitResponseSchema,
} from "./schema.js";
import type { AgentPermissions } from "./schema.js";
import { createAgentCircuitService } from "./service.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);
const allPermissions: AgentPermissions = {
  query: true,
  render: true,
  sourceSpans: false,
  edit: { geometry: true, connectivity: true, presentation: true },
};

function fixtureDocument(): SchematicDocument {
  const project = parseProject(
    readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-5-dense-analog/project.icproj.json",
      ),
      "utf8",
    ),
  );
  return structuredClone(project.documents[0]!);
}

function serviceFixture(
  permissions: AgentPermissions = allPermissions,
  limits: Parameters<typeof createAgentCircuitService>[0]["limits"] = {},
) {
  let document = fixtureDocument();
  const service = createAgentCircuitService({
    agentId: "agent-test",
    resolver,
    permissions,
    limits,
    store: {
      getDocument: () => document,
      commitDocument: (next) => {
        document = next;
      },
    },
  });
  return { service, getDocument: () => document };
}

describe("Agent Circuit API v1 service", () => {
  it("publishes exactly four operations and validates checked request examples", () => {
    const fixture = serviceFixture();
    const response = fixture.service.handle({
      apiVersion: "1.0",
      requestId: "capabilities-test",
      operation: "capabilities",
    });
    expect(response).toMatchObject({
      ok: true,
      operation: "capabilities",
      capabilities: {
        operations: ["capabilities", "query", "transact", "render"],
      },
    });
    expect(AgentCircuitResponseSchema.parse(response)).toEqual(response);
    for (const name of ["capabilities", "query-region", "align", "render"]) {
      const request = JSON.parse(
        readFileSync(
          resolve(process.cwd(), `fixtures/agent-api/${name}.request.json`),
          "utf8",
        ),
      );
      expect(AgentCircuitRequestSchema.parse(request)).toEqual(request);
    }
    expect(AgentCircuitRequestJsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
    });
    expect(agentCircuitOpenApi.paths["/v1/circuit"].post.operationId).toBe(
      "agentCircuitOperation",
    );
  });

  it("bounds scoped context and never returns a whole persisted Document", () => {
    const fixture = serviceFixture(allPermissions, {
      maxQueryObjects: 2,
      maxQueryBytes: 10_000,
    });
    const response = fixture.service.handle({
      apiVersion: "1.0",
      requestId: "query-net",
      operation: "query",
      documentId: "document-differential-stage",
      scope: { kind: "net", netId: "net-vdd" },
      limit: 50,
    });
    expect(response).toMatchObject({
      ok: true,
      operation: "query",
      revision: 0,
      truncated: true,
    });
    if (!response.ok || response.operation !== "query") return;
    expect(response.objects).toHaveLength(2);
    expect(response.omittedCount).toBeGreaterThan(0);
    expect(JSON.stringify(response)).not.toMatch(
      /"documents"|"sourceStatus"|"presentation"/u,
    );
  });

  it("requires separate source-span and connectivity permissions", () => {
    const permissions: AgentPermissions = {
      ...allPermissions,
      sourceSpans: false,
      edit: { ...allPermissions.edit, connectivity: false },
    };
    const fixture = serviceFixture(permissions);
    expect(
      fixture.service.handle({
        apiVersion: "1.0",
        requestId: "source-denied",
        operation: "query",
        documentId: "document-differential-stage",
        scope: { kind: "objects", objectIds: ["M1"] },
        includeSourceSpans: true,
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "PERMISSION_DENIED" },
    });
    expect(
      fixture.service.handle({
        apiVersion: "1.0",
        requestId: "connectivity-denied",
        operation: "transact",
        documentId: "document-differential-stage",
        transactionId: "denied-junction",
        expectedRevision: 0,
        edits: [
          {
            kind: "add_junction",
            junctionId: "denied",
            netId: "net-vdd",
            position: { x: 0, y: 0 },
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "PERMISSION_DENIED" },
    });
    expect(fixture.getDocument().revision).toBe(0);
  });

  it("matches direct Edit Engine semantics for dry-run, apply, changes, and stale revisions", () => {
    const fixture = serviceFixture();
    const request = {
      apiVersion: "1.0" as const,
      requestId: "move-request",
      operation: "transact" as const,
      documentId: "document-differential-stage",
      transactionId: "move-M1",
      expectedRevision: 0,
      edits: [
        {
          kind: "move_instance" as const,
          instanceId: "M1",
          position: { x: 190, y: 210 },
        },
      ],
    };
    const dryRun = fixture.service.handle({ ...request, dryRun: true });
    expect(dryRun).toMatchObject({
      ok: true,
      applied: false,
      revision: 0,
      proposedRevision: 1,
    });
    expect(fixture.getDocument().revision).toBe(0);

    const direct = executeTransaction(
      fixture.getDocument(),
      {
        transactionId: request.transactionId,
        documentId: request.documentId,
        expectedRevision: 0,
        actor: { kind: "agent", id: "agent-test" },
        edits: request.edits,
      },
      { symbolResolver: resolver },
    );
    const applied = fixture.service.handle(request);
    expect(applied).toMatchObject({ ok: true, applied: true, revision: 1 });
    expect(direct.ok).toBe(true);
    expect(fixture.getDocument()).toEqual(direct.document);

    const changes = fixture.service.handle({
      apiVersion: "1.0",
      requestId: "changes",
      operation: "query",
      documentId: request.documentId,
      scope: { kind: "changes", sinceRevision: 0 },
    });
    expect(changes).toMatchObject({
      ok: true,
      changes: [{ fromRevision: 0, toRevision: 1 }],
    });

    const stale = fixture.service.handle({ ...request, requestId: "stale" });
    expect(stale).toMatchObject({
      ok: false,
      error: { code: "STALE_REVISION" },
      revision: 1,
    });
    expect(fixture.getDocument().revision).toBe(1);
  });

  it("returns bounded formal and diagnostic image artifacts without overlay leakage", () => {
    const fixture = serviceFixture();
    const render = (mode: "formal" | "diagnostics") =>
      fixture.service.handle({
        apiVersion: "1.0",
        requestId: `render-${mode}`,
        operation: "render",
        documentId: "document-differential-stage",
        mode,
      });
    const formal = render("formal");
    const diagnostics = render("diagnostics");
    expect(formal).toMatchObject({ ok: true, operation: "render" });
    expect(diagnostics).toMatchObject({ ok: true, operation: "render" });
    if (
      !formal.ok ||
      formal.operation !== "render" ||
      !diagnostics.ok ||
      diagnostics.operation !== "render"
    )
      return;
    const formalSvg = Buffer.from(formal.artifact.data, "base64").toString(
      "utf8",
    );
    const diagnosticSvg = Buffer.from(
      diagnostics.artifact.data,
      "base64",
    ).toString("utf8");
    expect(formalSvg).toContain('data-layer="formal"');
    expect(formalSvg).not.toMatch(/agent-diagnostics|editor-overlay/u);
    expect(diagnosticSvg).toContain('data-layer="agent-diagnostics"');
    expect(diagnostics.artifact.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });
});
