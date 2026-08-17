import type { CircuitProject } from "@icm/model";

import { parseProject } from "./load.js";
import { serializeProject } from "./save.js";

export interface ProjectStorage {
  readText(path: string): Promise<string>;
  writeTextAtomically(path: string, content: string): Promise<void>;
}

export async function loadProject(
  storage: ProjectStorage,
  path: string,
): Promise<CircuitProject> {
  return parseProject(await storage.readText(path));
}

export async function saveProject(
  storage: ProjectStorage,
  path: string,
  project: CircuitProject,
): Promise<void> {
  await storage.writeTextAtomically(path, serializeProject(project));
}
