import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { executeTransaction } from "./transaction.js";

function documentWithInstance() {
  const document = createEmptyDocument("document-main", "Main");
  document.instances.push({
    id: "M1",
    symbolId: "nmos",
    placement: null,
    properties: {},
  });
  return document;
}

function transaction(expectedRevision = 0, dryRun = false) {
  return {
    transactionId: "transaction-test",
    documentId: "document-main",
    expectedRevision,
    actor: { kind: "human" as const, id: "human-test" },
    dryRun,
    edits: [{ kind: "noop" as const, reason: "Phase 0 envelope proof" }],
  };
}

describe("Edit Transaction envelope", () => {
  it("rejects a stale revision without changing the Document", () => {
    const document = createEmptyDocument("document-main", "Main");
    const before = JSON.stringify(document);
    const result = executeTransaction(document, transaction(8));
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_REVISION");
    }
    expect(result.document).toBe(document);
    expect(JSON.stringify(document)).toBe(before);
  });

  it("applies an accepted no-op atomically and advances revision", () => {
    const document = createEmptyDocument("document-main", "Main");
    const result = executeTransaction(document, transaction());
    expect(result).toMatchObject({
      ok: true,
      applied: true,
      revision: 1,
      proposedRevision: 1,
    });
    expect(result.document).not.toBe(document);
    expect(document.revision).toBe(0);
  });

  it("dry-runs without mutating or advancing the current revision", () => {
    const document = createEmptyDocument("document-main", "Main");
    const result = executeTransaction(document, transaction(0, true));
    expect(result).toMatchObject({
      ok: true,
      applied: false,
      revision: 0,
      proposedRevision: 1,
    });
    // dryRun returns the validated candidate geometry (so callers can inspect
    // proposed Routes), NOT the original Document reference. The original
    // Document must be untouched and the revision un-advanced.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document).not.toBe(document);
    expect(document.revision).toBe(0);
    expect(result.document.revision).toBe(1);
  });

  it("rejects the complete transaction when an edit is unknown", () => {
    const document = createEmptyDocument("document-main", "Main");
    const result = executeTransaction(document, {
      ...transaction(),
      edits: [{ kind: "move_instance", instanceId: "M1" }],
    });
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    expect(result.document).toBe(document);
  });

  it("places and transforms an instance through typed edits", () => {
    const document = documentWithInstance();
    const placed = executeTransaction(document, {
      ...transaction(),
      edits: [
        {
          kind: "place_instance",
          instanceId: "M1",
          placement: {
            position: { x: 100, y: 80 },
            rotation: 0,
            mirror: "none",
          },
        },
      ],
    });
    expect(placed).toMatchObject({
      ok: true,
      applied: true,
      revision: 1,
      diff: { changedObjectIds: ["M1"] },
    });
    if (!placed.ok) {
      throw new Error("Placement unexpectedly failed");
    }

    const transformed = executeTransaction(placed.document, {
      ...transaction(1),
      transactionId: "transaction-transform",
      edits: [
        {
          kind: "move_instance",
          instanceId: "M1",
          position: { x: 120, y: 90 },
        },
        { kind: "rotate_instance", instanceId: "M1", rotation: 90 },
        { kind: "mirror_instance", instanceId: "M1", mirror: "x" },
      ],
    });
    expect(transformed).toMatchObject({
      ok: true,
      revision: 2,
      document: {
        instances: [
          {
            id: "M1",
            placement: {
              position: { x: 120, y: 90 },
              rotation: 90,
              mirror: "x",
            },
          },
        ],
      },
    });
  });

  it("rejects a multi-edit transaction atomically after a later precondition failure", () => {
    const document = documentWithInstance();
    const before = JSON.stringify(document);
    const result = executeTransaction(document, {
      ...transaction(),
      edits: [
        {
          kind: "place_instance",
          instanceId: "M1",
          placement: {
            position: { x: 100, y: 80 },
            rotation: 0,
            mirror: "none",
          },
        },
        {
          kind: "move_instance",
          instanceId: "missing",
          position: { x: 0, y: 0 },
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, applied: false, revision: 0 });
    expect(result.document).toBe(document);
    expect(JSON.stringify(document)).toBe(before);
  });
});
