import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { DocumentHistory } from "./history.js";

function historyFixture() {
  const document = createEmptyDocument("document-main", "Main");
  document.instances.push({
    id: "R1",
    symbolId: "resistor",
    placement: null,
    properties: {},
  });
  return new DocumentHistory(document);
}

function transaction(revision: number, edits: unknown[], dryRun = false) {
  return {
    transactionId: `transaction-${revision}-${String((edits[0] as { kind?: string }).kind)}`,
    documentId: "document-main",
    expectedRevision: revision,
    actor: { kind: "human" as const, id: "human-test" },
    dryRun,
    edits,
  };
}

describe("DocumentHistory", () => {
  it("undoes and redoes geometry with monotonically increasing revisions", () => {
    const history = historyFixture();
    const placed = history.transact(
      transaction(0, [
        {
          kind: "place_instance",
          instanceId: "R1",
          placement: {
            position: { x: 50, y: 40 },
            rotation: 0,
            mirror: "none",
          },
        },
      ]),
    );
    expect(placed).toMatchObject({ ok: true, revision: 1 });
    expect(history.canUndo).toBe(true);

    const undone = history.transact(transaction(1, [{ kind: "undo" }]));
    expect(undone).toMatchObject({ ok: true, revision: 2 });
    expect(history.document.instances[0]?.placement).toBeNull();
    expect(history.canRedo).toBe(true);

    const redone = history.transact(transaction(2, [{ kind: "redo" }]));
    expect(redone).toMatchObject({ ok: true, revision: 3 });
    expect(history.document.instances[0]?.placement?.position).toEqual({
      x: 50,
      y: 40,
    });
  });

  it("dry-runs history without consuming a state", () => {
    const history = historyFixture();
    history.transact(
      transaction(0, [
        {
          kind: "place_instance",
          instanceId: "R1",
          placement: {
            position: { x: 50, y: 40 },
            rotation: 0,
            mirror: "none",
          },
        },
      ]),
    );
    expect(
      history.transact(transaction(1, [{ kind: "undo" }], true)),
    ).toMatchObject({
      ok: true,
      applied: false,
      revision: 1,
      proposedRevision: 2,
    });
    expect(history.canUndo).toBe(true);
    expect(history.document.revision).toBe(1);
  });

  it("undoes and redoes a property patch", () => {
    const history = historyFixture();
    const patched = history.transact(
      transaction(0, [
        {
          kind: "patch_instance_properties",
          instanceId: "R1",
          set: { value: "10k" },
        },
      ]),
    );
    expect(patched).toMatchObject({ ok: true, revision: 1 });
    expect(history.document.instances[0]!.properties).toEqual({ value: "10k" });

    expect(history.transact(transaction(1, [{ kind: "undo" }]))).toMatchObject({
      ok: true,
      revision: 2,
    });
    expect(history.document.instances[0]!.properties).toEqual({});

    expect(history.transact(transaction(2, [{ kind: "redo" }]))).toMatchObject({
      ok: true,
      revision: 3,
    });
    expect(history.document.instances[0]!.properties).toEqual({ value: "10k" });
  });

  it("rejects undo when no prior state exists", () => {
    const history = historyFixture();
    const result = history.transact(transaction(0, [{ kind: "undo" }]));
    expect(result).toMatchObject({
      ok: false,
      error: { code: "HISTORY_EMPTY" },
    });
  });
});
