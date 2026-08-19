import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { DocumentHistory } from "./history.js";
import { executeTransaction } from "./transaction.js";

function transaction(
  documentId: string,
  edits: unknown[],
  expectedRevision = 0,
) {
  return {
    transactionId: "presentation-edit",
    documentId,
    expectedRevision,
    actor: { kind: "human", id: "reviewer" },
    edits,
  };
}

describe("presentation and layout edits", () => {
  it("changes the persisted style through undoable document history", () => {
    const document = createEmptyDocument("doc", "Presentation");
    document.presentation.styleProfileId = "textbook-monochrome-v1";
    const history = new DocumentHistory(document);

    const applied = history.transact(
      transaction("doc", [
        {
          kind: "set_presentation_style",
          styleProfileId: "razavi-textbook-v1",
        },
      ]),
    );
    expect(applied).toMatchObject({ ok: true, applied: true });
    expect(history.document.presentation.styleProfileId).toBe(
      "razavi-textbook-v1",
    );

    const undone = history.transact(transaction("doc", [{ kind: "undo" }], 1));
    expect(undone).toMatchObject({ ok: true, applied: true });
    expect(history.document.presentation.styleProfileId).toBe(
      "textbook-monochrome-v1",
    );
  });

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
    }));
    document.annotations.push(
      {
        id: "label-M2",
        kind: "instance-label",
        content: { runs: [{ kind: "text", value: "M2" }] },
        anchor: {
          kind: "object",
          objectId: "M2",
          localOffset: { x: 0, y: 20 },
          fallbackPosition: { x: 180, y: 140 },
        },
        alignment: "middle",
        rotation: 0,
        locked: false,
      },
      {
        id: "marker-M2",
        kind: "route-marker",
        markerKind: "voltage",
        content: { runs: [{ kind: "text", value: "V_M2" }] },
        anchor: {
          kind: "object",
          objectId: "M2",
          localOffset: { x: 10, y: 20 },
          fallbackPosition: { x: 190, y: 140 },
        },
        alignment: "middle",
        rotation: 0,
        locked: false,
      },
    );
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
    expect(result.document.annotations[0]!.anchor).toMatchObject({
      fallbackPosition: { x: 180, y: 120 },
    });
    expect(result.document.annotations[1]).toMatchObject({
      anchor: { fallbackPosition: { x: 190, y: 120 } },
    });
    expect(result.document.constraints[0]!.id).toBe("matched-y");
  });

  it("does not replace or remove locked semantic annotations", () => {
    const document = createEmptyDocument("doc", "Locked label");
    document.annotations.push({
      id: "marker",
      kind: "route-marker",
      markerKind: "current",
      content: { runs: [{ kind: "text", value: "I_x" }] },
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      alignment: "start",
      rotation: 0,
      locked: true,
    });
    const result = executeTransaction(
      document,
      transaction("doc", [
        { kind: "remove_schematic_annotation", annotationId: "marker" },
      ]),
    );
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    expect(result.document.annotations[0]!.content).toEqual({
      runs: [{ kind: "text", value: "I_x" }],
    });
  });

  it("does not remove a semantic annotation referenced by layout intent", () => {
    const document = createEmptyDocument("doc", "Referenced label");
    document.annotations.push({
      id: "label",
      kind: "net-label",
      content: { runs: [{ kind: "text", value: "OUT" }] },
      netId: "net-out",
      anchor: { kind: "free", position: { x: 20, y: 20 } },
      alignment: "start",
      rotation: 0,
      locked: false,
    });
    document.layoutGroups.push({
      id: "reviewed-labels",
      kind: "custom",
      objectIds: ["label"],
      locked: true,
    });

    const result = executeTransaction(
      document,
      transaction("doc", [
        { kind: "remove_schematic_annotation", annotationId: "label" },
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      applied: false,
      error: {
        code: "EDIT_PRECONDITION",
        message: "Annotation is referenced by layout intent: label",
      },
    });
    expect(result.document.annotations).toHaveLength(1);
  });
});
