import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { executeTransaction } from "@icm/edit-engine";
import { parseProject, serializeProject } from "@icm/model";
import { renderDocumentSvg } from "@icm/render-svg";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { createAgentCircuitService } from "./service.js";
import type { AgentPermissions } from "./schema.js";

const resolver = new InMemorySymbolResolver(builtInSymbols);
const allPermissions: AgentPermissions = {
  query: true,
  render: true,
  sourceSpans: false,
  edit: { geometry: true, connectivity: true, presentation: true },
};

function fixtureProject() {
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

// The same typed drafting edits submitted through the Agent service and the
// shared Edit Engine must produce the identical Document and identical SVG.
// This proves typed-edit semantic parity; it does not exercise the GUI
// The Edit Engine is the shared execution boundary for browser and Agent edits.
const draftingEdits = [
  {
    kind: "upsert_schematic_annotation",
    annotation: {
      id: "marker-parity",
      kind: "route-marker",
      markerKind: "current",
      text: "I_x",
      position: { x: 200, y: 120 },
      anchor: {
        kind: "route",
        routeId: "route-bias-right",
        segmentIndex: 0,
        t: 0.5,
        normalOffset: -14,
        direction: "forward",
        orientation: "follow",
        fallbackPosition: { x: 200, y: 120 },
      },
      offset: { x: 0, y: 0 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    },
  },
  {
    kind: "upsert_drafting_object",
    object: {
      id: "note-parity",
      kind: "text",
      locked: false,
      zIndex: 0,
      anchor: { kind: "free", position: { x: 150, y: 300 } },
      content: {
        runs: [
          { kind: "text", value: "V" },
          {
            kind: "span",
            style: "subscript",
            children: [{ kind: "text", value: "in" }],
          },
        ],
      },
      alignment: "start",
      rotation: 0,
    },
  },
  {
    kind: "set_guide",
    guide: {
      id: "guide-parity",
      axis: "vertical",
      coordinate: 250,
      locked: false,
      visible: true,
    },
  },
] as const;

describe("Agent/Edit Engine drafting parity", () => {
  it("produces the same Document and SVG through the Agent service and the shared Edit Engine", () => {
    // Agent path: typed edits through the service.
    const project = fixtureProject();
    let document = structuredClone(project.documents[0]!);
    const service = createAgentCircuitService({
      agentId: "agent-parity",
      resolver,
      permissions: allPermissions,
      limits: {},
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
    const agentResponse = service.handle({
      apiVersion: "2.0",
      requestId: "parity-transact",
      operation: "transact",
      documentId: "document-differential-stage",
      transactionId: "parity-transact",
      expectedRevision: 0,
      edits: [...draftingEdits],
    });
    expect(agentResponse).toMatchObject({ ok: true });

    // GUI path: the same edits through executeTransaction directly.
    const guiProject = fixtureProject();
    const guiDocument = guiProject.documents[0]!;
    const guiResult = executeTransaction(guiDocument, {
      transactionId: "parity-gui",
      documentId: "document-differential-stage",
      expectedRevision: 0,
      actor: { kind: "human", id: "gui" },
      edits: [...draftingEdits],
    });
    expect(guiResult.ok).toBe(true);

    // The committed Documents are identical.
    expect(serializeProject(project)).toBe(
      serializeProject({ ...guiProject, documents: [guiResult.document] }),
    );

    // The rendered SVG is identical.
    const agentSvg = renderDocumentSvg(document, resolver);
    const guiSvg = renderDocumentSvg(guiResult.document, resolver);
    expect(agentSvg).toBe(guiSvg);

    // The drafting content is present and non-electrical.
    expect(agentSvg).toContain('data-kind="draft-text"');
    expect(agentSvg).toContain('data-kind="route-marker"');
  });

  it("keeps electricalTopologyHash unchanged when drafting is added", () => {
    const project = fixtureProject();
    const before = structuredClone(project);
    const result = executeTransaction(before.documents[0]!, {
      transactionId: "parity-hash",
      documentId: "document-differential-stage",
      expectedRevision: 0,
      actor: { kind: "human", id: "gui" },
      edits: [...draftingEdits],
    });
    expect(result.ok).toBe(true);
    before.documents = before.documents.map((candidate) =>
      candidate.id === result.document.id ? result.document : candidate,
    );
    // Serialize both and compare a document-level electrical projection: the
    // drafting edits must not alter electrical identity.
    const hashBefore = electricalHashOf(fixtureProject());
    const hashAfter = electricalHashOf(before);
    expect(hashAfter).toBe(hashBefore);
  });
});

// Minimal electrical projection hash used only by the parity test to assert
// non-electrical identity (drafting/annotations/guides excluded).
function electricalHashOf(project: ReturnType<typeof fixtureProject>): string {
  const electrical = project.documents
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((document) => ({
      id: document.id,
      instances: document.instances
        .map((item) => item.id)
        .sort((a, b) => a.localeCompare(b)),
      nets: document.nets.map((net) => ({
        id: net.id,
        terminals: net.terminals
          .map((terminal) => `${terminal.instanceId}:${terminal.pinName}`)
          .sort(),
      })),
    }));
  return JSON.stringify(electrical);
}
