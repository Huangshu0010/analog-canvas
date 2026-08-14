import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CredentialStore,
  defaultCredentialFilePath,
  type StoredConnectorCredential,
} from "./credential-store.js";

const directories: string[] = [];

async function tempStore(): Promise<{ store: CredentialStore; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "ac-credential-"));
  directories.push(dir);
  return {
    store: new CredentialStore({ filePath: join(dir, "connector.json") }),
    dir,
  };
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const credential: StoredConnectorCredential = {
  version: 1,
  apiBaseUrl: "https://relay.test",
  sessionId: "session-1",
  agentToken: "secret-token",
  tokenExpiresAt: 123,
  scopes: ["circuit.snapshot"],
  projectId: "project-1",
  documentIds: ["main"],
  storedAt: 100,
};

describe("credential store", () => {
  it("round-trips a stored pairing", async () => {
    const { store } = await tempStore();
    expect(await store.load()).toBeNull();
    await store.save(credential);
    expect(await store.load()).toEqual(credential);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("rejects malformed or wrong-version files", async () => {
    const { store, dir } = await tempStore();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(store.path, "not json", "utf8");
    expect(await store.load()).toBeNull();
    await writeFile(
      store.path,
      JSON.stringify({ ...credential, version: 2 }),
      "utf8",
    );
    expect(await store.load()).toBeNull();
    expect(dir.length).toBeGreaterThan(0);
  });

  it("places the default file under ~/.analog-canvas and honors the override", () => {
    expect(defaultCredentialFilePath("/home/tester", {})).toBe(
      join("/home/tester", ".analog-canvas", "connector.json"),
    );
    expect(
      defaultCredentialFilePath("/home/tester", {
        ANALOG_CANVAS_MCP_CREDENTIALS: join("/custom", "path.json"),
      }),
    ).toBe(join("/custom", "path.json"));
  });

  it("stores the token only in the credential file", async () => {
    const { store } = await tempStore();
    await store.save(credential);
    const raw = await readFile(store.path, "utf8");
    expect(raw).toContain("secret-token");
  });
});
