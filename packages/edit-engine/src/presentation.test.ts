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
      properties: {},
    }));
    document.annotations.push(
      {
        id: "label-M2",
        kind: "instance-label",
        text: "M2",
        position: { x: 180, y: 145 },
        attachedObjectId: "M2",
        offset: { x: 0, y: 25 },
        alignment: "middle",
        rotation: 0,
        locked: false,
      },
      {
        id: "marker-M2",
        kind: "route-marker",
        markerKind: "voltage",
        text: "V_M2",
        position: { x: 190, y: 145 },
        attachedObjectId: "M2",
        anchor: {
          kind: "object",
          objectId: "M2",
          localOffset: { x: 10, y: 25 },
          fallbackPosition: { x: 190, y: 145 },
        },
        offset: { x: 10, y: 25 },
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
    expect(result.document.annotations[0]!.position.y).toBe(125);
    expect(result.document.annotations[1]).toMatchObject({
      position: { x: 190, y: 125 },
      anchor: { fallbackPosition: { x: 190, y: 125 } },
    });
    expect(result.document.constraints[0]!.id).toBe("matched-y");
  });

  it("does not replace or remove locked semantic annotations", () => {
    const document = createEmptyDocument("doc", "Locked label");
    document.annotations.push({
      id: "marker",
      kind: "route-marker",
      markerKind: "current",
      text: "I_x",
      position: { x: 0, y: 0 },
      anchor: { kind: "free", position: { x: 0, y: 0 } },
      offset: { x: 0, y: 0 },
      alignment: "start",
      rotation: 0,
      locked: true,
    });
    const result = executeTransaction(
      document,
      transaction("doc", [
        { kind: "remove_annotation", annotationId: "marker" },
      ]),
    );
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    expect(result.document.annotations[0]!.text).toBe("I_x");
  });
});
