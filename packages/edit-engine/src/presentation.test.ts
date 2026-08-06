import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { executeTransaction } from "./transaction.js";

function transaction(documentId: string, edits: unknown[]) {
  return {
    transactionId: "presentation-edit",
    documentId,
    expectedRevision: 0,
    actor: { kind: "human", id: "reviewer" },
    edits,
  };
}

describe("presentation and layout edits", () => {
  it("moves attached labels with an aligned instance atomically", () => {
    const document = createEmptyDocument("doc", "Presentation");
    document.instances = ["M1", "M2"].map((id, index) => ({
      id,
      symbolId: "nmos",
      placement: {
        position: { x: 100 + index * 80, y: 100 + index * 20 },
        rotation: 0 as const,
        mirror: "none" as const,
      },
      properties: {},
    }));
    document.annotations.push({
      id: "label-M2",
      kind: "instance-label",
      text: "M2",
      position: { x: 180, y: 145 },
      attachedObjectId: "M2",
      offset: { x: 0, y: 25 },
      alignment: "middle",
      rotation: 0,
      locked: false,
    });
    const result = executeTransaction(
      document,
      transaction("doc", [
        { kind: "align_instances", instanceIds: ["M1", "M2"], axis: "y" },
        {
          kind: "set_layout_constraint",
          constraint: {
            id: "matched-y",
            kind: "align-y",
            objectIds: ["M1", "M2"],
            locked: false,
          },
        },
      ]),
    );
    expect(result.ok).toBe(true);
    expect(result.document.instances[1]!.placement!.position.y).toBe(100);
    expect(result.document.annotations[0]!.position.y).toBe(125);
    expect(result.document.constraints[0]!.id).toBe("matched-y");
  });

  it("does not replace or remove locked semantic annotations", () => {
    const document = createEmptyDocument("doc", "Locked label");
    document.annotations.push({
      id: "caption",
      kind: "figure-caption",
      text: "Original",
      position: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      alignment: "start",
      rotation: 0,
      locked: true,
    });
    const result = executeTransaction(
      document,
      transaction("doc", [
        { kind: "remove_annotation", annotationId: "caption" },
      ]),
    );
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    expect(result.document.annotations[0]!.text).toBe("Original");
  });
});
