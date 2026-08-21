import { IDBFactory } from "fake-indexeddb";
import { createEmptyProject, CURRENT_PROJECT_SCHEMA_VERSION } from "@icm/model";
import { serializeProject } from "@icm/project-protocol";
import { describe, expect, it } from "vitest";

import {
  createUserExamplesStore,
  USER_EXAMPLE_MAX_RECORD_BYTES,
} from "./user-examples-store";

function storeWithFreshDatabase() {
  return createUserExamplesStore({ idbFactory: new IDBFactory() });
}

const identity = (id: string, savedAt: string) => ({
  id,
  name: `Example ${id}`,
  savedAt,
});

describe("user examples store", () => {
  it("round-trips a saved snapshot through list and read", async () => {
    const store = storeWithFreshDatabase();
    const project = createEmptyProject("example-project", "My Inverter");

    const saved = await store.save(
      project,
      identity("ex-1", "2026-08-21T10:00:00.000Z"),
    );
    expect(saved.status).toBe("stored");

    const listed = await store.list();
    expect(listed).toMatchObject({
      status: "ready",
      examples: [
        {
          id: "ex-1",
          name: "Example ex-1",
          savedAt: "2026-08-21T10:00:00.000Z",
          schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
        },
      ],
    });

    const read = await store.read("ex-1");
    expect(read.status).toBe("ready");
    if (read.status === "ready") {
      expect(read.project).toEqual(project);
      expect(read.record.projectText).toBe(serializeProject(project));
    }
  });

  it("lists newest first and deletes exactly one record", async () => {
    const store = storeWithFreshDatabase();
    const project = createEmptyProject("example-project", "P");
    await store.save(project, identity("older", "2026-08-20T10:00:00.000Z"));
    await store.save(project, identity("newer", "2026-08-21T10:00:00.000Z"));

    const listed = await store.list();
    if (listed.status !== "ready") throw new Error("expected ready");
    expect(listed.examples.map((example) => example.id)).toEqual([
      "newer",
      "older",
    ]);

    expect(await store.remove("older")).toEqual({ status: "deleted" });
    const after = await store.list();
    if (after.status !== "ready") throw new Error("expected ready");
    expect(after.examples.map((example) => example.id)).toEqual(["newer"]);
    expect(await store.read("older")).toEqual({ status: "missing" });
  });

  it("upgrades a previous-schema snapshot through the protocol on read", async () => {
    const factory = new IDBFactory();
    const store = createUserExamplesStore({ idbFactory: factory });
    const project = createEmptyProject("example-project", "P");
    await store.save(project, identity("ex-prev", "2026-08-21T10:00:00.000Z"));

    // Age the stored snapshot to the previous schema version in place.
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open("analog-canvas-user-examples", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("user-examples-v1", "readwrite");
      const objectStore = transaction.objectStore("user-examples-v1");
      const get = objectStore.get("ex-prev");
      get.onsuccess = () => {
        const record = get.result as { projectText: string };
        const raw = JSON.parse(record.projectText) as {
          schemaVersion: number;
        };
        raw.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION - 1;
        record.projectText = JSON.stringify(raw);
        const put = objectStore.put(record, "ex-prev");
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      get.onerror = () => reject(get.error);
    });
    database.close();

    const read = await store.read("ex-prev");
    expect(read.status).toBe("ready");
    if (read.status === "ready") {
      expect(read.project.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION);
    }
  });

  it("rejects an oversized snapshot without writing", async () => {
    const store = storeWithFreshDatabase();
    const project = createEmptyProject("example-project", "P");
    project.documents[0]!.name = "x".repeat(USER_EXAMPLE_MAX_RECORD_BYTES);
    const saved = await store.save(
      project,
      identity("huge", "2026-08-21T10:00:00.000Z"),
    );
    expect(saved.status).toBe("rejected-too-large");
    const listed = await store.list();
    if (listed.status !== "ready") throw new Error("expected ready");
    expect(listed.examples).toEqual([]);
  });

  it("reports storage-unavailable instead of throwing without IndexedDB", async () => {
    const store = createUserExamplesStore({
      idbFactory: undefined as unknown as IDBFactory,
    });
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: undefined,
    });
    try {
      const listed = await store.list();
      expect(listed).toMatchObject({
        status: "failed",
        failure: "storage-unavailable",
      });
    } finally {
      Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: original,
      });
    }
  });
});
