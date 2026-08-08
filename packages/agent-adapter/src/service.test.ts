import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { executeTransaction } from "@icm/edit-engine";
import { createEmptyDocument, parseProject } from "@icm/model";
import type { CircuitProject, SchematicDocument } from "@icm/model";
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

function fixtureDocument(): SchematicDocument {
  return structuredClone(fixtureProject().documents[0]!);
}

function serviceFixture(
  permissions: AgentPermissions = allPermissions,
  limits: Parameters<typeof createAgentCircuitService>[0]["limits"] = {},
) {
  const project = fixtureProject();
  let document = structuredClone(project.documents[0]!);
  const service = createAgentCircuitService({
    agentId: "agent-test",
    resolver,
    permissions,
    limits,
    store: {
      getDocument: () => document,
      commitDocument: (next) => {
        document = next;
        project.documents = project.documents.map((candidate) =>
          candidate.id === next.id ? next : candidate,
        );
      },
      getProject: () => project,
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
        editKinds: expect.arrayContaining([
          "add_instance",
          "connect_endpoints",
          "merge_nets",
          "move_junction",
          "route_orthogonal",
          "set_net_name",
          "disconnect_endpoint",
        ]),
      },
    });
    expect(AgentCircuitResponseSchema.parse(response)).toEqual(response);
    for (const name of [
      "capabilities",
      "query-region",
      "snapshot",
      "align",
      "render",
    ]) {
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
      "agentCircuitV1Operation",
    );
    expect(agentCircuitOpenApi.paths["/v2/circuit"].post.operationId).toBe(
      "agentCircuitV2Operation",
    );
  });

  it("publishes the flat v2 Snapshot workflow and returns complete facts", () => {
    const fixture = serviceFixture();
    expect(
      fixture.service.handle({
        apiVersion: "2.0",
        requestId: "capabilities-v2",
        operation: "capabilities",
      }),
    ).toMatchObject({
      apiVersion: "2.0",
      ok: true,
      capabilities: {
        operations: ["capabilities", "snapshot", "transact", "render"],
        snapshotVersions: ["1.0"],
        permissions: { snapshot: true },
      },
    });

    const response = fixture.service.handle({
      apiVersion: "2.0",
      requestId: "snapshot-v2",
      operation: "snapshot",
      documentId: "document-differential-stage",
    });
    expect(response).toMatchObject({
      apiVersion: "2.0",
      operation: "snapshot",
      ok: true,
      revision: 0,
      snapshot: {
        snapshotVersion: "1.0",
        document: {
          id: "document-differential-stage",
          instances: expect.any(Array),
          nets: expect.any(Array),
          routes: expect.any(Array),
          diagnostics: expect.any(Array),
        },
      },
    });
    if (!response.ok || response.operation !== "snapshot") return;
    expect(
      response.snapshot.document.instances.find((item) => item.id === "M1")
        ?.pins,
    ).toContainEqual(expect.objectContaining({ name: "G", netId: "net-vinp" }));
    expect(response.snapshot.document.nets).toContainEqual(
      expect.objectContaining({
        id: "net-vinp",
        terminals: expect.arrayContaining([{ instanceId: "M1", pinName: "G" }]),
      }),
    );
  });

  it("rejects Snapshots above the server-owned byte limit", () => {
    const fixture = serviceFixture(allPermissions, { maxSnapshotBytes: 10 });
    expect(
      fixture.service.handle({
        apiVersion: "2.0",
        requestId: "snapshot-too-large",
        operation: "snapshot",
        documentId: "document-differential-stage",
      }),
    ).toMatchObject({
      apiVersion: "2.0",
      ok: false,
      operation: "snapshot",
      error: { code: "SNAPSHOT_TOO_LARGE" },
    });
  });

  it("keeps Phase 8 instance authoring identical to direct Edit Engine execution", () => {
    const fixture = serviceFixture();
    const request = {
      apiVersion: "1.0" as const,
      requestId: "add-instance-request",
      operation: "transact" as const,
      documentId: "document-differential-stage",
      transactionId: "add-R-new",
      expectedRevision: 0,
      edits: [
        {
          kind: "add_instance" as const,
          instance: {
            id: "R-new",
            symbolId: "resistor",
            placement: {
              position: { x: 420, y: 300 },
              rotation: 0 as const,
              mirror: "none" as const,
            },
            properties: {},
          },
        },
      ],
    };
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

    expect(fixture.service.handle(request)).toMatchObject({
      ok: true,
      applied: true,
      revision: 1,
    });
    expect(direct.ok).toBe(true);
    expect(fixture.getDocument()).toEqual(direct.document);
    expect(fixture.getDocument().sourceStatus).toBe("connectivity-modified");
  });

  it("keeps symbol remapping and port placement identical to direct Edit Engine execution", () => {
    let document = createEmptyDocument("document-parity", "Parity");
    document.instances.push({
      id: "X1",
      symbolId: "generic-block-4",
      placement: null,
      properties: {
        "spice.target": "model:sky130_fd_pr__nfet_01v8",
        "spice.pin.P1": "P1",
      },
    });
    document.ports.push({
      id: "port-in",
      name: "IN",
      direction: "input",
      position: null,
    });
    document.nets.push({
      id: "net-in",
      scope: "local",
      terminals: [{ instanceId: "X1", pinName: "P1" }],
      ports: ["port-in"],
    });
    const service = createAgentCircuitService({
      agentId: "agent-parity",
      resolver,
      permissions: allPermissions,
      store: {
        getDocument: () => document,
        commitDocument: (next) => {
          document = next;
        },
      },
    });
    const edits = [
      {
        kind: "set_instance_symbol" as const,
        instanceId: "X1",
        symbolId: "nmos",
        pinMap: { P1: "D" },
      },
      {
        kind: "place_port" as const,
        portId: "port-in",
        position: { x: 40, y: 100 },
      },
    ];
    const direct = executeTransaction(
      structuredClone(document),
      {
        transactionId: "parity-direct",
        documentId: document.id,
        expectedRevision: 0,
        actor: { kind: "agent", id: "agent-parity" },
        edits,
      },
      { symbolResolver: resolver },
    );
    const response = service.handle({
      apiVersion: "2.0",
      requestId: "parity-agent",
      operation: "transact",
      documentId: document.id,
      transactionId: "parity-agent",
      expectedRevision: 0,
      edits,
    });
    expect(response).toMatchObject({ ok: true, revision: 1 });
    expect(direct.ok).toBe(true);
    expect(document).toEqual(direct.document);
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
        apiVersion: "2.0",
        requestId: "snapshot-source-denied",
        operation: "snapshot",
        documentId: "document-differential-stage",
        includeSourceSpans: true,
      }),
    ).toMatchObject({
      apiVersion: "2.0",
      ok: false,
      operation: "snapshot",
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

  it("allows Snapshot permission to be denied independently", () => {
    const fixture = serviceFixture({
      ...allPermissions,
      snapshot: false,
    });
    expect(
      fixture.service.handle({
        apiVersion: "2.0",
        requestId: "snapshot-denied",
        operation: "snapshot",
        documentId: "document-differential-stage",
      }),
    ).toMatchObject({
      ok: false,
      operation: "snapshot",
      error: { code: "PERMISSION_DENIED" },
    });
  });

  it("matches direct Edit Engine semantics for dry-run, apply, changes, and stale revisions", () => {
    const fixture = serviceFixture();
    for (const item of [
      ...fixture.getDocument().layoutGroups,
      ...fixture.getDocument().constraints,
    ]) {
      item.locked = false;
    }
    const targetPosition = { x: 190, y: 210 };
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
          position: targetPosition,
        },
        {
          kind: "set_route_points" as const,
          routeId: "route-vss-left",
          netId: "net-vss",
          from: { kind: "terminal" as const, instanceId: "M1", pinName: "S" },
          to: { kind: "junction" as const, junctionId: "junction-vss" },
          waypoints: [],
          segmentModes: ["trunk" as const],
        },
        {
          kind: "set_route_points" as const,
          routeId: "route-vinp",
          netId: "net-vinp",
          from: { kind: "port" as const, portId: "port-vinp" },
          to: { kind: "terminal" as const, instanceId: "M1", pinName: "G" },
          waypoints: [{ x: 80, y: 210 }],
          segmentModes: ["manual" as const, "manual" as const],
        },
        {
          kind: "set_route_points" as const,
          routeId: "route-outp-bottom",
          netId: "net-voutp",
          from: { kind: "junction" as const, junctionId: "junction-outp" },
          to: { kind: "terminal" as const, instanceId: "M1", pinName: "D" },
          waypoints: [{ x: 160, y: 190 }],
          segmentModes: ["manual" as const, "manual" as const],
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

  it("localizes a transact rejection to the failing edit with a path and objectIds", () => {
    const fixture = serviceFixture();
    for (const item of [
      ...fixture.getDocument().layoutGroups,
      ...fixture.getDocument().constraints,
    ]) {
      item.locked = false;
    }
    // Two edits: the first is a valid annotation; the second targets an
    // instance that does not exist, so it must reject at edits index 1.
    const response = fixture.service.handle({
      apiVersion: "2.0",
      requestId: "reject-index",
      operation: "transact",
      documentId: "document-differential-stage",
      transactionId: "reject-index",
      expectedRevision: 0,
      edits: [
        {
          kind: "upsert_schematic_annotation",
          annotation: {
            id: "note-test",
            kind: "route-marker",
            markerKind: "current",
            text: "I_x",
            position: { x: 100, y: 100 },
            anchor: {
              kind: "free",
              position: { x: 100, y: 100 },
            },
            offset: { x: 0, y: 0 },
            alignment: "middle",
            rotation: 0,
            locked: false,
          },
        },
        {
          kind: "move_instance",
          instanceId: "instance-does-not-exist",
          position: { x: 200, y: 200 },
        },
      ],
    });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "OBJECT_NOT_FOUND" },
    });
    if (response.ok) return;
    const diagnostic = response.diagnostics[0];
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.path).toEqual(["edits", 1]);
    expect(diagnostic!.objectIds).toContain("instance-does-not-exist");
  });

  it("returns resolvedRoutes with the post-normalization polyline after a set_route_points", () => {
    const fixture = serviceFixture();
    for (const item of [
      ...fixture.getDocument().layoutGroups,
      ...fixture.getDocument().constraints,
    ]) {
      item.locked = false;
    }
    // Move M1 and re-point all three Routes that touch it (the connected
    // Routes must be updated in the same transaction or the move makes them
    // non-orthogonal). The response must expose the post-normalization
    // polyline rather than the raw waypoints the Agent sent.
    const response = fixture.service.handle({
      apiVersion: "2.0",
      requestId: "resolved",
      operation: "transact",
      documentId: "document-differential-stage",
      transactionId: "resolved",
      expectedRevision: 0,
      edits: [
        {
          kind: "move_instance",
          instanceId: "M1",
          position: { x: 190, y: 210 },
        },
        {
          kind: "set_route_points",
          routeId: "route-vss-left",
          netId: "net-vss",
          from: { kind: "terminal", instanceId: "M1", pinName: "S" },
          to: { kind: "junction", junctionId: "junction-vss" },
          waypoints: [],
          segmentModes: ["trunk"],
        },
        {
          kind: "set_route_points",
          routeId: "route-vinp",
          netId: "net-vinp",
          from: { kind: "port", portId: "port-vinp" },
          to: { kind: "terminal", instanceId: "M1", pinName: "G" },
          waypoints: [{ x: 80, y: 210 }],
          segmentModes: ["manual", "manual"],
        },
        {
          kind: "set_route_points",
          routeId: "route-outp-bottom",
          netId: "net-voutp",
          from: { kind: "junction", junctionId: "junction-outp" },
          to: { kind: "terminal", instanceId: "M1", pinName: "D" },
          waypoints: [{ x: 160, y: 190 }],
          segmentModes: ["manual", "manual"],
        },
      ],
    });
    expect(response).toMatchObject({ ok: true, applied: true });
    if (!response.ok || !("resolvedRoutes" in response)) return;
    const resolved = response.resolvedRoutes?.find(
      (entry) => entry.routeId === "route-vinp",
    );
    expect(resolved).toBeDefined();
    expect(resolved!.polyline.length).toBeGreaterThanOrEqual(2);
    // The polyline is orthogonal and its endpoints match the resolved port
    // and terminal, not necessarily the raw waypoint the Agent sent.
    expect(
      resolved!.polyline.every(
        (point, index) =>
          index === 0 ||
          index === resolved!.polyline.length - 1 ||
          point.x === resolved!.polyline[index - 1]!.x ||
          point.y === resolved!.polyline[index - 1]!.y,
      ),
    ).toBe(true);
  });

  it("returns proposed (not original) geometry for resolvedRoutes on dryRun", () => {
    const fixture = serviceFixture();
    for (const item of [
      ...fixture.getDocument().layoutGroups,
      ...fixture.getDocument().constraints,
    ]) {
      item.locked = false;
    }
    // Capture the route-vinp polyline before any edit.
    const before = fixture
      .getDocument()
      .routes.find((route) => route.id === "route-vinp");
    // Move M1 and re-point route-vinp in a DRY-RUN. The store must not change
    // (applied: false), but resolvedRoutes must reflect the proposed geometry.
    const response = fixture.service.handle({
      apiVersion: "2.0",
      requestId: "dryrun-resolved",
      operation: "transact",
      documentId: "document-differential-stage",
      transactionId: "dryrun-resolved",
      expectedRevision: 0,
      dryRun: true,
      edits: [
        {
          kind: "move_instance",
          instanceId: "M1",
          position: { x: 190, y: 210 },
        },
        {
          kind: "set_route_points",
          routeId: "route-vss-left",
          netId: "net-vss",
          from: { kind: "terminal", instanceId: "M1", pinName: "S" },
          to: { kind: "junction", junctionId: "junction-vss" },
          waypoints: [],
          segmentModes: ["trunk"],
        },
        {
          kind: "set_route_points",
          routeId: "route-vinp",
          netId: "net-vinp",
          from: { kind: "port", portId: "port-vinp" },
          to: { kind: "terminal", instanceId: "M1", pinName: "G" },
          waypoints: [{ x: 80, y: 210 }],
          segmentModes: ["manual", "manual"],
        },
        {
          kind: "set_route_points",
          routeId: "route-outp-bottom",
          netId: "net-voutp",
          from: { kind: "junction", junctionId: "junction-outp" },
          to: { kind: "terminal", instanceId: "M1", pinName: "D" },
          waypoints: [{ x: 160, y: 190 }],
          segmentModes: ["manual", "manual"],
        },
      ],
    });
    expect(response).toMatchObject({ ok: true, applied: false });
    expect(fixture.getDocument().revision).toBe(0);
    if (!response.ok || !("resolvedRoutes" in response)) return;
    const resolved = response.resolvedRoutes?.find(
      (entry) => entry.routeId === "route-vinp",
    );
    expect(resolved).toBeDefined();
    // The proposed polyline must differ from the pre-edit polyline: dry-run
    // must report the candidate geometry, not the original Document's.
    const beforePoly = before?.waypoints ?? [];
    const proposedPoly = resolved!.polyline;
    expect(proposedPoly.length).toBeGreaterThanOrEqual(2);
    const changed = JSON.stringify(proposedPoly) !== JSON.stringify(beforePoly);
    expect(changed).toBe(true);
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
