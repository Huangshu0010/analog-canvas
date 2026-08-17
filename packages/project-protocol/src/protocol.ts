import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
} from "@icm/model";
import type { CircuitProject } from "@icm/model";

export interface ProjectDiagnostic {
  readonly code:
    "INVALID_JSON" | "INVALID_PROJECT" | "UNSUPPORTED_SCHEMA_VERSION";
  readonly message: string;
  readonly path: ReadonlyArray<string | number>;
}

/**
 * The rolling compatibility window is deliberately explicit. Advancing the
 * current schema replaces this adapter instead of extending a migration chain.
 */
export const PREVIOUS_PROJECT_SCHEMA_VERSION = 10;

export interface ProjectParseResult {
  readonly project: CircuitProject;
  readonly sourceSchemaVersion: number;
  readonly migrated: boolean;
}

export type ProjectLoadResult =
  | ({ readonly ok: true } & ProjectParseResult)
  | { readonly ok: false; readonly diagnostics: readonly ProjectDiagnostic[] };

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

function invalidProjectDiagnostics(
  input: unknown,
): readonly ProjectDiagnostic[] {
  const result = CircuitProjectSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    code: "INVALID_PROJECT" as const,
    message: issue.message,
    path: issue.path.map((segment) =>
      typeof segment === "symbol" ? (segment.description ?? "symbol") : segment,
    ),
  }));
}

export function tryValidateProject(input: unknown): ProjectLoadResult {
  const diagnostics = invalidProjectDiagnostics(input);
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return {
    ok: true,
    project: CircuitProjectSchema.parse(input),
    sourceSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    migrated: false,
  };
}

export function validateProject(input: unknown): CircuitProject {
  const result = tryValidateProject(input);
  if (!result.ok) throw new ProjectFormatError(result.diagnostics);
  return result.project;
}

function upgradePreviousProject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  // Schema 11 adds the RichText `fraction` variant. Every valid schema-10
  // value remains valid after advancing the version; preserve authored text.
  return { ...raw, schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION };
}

export function tryParseProjectWithMetadata(
  serialized: string,
): ProjectLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "INVALID_JSON",
          message:
            error instanceof Error
              ? error.message
              : "Project is not valid JSON",
          path: [],
        },
      ],
    };
  }
  if (!isRecord(parsed) || !Number.isInteger(parsed.schemaVersion)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "UNSUPPORTED_SCHEMA_VERSION",
          message: "Project schemaVersion must be an integer",
          path: ["schemaVersion"],
        },
      ],
    };
  }

  const sourceSchemaVersion = parsed.schemaVersion as number;
  const migrated = sourceSchemaVersion === PREVIOUS_PROJECT_SCHEMA_VERSION;
  if (sourceSchemaVersion !== CURRENT_PROJECT_SCHEMA_VERSION && !migrated) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "UNSUPPORTED_SCHEMA_VERSION",
          message: `Project schemaVersion must be ${PREVIOUS_PROJECT_SCHEMA_VERSION} or ${CURRENT_PROJECT_SCHEMA_VERSION}`,
          path: ["schemaVersion"],
        },
      ],
    };
  }

  const current = migrated ? upgradePreviousProject(parsed) : parsed;
  const diagnostics = invalidProjectDiagnostics(current);
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return {
    ok: true,
    project: CircuitProjectSchema.parse(current),
    sourceSchemaVersion,
    migrated,
  };
}

export function parseProjectWithMetadata(
  serialized: string,
): ProjectParseResult {
  const result = tryParseProjectWithMetadata(serialized);
  if (!result.ok) throw new ProjectFormatError(result.diagnostics);
  return result;
}

export function parseProject(serialized: string): CircuitProject {
  return parseProjectWithMetadata(serialized).project;
}

export function serializeProject(project: CircuitProject): string {
  return `${JSON.stringify(sortKeys(validateProject(project)), null, 2)}\n`;
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
