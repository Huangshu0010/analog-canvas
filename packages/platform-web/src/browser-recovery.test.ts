import { describe, expect, it } from "vitest";

import { createEmptyProject } from "@icm/model";

import {
  BROWSER_RECOVERY_FORMAT,
  createBrowserRecoveryRecord,
  decodeBrowserRecoveryRecord,
} from "./browser-recovery.js";

describe("browser recovery envelope", () => {
  it("round-trips a canonical Project and preserves its formal-file hint", () => {
    const project = createEmptyProject("browser-recovery", "Untitled Project");
    const record = createBrowserRecoveryRecord(project, {
      updatedAt: "2026-08-09T00:00:00.000Z",
      formalFileHint: {
        name: "untitled.icproj.json",
        lastSavedAt: "2026-08-09T00:01:00.000Z",
      },
    });
    const result = decodeBrowserRecoveryRecord(record, project.id);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.project).toEqual(project);
    expect(result.record.formalFileHint?.name).toBe("untitled.icproj.json");
  });

  it("rejects envelopes that point at a different Project", () => {
    const project = createEmptyProject("browser-recovery", "Untitled Project");
    const record = createBrowserRecoveryRecord(project, {
      updatedAt: "2026-08-09T00:00:00.000Z",
    });
    expect(decodeBrowserRecoveryRecord(record, "another-project")).toEqual({
      status: "corrupt",
      message: "Recovery envelope belongs to another Project",
    });
  });

  it("rejects malformed or electrically unrelated recovery payloads", () => {
    expect(
      decodeBrowserRecoveryRecord({ format: BROWSER_RECOVERY_FORMAT }),
    ).toEqual({
      status: "corrupt",
      message: "Recovery envelope projectId is invalid",
    });
    const project = createEmptyProject("browser-recovery", "Untitled Project");
    const record = createBrowserRecoveryRecord(project, {
      updatedAt: "2026-08-09T00:00:00.000Z",
    });
    expect(
      decodeBrowserRecoveryRecord({ ...record, projectId: "mismatched" }),
    ).toEqual({
      status: "corrupt",
      message: "Recovery Project id does not match its envelope",
    });
  });
});
