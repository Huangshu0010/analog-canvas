import { describe, expect, it } from "vitest";

import { createAgentCircuitService } from "@icm/agent-adapter";
import type { AgentPermissions } from "@icm/agent-adapter";
import { sha256Hex } from "@icm/derived";
import { createEmptyProject } from "@icm/model";
import { renderDocumentSvg } from "@icm/render-svg";

import { EditorDocumentController } from "../document/document-controller";
import { BrowserAgentHost } from "./browser-agent-host";

const allPermissions: AgentPermissions = {
  query: true,
  render: true,
  sourceSpans: false,
  edit: { geometry: true, connectivity: true, presentation: true },
};

function instance(id: string) {
  return {
    id,
    symbolId: "resistor",
    placement: null,
    properties: {},
  };
}

function setup() {
  const project = createEmptyProject("agent-session", "Agent Session");
  const controller = new EditorDocumentController(project);
  let committed = 0;
  const host = new BrowserAgentHost(controller, () => {
    committed += 1;
  });
  const service = createAgentCircuitService({
    agentId: "codex",
    host,
    permissions: allPermissions,
  });
  return { controller, host, service, committed: () => committed };
}

// WP-WA3: the complete capabilities/snapshot/transact/render feature runs
// against the live EditorDocumentController inside one process, with no network,
// token, or Worker. Agent commits enter the same history as human edits.

describe("BrowserAgentHost + Agent Circuit service", () => {
  it("runs capabilities/snapshot/transact/render against the live document", () => {
    const { controller, service, committed } = setup();
    const documentId = controller.activeDocumentId;

    const capabilities = service.handle({
      apiVersion: "2.0",
      requestId: "r-cap",
      operation: "capabilities",
    });
    expect(capabilities.ok).toBe(true);

    const snapshotBefore = service.handle({
      apiVersion: "2.0",
      requestId: "r-snap",
      operation: "snapshot",
      documentId,
    });
    expect(snapshotBefore.ok).toBe(true);

    const transact = service.handle({
      apiVersion: "2.0",
      requestId: "r-tx",
      operation: "transact",
      documentId,
      transactionId: "tx-1",
      expectedRevision: 0,
      edits: [{ kind: "add_instance", instance: instance("R1") }],
    });
    expect(transact.ok).toBe(true);

    // The Agent commit is visible in the live controller state and history.
    expect(controller.document.instances).toContainEqual(instance("R1"));
    expect(controller.document.revision).toBe(1);
    expect(controller.canUndo).toBe(true);
    expect(committed()).toBe(1);

    const render = service.handle({
      apiVersion: "2.0",
      requestId: "r-render",
      operation: "render",
      documentId,
      mode: "formal",
    });
    expect(render.ok).toBe(true);
  });

  it("treats one Agent transaction as one undo item", () => {
    const { controller, service } = setup();
    const documentId = controller.activeDocumentId;

    service.handle({
      apiVersion: "2.0",
      requestId: "r-tx",
      operation: "transact",
      documentId,
      transactionId: "tx-1",
      expectedRevision: 0,
      edits: [{ kind: "add_instance", instance: instance("Ragent") }],
    });

    // A single human undo restores the pre-Agent state through the shared history.
    controller.transact([{ kind: "undo" }]);
    expect(controller.document.instances).not.toContainEqual(
      instance("Ragent"),
    );
    expect(controller.canUndo).toBe(false);
  });

  it("produces a formal render hash identical to the direct renderer", () => {
    const { controller, service } = setup();
    const documentId = controller.activeDocumentId;

    const render = service.handle({
      apiVersion: "2.0",
      requestId: "r-render",
      operation: "render",
      documentId,
      mode: "formal",
    });
    expect(render.ok).toBe(true);
    if (!(render.ok && render.operation === "render")) return;

    const directSvg = renderDocumentSvg(
      controller.document,
      controller.resolver,
    );
    expect(render.artifact.sha256).toBe(sha256Hex(directSvg));
  });

  it("rejects a stale revision and reports the current revision", () => {
    const { controller, service } = setup();
    const documentId = controller.activeDocumentId;

    service.handle({
      apiVersion: "2.0",
      requestId: "r-tx1",
      operation: "transact",
      documentId,
      transactionId: "tx-1",
      expectedRevision: 0,
      edits: [{ kind: "add_instance", instance: instance("R1") }],
    });

    const stale = service.handle({
      apiVersion: "2.0",
      requestId: "r-tx2",
      operation: "transact",
      documentId,
      transactionId: "tx-2",
      expectedRevision: 0, // behind the current revision 1
      edits: [{ kind: "add_instance", instance: instance("R2") }],
    });

    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.error.code).toBe("STALE_REVISION");
      expect(stale.revision).toBe(1);
    }
    expect(controller.document.instances).not.toContainEqual(instance("R2"));
  });

  it("reflects a replaced Project so the old document is no longer reachable", () => {
    const { controller, host } = setup();
    const oldDocumentId = controller.activeDocumentId;

    const replacement = createEmptyProject(
      "replacement",
      "Replacement",
      "document-replacement",
    );
    controller.replaceProject(replacement);

    expect(host.getProject().id).toBe("replacement");
    expect(host.getDocument(oldDocumentId)).toBeNull();
    expect(host.getDocument(replacement.topDocumentId)).not.toBeNull();
  });

  it("returns DOCUMENT_NOT_FOUND for an unknown document over the host", () => {
    const { service } = setup();

    const result = service.handle({
      apiVersion: "2.0",
      requestId: "r-snap",
      operation: "snapshot",
      documentId: "does-not-exist",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOCUMENT_NOT_FOUND");
    }
  });
});
