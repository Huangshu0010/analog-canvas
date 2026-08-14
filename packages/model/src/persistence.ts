import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
} from "./schema.js";
import type { CircuitProject } from "./schema.js";

export interface ProjectDiagnostic {
  code: "INVALID_JSON" | "INVALID_PROJECT" | "UNSUPPORTED_SCHEMA_VERSION";
  message: string;
  path: ReadonlyArray<string | number>;
}

export class ProjectFormatError extends Error {
  readonly diagnostics: readonly ProjectDiagnostic[];

  constructor(diagnostics: readonly ProjectDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("; "));
    this.name = "ProjectFormatError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .map((key) => [key, sortKeys(value[key])]),
    );
  }
  return value;
}

export function validateProject(input: unknown): CircuitProject {
  const result = CircuitProjectSchema.safeParse(input);
  if (!result.success) {
    throw new ProjectFormatError(
      result.error.issues.map((issue) => ({
        code: "INVALID_PROJECT" as const,
        message: issue.message,
        path: issue.path.map((segment) =>
          typeof segment === "symbol"
            ? (segment.description ?? "symbol")
            : segment,
        ),
      })),
    );
  }
  return result.data;
}

export function parseProject(serialized: string): CircuitProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new ProjectFormatError([
      {
        code: "INVALID_JSON",
        message:
          error instanceof Error ? error.message : "Project is not valid JSON",
        path: [],
      },
    ]);
  }
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== CURRENT_PROJECT_SCHEMA_VERSION
  ) {
    throw new ProjectFormatError([
      {
        code: "UNSUPPORTED_SCHEMA_VERSION",
        message: `Project schemaVersion must be exactly ${CURRENT_PROJECT_SCHEMA_VERSION}`,
        path: ["schemaVersion"],
      },
    ]);
  }
  return validateProject(parsed);
}

export function serializeProject(project: CircuitProject): string {
  const validated = validateProject(project);
  return `${JSON.stringify(sortKeys(validated), null, 2)}\n`;
}

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
