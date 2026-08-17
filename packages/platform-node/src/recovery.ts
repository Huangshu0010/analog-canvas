import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  parseProject,
  saveProject,
  serializeProject,
} from "@icm/project-protocol";
import type { CircuitProject } from "@icm/model";

import { RootedProjectStorage } from "./storage.js";

export interface RecoveryRecord {
  format: "icm-recovery-v1";
  projectKey: string;
  formalPath: string | null;
  savedAt: string;
  project: string;
}

export type RecoveryReadResult =
  | { status: "missing" }
  | { status: "valid"; record: RecoveryRecord; project: CircuitProject }
  | { status: "corrupt"; message: string };

function fileNameFor(projectKey: string): string {
  return `${createHash("sha256").update(projectKey).digest("hex")}.json`;
}

export function defaultApplicationDataRoot(environment = process.env): string {
  if (process.platform === "win32" && environment.LOCALAPPDATA) {
    return join(environment.LOCALAPPDATA, "InteractiveCircuitMaker");
  }
  if (process.platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "InteractiveCircuitMaker",
    );
  }
  return join(
    environment.XDG_STATE_HOME ?? join(homedir(), ".local", "state"),
    "interactive-circuit-maker",
  );
}

export class RecoveryStore {
  readonly storage: RootedProjectStorage;

  constructor(applicationDataRoot = defaultApplicationDataRoot()) {
    this.storage = new RootedProjectStorage(
      join(applicationDataRoot, "recovery"),
    );
  }

  async write(
    projectKey: string,
    project: CircuitProject,
    formalPath: string | null,
    savedAt = new Date().toISOString(),
  ): Promise<void> {
    const record: RecoveryRecord = {
      format: "icm-recovery-v1",
      projectKey,
      formalPath,
      savedAt,
      project: serializeProject(project),
    };
    await this.storage.writeTextAtomically(
      fileNameFor(projectKey),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }

  async read(projectKey: string): Promise<RecoveryReadResult> {
    let serialized: string;
    try {
      serialized = await this.storage.readText(fileNameFor(projectKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { status: "missing" };
      throw error;
    }
    try {
      const record = JSON.parse(serialized) as RecoveryRecord;
      if (
        record.format !== "icm-recovery-v1" ||
        record.projectKey !== projectKey ||
        typeof record.project !== "string"
      ) {
        throw new Error("Recovery envelope is invalid");
      }
      return { status: "valid", record, project: parseProject(record.project) };
    } catch (error) {
      return {
        status: "corrupt",
        message: error instanceof Error ? error.message : "Recovery is corrupt",
      };
    }
  }

  async clear(projectKey: string): Promise<void> {
    await this.storage.removeText(fileNameFor(projectKey));
  }

  async promote(
    projectKey: string,
    formalStorage: RootedProjectStorage,
    formalPath: string,
  ): Promise<CircuitProject> {
    const recovery = await this.read(projectKey);
    if (recovery.status !== "valid")
      throw new Error(`Recovery is not promotable: ${recovery.status}`);
    await saveProject(formalStorage, formalPath, recovery.project);
    await this.clear(projectKey);
    return recovery.project;
  }
}
