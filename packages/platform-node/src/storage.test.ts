import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createEmptyProject, loadProject, saveProject } from "@icm/model";
import { describe, expect, it } from "vitest";

import { RecoveryStore } from "./recovery.js";
import { RootedProjectStorage } from "./storage.js";

describe("Node persistence and recovery", () => {
  it("keeps the last formal file intact when replacement is interrupted", async () => {
    const root = await mkdtemp(join(tmpdir(), "icm-atomic-"));
    const path = "project.icproj.json";
    const original = createEmptyProject("original", "Original");
    await saveProject(new RootedProjectStorage(root), path, original);
    const failing = new RootedProjectStorage(root, {
      onFaultPoint: () => {
        throw new Error("simulated interruption");
      },
    });
    await expect(
      saveProject(failing, path, createEmptyProject("next", "Next")),
    ).rejects.toThrow("simulated interruption");
    await expect(
      loadProject(new RootedProjectStorage(root), path),
    ).resolves.toEqual(original);
  });

  it("atomically replaces an existing formal Project", async () => {
    const root = await mkdtemp(join(tmpdir(), "icm-replace-"));
    const storage = new RootedProjectStorage(root);
    await saveProject(
      storage,
      "project.icproj.json",
      createEmptyProject("first", "First"),
    );
    const next = createEmptyProject("second", "Second");
    await saveProject(storage, "project.icproj.json", next);
    await expect(loadProject(storage, "project.icproj.json")).resolves.toEqual(
      next,
    );
  });

  it("rejects traversal outside the configured root", async () => {
    const root = await mkdtemp(join(tmpdir(), "icm-root-"));
    const storage = new RootedProjectStorage(root);
    await expect(storage.readText("../outside.json")).rejects.toThrow(
      "outside",
    );
  });

  it("validates recovery before explicit promotion", async () => {
    const appData = await mkdtemp(join(tmpdir(), "icm-appdata-"));
    const formalRoot = await mkdtemp(join(tmpdir(), "icm-formal-"));
    const recovery = new RecoveryStore(appData);
    const project = createEmptyProject("recoverable", "Recoverable");
    await recovery.write(
      "session",
      project,
      "project.icproj.json",
      "2026-08-07T00:00:00.000Z",
    );
    expect((await recovery.read("session")).status).toBe("valid");
    const promoted = await recovery.promote(
      "session",
      new RootedProjectStorage(formalRoot),
      "project.icproj.json",
    );
    expect(promoted).toEqual(project);
    expect((await recovery.read("session")).status).toBe("missing");
    expect(
      await loadProject(
        new RootedProjectStorage(formalRoot),
        "project.icproj.json",
      ),
    ).toEqual(project);

    const file = recovery.storage.resolvePath(
      `${await import("node:crypto").then(({ createHash }) => createHash("sha256").update("broken").digest("hex"))}.json`,
    );
    await writeFile(file, "{broken", "utf8");
    expect(await recovery.read("broken")).toMatchObject({ status: "corrupt" });
    expect(
      await readFile(join(formalRoot, "project.icproj.json"), "utf8"),
    ).toContain("recoverable");
  });
});
