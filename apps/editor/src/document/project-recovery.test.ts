import { describe, expect, it } from "vitest";

import { createEmptyProject, serializeProject } from "@icm/model";

import {
  PROJECT_RECOVERY_KEY,
  clearProjectRecovery,
  loadProjectRecovery,
} from "./project-recovery";
import type { ProjectRecoveryStorage } from "./project-recovery";

function memoryStorage(initial?: string): ProjectRecoveryStorage & {
  has(key: string): boolean;
} {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(PROJECT_RECOVERY_KEY, initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    has: (key) => values.has(key),
  };
}

describe("project recovery storage", () => {
  it("reports an empty recovery slot", () => {
    expect(loadProjectRecovery(memoryStorage())).toEqual({ kind: "none" });
  });

  it("parses a complete validated Project candidate", () => {
    const project = createEmptyProject("recovery", "Recovery");
    const loaded = loadProjectRecovery(
      memoryStorage(serializeProject(project)),
    );

    expect(loaded.kind).toBe("available");
    if (loaded.kind === "available") {
      expect(loaded.project).toEqual(project);
      expect(loaded.project).not.toBe(project);
    }
  });

  it("removes and reports corrupt recovery data", () => {
    const storage = memoryStorage("not a Project");
    const loaded = loadProjectRecovery(storage);

    expect(loaded.kind).toBe("discarded-corrupt");
    expect(storage.has(PROJECT_RECOVERY_KEY)).toBe(false);
  });

  it("clears the configured recovery slot", () => {
    const storage = memoryStorage("stale");
    clearProjectRecovery(storage);
    expect(storage.has(PROJECT_RECOVERY_KEY)).toBe(false);
  });
});
