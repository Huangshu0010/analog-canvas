import { createEmptyDocument } from "@icm/model";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { executeTransaction } from "./transaction.js";

function transaction(documentId: string, edits: unknown[], expectedRevision = 0) {
  return {
    transactionId: "drafting-edit",
    documentId,
    expectedRevision,
    actor: { kind: "human", id: "reviewer" },
    edits,
  };
}

describe("drafting and guide edits", () => {
  it("upserts a drafting text object into the drafting layer", () => {
    const document = createEmptyDocument("doc", "Drafting");
    const result = executeTransaction(document, transaction("doc", [
      {
        kind: "upsert_drafting_object",
        object: {
          id: "t1",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 50, y: 50 } },
          content: { runs: [{ kind: "text", value: "V_{in}" }] },
          alignment: "start",
          rotation: 0,
        },
      },
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.drafting?.objects).toHaveLength(1);
    expect(result.document.drafting?.objects[0]?.id).toBe("t1");
  });

  it("initializes the drafting layer when absent", () => {
    const document = createEmptyDocument("doc", "Drafting");
    delete document.drafting;
    const result = executeTransaction(document, transaction("doc", [
      {
        kind: "upsert_drafting_object",
        object: {
          id: "t1",
          kind: "text",
          locked: false,
          zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          content: { runs: [{ kind: "text", value: "x" }] },
          alignment: "start",
          rotation: 0,
        },
      },
    ]));
    expect(result.ok).toBe(true);
  });

  it("removes a drafting object", () => {
    const document = createEmptyDocument("doc", "Drafting");
    const created = executeTransaction(document, transaction("doc", [
      {
        kind: "upsert_drafting_object",
        object: {
          id: "t1", kind: "text", locked: false, zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          content: { runs: [{ kind: "text", value: "x" }] }, alignment: "start", rotation: 0,
        },
      },
    ]));
    if (!created.ok) throw new Error("setup failed");
    const removed = executeTransaction(created.document, transaction("doc", [{ kind: "remove_drafting_object", objectId: "t1" }], 1));
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.document.drafting?.objects).toEqual([]);
  });

  it("rejects removing a locked drafting object", () => {
    const document = createEmptyDocument("doc", "Drafting");
    const created = executeTransaction(document, transaction("doc", [
      {
        kind: "upsert_drafting_object",
        object: {
          id: "t1", kind: "text", locked: true, zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          content: { runs: [{ kind: "text", value: "x" }] }, alignment: "start", rotation: 0,
        },
      },
    ]));
    if (!created.ok) throw new Error("setup failed");
    const removed = executeTransaction(created.document, transaction("doc", [{ kind: "remove_drafting_object", objectId: "t1" }], 1));
    expect(removed.ok).toBe(false);
  });

  it("upserts and removes a guide", () => {
    const document = createEmptyDocument("doc", "Guides");
    const created = executeTransaction(document, transaction("doc", [
      { kind: "set_guide", guide: { id: "g1", axis: "vertical", coordinate: 100, locked: false, visible: true } },
    ]));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.document.drafting?.guides).toHaveLength(1);
    const removed = executeTransaction(created.document, transaction("doc", [{ kind: "remove_guide", guideId: "g1" }], 1));
    expect(removed.ok).toBe(true);
  });

  it("rejects replacing a locked guide", () => {
    const document = createEmptyDocument("doc", "Guides");
    const created = executeTransaction(document, transaction("doc", [
      { kind: "set_guide", guide: { id: "g1", axis: "vertical", coordinate: 100, locked: true, visible: true } },
    ]));
    if (!created.ok) throw new Error("setup failed");
    const replaced = executeTransaction(created.document, transaction("doc", [
      { kind: "set_guide", guide: { id: "g1", axis: "vertical", coordinate: 200, locked: true, visible: true } },
    ], 1));
    expect(replaced.ok).toBe(false);
  });

  it("upserts a schematic annotation (legacy kind; route-marker lands at the gate)", () => {
    const document = createEmptyDocument("doc", "Annotation");
    const result = executeTransaction(document, transaction("doc", [
      {
        kind: "upsert_schematic_annotation",
        annotation: {
          id: "l1", kind: "instance-label", text: "M1",
          position: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, alignment: "middle", rotation: 0, locked: false,
        },
      },
    ]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.annotations[0]?.kind).toBe("instance-label");
  });

  it("rejects a floating symbol without a resolver (no decorative validation possible)", () => {
    const document = createEmptyDocument("doc", "Floating");
    const result = executeTransaction(document, transaction("doc", [
      {
        kind: "upsert_drafting_object",
        object: {
          id: "f1", kind: "floating-symbol", locked: false, zIndex: 0,
          anchor: { kind: "free", position: { x: 0, y: 0 } },
          symbolId: "nmos",
          transform: { rotation: 0, mirror: "none" },
        },
      },
    ]));
    expect(result.ok).toBe(false);
  });

  it("accepts a decorative floating symbol and rejects a terminal-bearing one (WP-A4)", () => {
    const resolver = new InMemorySymbolResolver(builtInSymbols);
    const document = createEmptyDocument("doc", "Floating");
    const decorative = executeTransaction(
      document,
      transaction("doc", [
        {
          kind: "upsert_drafting_object",
          object: {
            id: "f1", kind: "floating-symbol", locked: false, zIndex: 0,
            anchor: { kind: "free", position: { x: 0, y: 0 } },
            symbolId: "decorative-note-box",
            transform: { rotation: 0, mirror: "none" },
          },
        },
      ]),
      { symbolResolver: resolver },
    );
    expect(decorative.ok).toBe(true);

    const terminal = executeTransaction(
      document,
      transaction("doc", [
        {
          kind: "upsert_drafting_object",
          object: {
            id: "f2", kind: "floating-symbol", locked: false, zIndex: 0,
            anchor: { kind: "free", position: { x: 0, y: 0 } },
            symbolId: "nmos",
            transform: { rotation: 0, mirror: "none" },
          },
        },
      ]),
      { symbolResolver: resolver },
    );
    expect(terminal.ok).toBe(false);
  });
});
