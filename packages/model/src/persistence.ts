import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  CircuitProjectSchema,
} from "./schema.js";
import type { CircuitProject } from "./schema.js";
import { migrateV1ToV2 } from "./migration-v1-to-v2.js";
import { migrateV2ToV3 } from "./migration-v2-to-v3.js";
import { migrateV3ToV4 } from "./migration-v3-to-v4.js";
import { migrateV4ToV5 } from "./migration-v4-to-v5.js";
import { migrateV5ToV6 } from "./migration-v5-to-v6.js";
import { migrateV6ToV7 } from "./migration-v6-to-v7.js";
import { migrateV7ToV8 } from "./migration-v7-to-v8.js";

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

export type ProjectMigration = (
  input: Readonly<Record<string, unknown>>,
) => unknown;

export class ProjectMigrationRegistry {
  readonly #migrations = new Map<number, ProjectMigration>();

  register(fromVersion: number, migration: ProjectMigration): void {
    if (!Number.isInteger(fromVersion) || fromVersion < 0) {
      throw new Error(
        "Migration source version must be a non-negative integer",
      );
    }
    if (fromVersion >= CURRENT_PROJECT_SCHEMA_VERSION) {
      throw new Error(
        "Migration source version must be older than the current schema",
      );
    }
    if (this.#migrations.has(fromVersion)) {
      throw new Error(
        `Migration from schema version ${fromVersion} is already registered`,
      );
    }
    this.#migrations.set(fromVersion, migration);
  }

  migrate(input: unknown): unknown {
    if (!isRecord(input) || !Number.isInteger(input.schemaVersion)) {
      throw new ProjectFormatError([
        {
          code: "UNSUPPORTED_SCHEMA_VERSION",
          message: "Project schemaVersion must be an integer",
          path: ["schemaVersion"],
        },
      ]);
    }

    let value: unknown = input;
    let version = input.schemaVersion as number;
    if (version > CURRENT_PROJECT_SCHEMA_VERSION) {
      throw new ProjectFormatError([
        {
          code: "UNSUPPORTED_SCHEMA_VERSION",
          message: `Project schema version ${version} is newer than supported version ${CURRENT_PROJECT_SCHEMA_VERSION}`,
          path: ["schemaVersion"],
        },
      ]);
    }

    while (version < CURRENT_PROJECT_SCHEMA_VERSION) {
      const migration = this.#migrations.get(version);
      if (!migration || !isRecord(value)) {
        throw new ProjectFormatError([
          {
            code: "UNSUPPORTED_SCHEMA_VERSION",
            message: `No migration is registered from project schema version ${version}`,
            path: ["schemaVersion"],
          },
        ]);
      }
      value = migration(value);
      if (!isRecord(value) || !Number.isInteger(value.schemaVersion)) {
        throw new Error(
          `Migration from version ${version} did not produce a schemaVersion`,
        );
      }
      const nextVersion = value.schemaVersion as number;
      if (nextVersion <= version) {
        throw new Error(
          `Migration from version ${version} did not advance the schema version`,
        );
      }
      version = nextVersion;
    }
    return value;
  }
}

export const defaultProjectMigrations = new ProjectMigrationRegistry();
// ADR 0010 schema 1 -> 2 migration (integration gate). Auto-applied on read so
// legacy Projects upgrade to the single new truth; idempotent.
defaultProjectMigrations.register(1, (input) => migrateV1ToV2(input).project);
// WP-R7 schema 2 -> 3 migration: backfills the NoConnect container. Idempotent
// and infers nothing; auto-applied on read so legacy Projects upgrade.
defaultProjectMigrations.register(2, (input) =>
  migrateV2ToV3(input as Record<string, unknown>),
);
// ADR 0017 schema 3 -> 4 migration: persists deterministic cell interfaces
// and instance netlist facts without inventing models or simulation setup.
defaultProjectMigrations.register(3, (input) =>
  migrateV3ToV4(input as Record<string, unknown>),
);
// Schema 4 -> 5: persist Net power identity once, removing the runtime
// dependency on legacy VDD/ground marker terminals.
defaultProjectMigrations.register(4, (input) =>
  migrateV4ToV5(input as Record<string, unknown>),
);
// Schema 5 -> 6: retained continuity step. Port remains an ordinary Symbol
// instance; no visual Port conversion occurs at runtime.
defaultProjectMigrations.register(5, (input) =>
  migrateV5ToV6(input as Record<string, unknown>),
);
// Schema 6 -> 7: annotations have one RichText/VisualAnchor presentation
// authority. Legacy text/attachment fields are consumed on read only.
defaultProjectMigrations.register(6, (input) =>
  migrateV6ToV7(input as Record<string, unknown>),
);
// Schema 7 -> 8: typed netlist terminal facts and immutable import provenance
// consume all runtime `spice.*` properties.
defaultProjectMigrations.register(7, (input) =>
  migrateV7ToV8(input as Record<string, unknown>),
);

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

export function parseProject(
  serialized: string,
  migrations: ProjectMigrationRegistry = defaultProjectMigrations,
): CircuitProject {
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
  return validateProject(migrations.migrate(parsed));
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
  migrations: ProjectMigrationRegistry = defaultProjectMigrations,
): Promise<CircuitProject> {
  return parseProject(await storage.readText(path), migrations);
}

export async function saveProject(
  storage: ProjectStorage,
  path: string,
  project: CircuitProject,
): Promise<void> {
  await storage.writeTextAtomically(path, serializeProject(project));
}
