import { describe, expect, it, vi } from "vitest";

import { createEmptyProject } from "@icm/model";

import { DocumentHistory } from "@icm/edit-engine";

vi.mock("./editor-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./editor-session")>();
  return {
    ...actual,
    replaceProjectDocument: vi.fn(actual.replaceProjectDocument),
  };
});

import { EditorDocumentController } from "./document-controller";
import { replaceProjectDocument } from "./editor-session";

function instance(id: string) {
  return {
    id,
    symbolId: "resistor",
    placement: null,
  };
}

describe("EditorDocumentController internal-error fence", () => {
  it("converts an engine exception into an INTERNAL_ERROR rejection with an unchanged Project", () => {
    const controller = new EditorDocumentController(
      createEmptyProject("controller", "Controller"),
    );
    const first = controller.transact([
      { kind: "add_instance", instance: instance("R1") },
    ]);
    expect(first.ok && first.applied).toBe(true);
    expect(controller.canUndo).toBe(true);
    const revisionBefore = controller.document.revision;
    const projectBefore = structuredClone(controller.project);

    const transactSpy = vi
      .spyOn(DocumentHistory.prototype, "transact")
      .mockImplementationOnce(() => {
        throw new Error("engine exploded");
      });
    const rejected = controller.transact([
      { kind: "add_instance", instance: instance("R2") },
    ]);
    transactSpy.mockRestore();

    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe("INTERNAL_ERROR");
      expect(rejected.error.message).toContain("engine exploded");
      expect(rejected.revision).toBe(revisionBefore);
    }
    expect(controller.document.revision).toBe(revisionBefore);
    expect(controller.document.instances.map((entry) => entry.id)).toEqual([
      "R1",
    ]);
    expect(controller.canUndo).toBe(false);
    expect(controller.project).toEqual(projectBefore);

    // The histories were rebuilt from the unchanged Project, so the next
    // transaction continues from a consistent revision.
    const next = controller.transact([
      { kind: "add_instance", instance: instance("R2") },
    ]);
    expect(next.ok && next.applied).toBe(true);
    expect(controller.document.revision).toBe(revisionBefore + 1);
    expect(controller.document.instances.map((entry) => entry.id)).toEqual([
      "R1",
      "R2",
    ]);
  });

  it("converts a post-commit re-validation failure into an INTERNAL_ERROR rejection", () => {
    const controller = new EditorDocumentController(
      createEmptyProject("controller", "Controller"),
    );
    const revisionBefore = controller.document.revision;

    const replaceMock = vi.mocked(replaceProjectDocument);
    replaceMock.mockImplementationOnce(() => {
      throw new Error("schema validation failed");
    });
    const rejected = controller.transact([
      { kind: "add_instance", instance: instance("R1") },
    ]);

    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe("INTERNAL_ERROR");
      expect(rejected.error.message).toContain(
        "Committed document could not be re-validated",
      );
    }
    expect(controller.document.revision).toBe(revisionBefore);
    expect(controller.document.instances).toHaveLength(0);

    const next = controller.transact([
      { kind: "add_instance", instance: instance("R1") },
    ]);
    expect(next.ok && next.applied).toBe(true);
    expect(controller.document.revision).toBe(revisionBefore + 1);
  });
});
