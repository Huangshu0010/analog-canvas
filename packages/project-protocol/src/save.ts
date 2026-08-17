import type { CircuitProject } from "@icm/model";

import { validateProject } from "./load.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

export function serializeProject(project: CircuitProject): string {
  return `${JSON.stringify(sortKeys(validateProject(project)), null, 2)}\n`;
}
