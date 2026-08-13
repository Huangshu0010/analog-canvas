import { describe, expect, it } from "vitest";

import { createEmptyProject } from "@icm/model";
import type { SchematicDocument } from "@icm/model";

import { EditorDocumentController } from "./document-controller";

function instance(id: string) {
  return {
    id,
    symbolId: "resistor",
    placement: null,
    properties: {},
  };
}

function hierarchicalProject() {
  const project = createEmptyProject("controller", "Controller");
  const top = project.documents[0]!;
  const child: SchematicDocument = {
    ...structuredClone(top),
    id: "document-child",
    name: "child",
    netlist: { name: "child", portOrder: [] },
  };
  project.documents.push(child);
  return project;
}

describe("EditorDocumentController", () => {
  it("owns a validated clone rather than mutating the caller's Project", () => {
    const source = hierarchicalProject();
    const controller = new EditorDocumentController(source);

    expect(controller.project).not.toBe(source);
    expect(controller.document.id).toBe(source.topDocumentId);
    expect(controller.activeDocumentId).toBe(source.topDocumentId);
  });

  it("commits through DocumentHistory and replaces exactly the active document", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    const childBefore = controller.project.documents.find(
      (document) => document.id === "document-child",
    );
    const result = controller.transact([
      { kind: "add_instance", instance: instance("Rtop") },
    ]);

    expect(result.ok && result.applied).toBe(true);
    expect(controller.document.instances).toContainEqual(instance("Rtop"));
    expect(
      controller.project.documents.find(
        (document) => document.id === "document-child",
      ),
    ).toEqual(childBefore);
    expect(controller.transactionsIssued).toBe(1);
    expect(controller.canUndo).toBe(true);
  });

  it("preserves independent undo histories while switching documents", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    controller.transact([{ kind: "add_instance", instance: instance("Rtop") }]);
    expect(controller.openDocument("document-child")?.name).toBe("child");
    controller.transact([
      { kind: "add_instance", instance: instance("Rchild") },
    ]);

    controller.openDocument(controller.project.topDocumentId);
    expect(controller.canUndo).toBe(true);
    controller.transact([{ kind: "undo" }]);
    expect(controller.document.instances).toEqual([]);

    controller.openDocument("document-child");
    expect(controller.document.instances).toContainEqual(instance("Rchild"));
    expect(controller.canUndo).toBe(true);
  });

  it("rejects missing documents without changing the active history", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    const activeId = controller.activeDocumentId;

    expect(controller.openDocument("missing")).toBeNull();
    expect(controller.activeDocumentId).toBe(activeId);
  });

  it("resets active document and all histories on Project replacement", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    const originalSessionId = controller.projectSessionId;
    controller.transact([{ kind: "add_instance", instance: instance("Rold") }]);
    const replacement = createEmptyProject("replacement", "Replacement");
    replacement.topDocumentId = replacement.documents[0]!.id;

    const document = controller.replaceProject(replacement);

    expect(document.id).toBe(replacement.topDocumentId);
    expect(controller.project.id).toBe("replacement");
    expect(controller.projectSessionId).toMatch(/^replacement:\d+$/u);
    expect(controller.projectSessionId).not.toBe(originalSessionId);
    expect(controller.canUndo).toBe(false);
    expect(controller.canRedo).toBe(false);
  });

  it("dispatches an Agent transaction as one undo item and refreshes state", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    const resolverBefore = controller.resolver;
    const revisionBefore = controller.document.revision;

    const result = controller.dispatchTransaction({
      transactionId: "agent-1",
      documentId: controller.activeDocumentId,
      expectedRevision: revisionBefore,
      actor: { kind: "agent", id: "codex" },
      edits: [{ kind: "add_instance", instance: instance("Ragent") }],
    });

    expect(result.ok && result.applied).toBe(true);
    expect(controller.document.instances).toContainEqual(instance("Ragent"));
    expect(controller.document.revision).toBe(revisionBefore + 1);
    expect(controller.canUndo).toBe(true);
    // A commit refreshes the resolver (new reference) like a human commit.
    expect(controller.resolver).not.toBe(resolverBefore);

    // One Agent transaction is one undo item: a single undo restores the
    // pre-Agent state through the shared history.
    controller.transact([{ kind: "undo" }]);
    expect(controller.document.instances).not.toContainEqual(
      instance("Ragent"),
    );
  });

  it("accepts a human transaction via dispatch identical to transact", () => {
    const controller = new EditorDocumentController(hierarchicalProject());

    const result = controller.dispatchTransaction({
      transactionId: "human-1",
      documentId: controller.activeDocumentId,
      expectedRevision: controller.document.revision,
      actor: { kind: "human", id: "human-local" },
      edits: [{ kind: "add_instance", instance: instance("Rh") }],
    });

    expect(result.ok && result.applied).toBe(true);
    expect(controller.document.instances).toContainEqual(instance("Rh"));
  });

  it("leaves history, Project, and resolver unchanged on a dry-run dispatch", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    const revisionBefore = controller.document.revision;
    const resolverBefore = controller.resolver;

    const result = controller.dispatchTransaction({
      transactionId: "agent-dry",
      documentId: controller.activeDocumentId,
      expectedRevision: revisionBefore,
      actor: { kind: "agent", id: "codex" },
      dryRun: true,
      edits: [{ kind: "add_instance", instance: instance("Rdry") }],
    });

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(controller.document.revision).toBe(revisionBefore);
    expect(controller.document.instances).not.toContainEqual(instance("Rdry"));
    expect(controller.canUndo).toBe(false);
    expect(controller.resolver).toBe(resolverBefore);
  });

  it("rejects a stale revision and reports the current revision", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    controller.transact([{ kind: "add_instance", instance: instance("R1") }]);
    const current = controller.document.revision;

    const result = controller.dispatchTransaction({
      transactionId: "agent-stale",
      documentId: controller.activeDocumentId,
      expectedRevision: current - 1,
      actor: { kind: "agent", id: "codex" },
      edits: [{ kind: "add_instance", instance: instance("Rstale") }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_REVISION");
      expect(result.revision).toBe(current);
    }
  });

  it("dispatches to a non-active Document without retargeting the active one", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    const activeId = controller.activeDocumentId;

    const result = controller.dispatchTransaction({
      transactionId: "agent-child",
      documentId: "document-child",
      expectedRevision: controller.project.documents.find(
        (d) => d.id === "document-child",
      )!.revision,
      actor: { kind: "agent", id: "codex" },
      edits: [{ kind: "add_instance", instance: instance("Rchild") }],
    });

    expect(result.ok && result.applied).toBe(true);
    expect(controller.activeDocumentId).toBe(activeId);
    // The active Document is untouched; only the child Document changed.
    expect(controller.document.instances).toEqual([]);
    expect(
      controller.project.documents.find((d) => d.id === "document-child")!
        .instances,
    ).toContainEqual(instance("Rchild"));
  });

  it("returns a typed rejection when the dispatched Document is absent", () => {
    const controller = new EditorDocumentController(hierarchicalProject());
    const revisionBefore = controller.document.revision;

    const result = controller.dispatchTransaction({
      transactionId: "agent-missing",
      documentId: "does-not-exist",
      expectedRevision: revisionBefore,
      actor: { kind: "agent", id: "codex" },
      edits: [{ kind: "add_instance", instance: instance("Rmissing") }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("OBJECT_NOT_FOUND");
    }
    expect(controller.document.revision).toBe(revisionBefore);
  });
});
