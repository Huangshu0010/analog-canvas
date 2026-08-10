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
    controller.transact([{ kind: "add_instance", instance: instance("Rold") }]);
    const replacement = createEmptyProject("replacement", "Replacement");
    replacement.topDocumentId = replacement.documents[0]!.id;

    const document = controller.replaceProject(replacement);

    expect(document.id).toBe(replacement.topDocumentId);
    expect(controller.project.id).toBe("replacement");
    expect(controller.canUndo).toBe(false);
    expect(controller.canRedo).toBe(false);
  });
});
