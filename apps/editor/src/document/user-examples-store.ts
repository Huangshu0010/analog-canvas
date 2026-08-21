// Origin-local, non-authoritative store for user-saved Library examples.
//
// A user example is a convenience snapshot: canonical serialized Project
// text plus a display name. It is not Project persistence — the downloaded
// `.icproj.json` remains the authoritative file — and this store owns its
// own IndexedDB database only: it never reads, writes, or deletes recovery
// records or any other database.

import type { CircuitProject } from "@icm/model";
import {
  parseProject,
  ProjectFormatError,
  serializeProject,
} from "@icm/project-protocol";

export const USER_EXAMPLES_DATABASE_NAME = "analog-canvas-user-examples";
export const USER_EXAMPLES_STORE_NAME = "user-examples-v1";
export const USER_EXAMPLES_DATABASE_VERSION = 1;

/** One snapshot stays well under any realistic browser quota slice. */
export const USER_EXAMPLE_MAX_RECORD_BYTES = 8 * 1024 * 1024;

export type UserExampleStorageFailure =
  "quota-exceeded" | "storage-unavailable" | "storage-failed";

export interface UserExampleRecord {
  id: string;
  name: string;
  savedAt: string;
  schemaVersion: number;
  projectText: string;
}

export interface UserExampleSummary {
  id: string;
  name: string;
  savedAt: string;
  schemaVersion: number;
}

export type UserExampleSaveOutcome =
  | { status: "stored"; record: UserExampleRecord }
  | { status: "rejected-too-large"; byteLength: number }
  | { status: "failed"; failure: UserExampleStorageFailure; message: string };

export type UserExampleListOutcome =
  | { status: "ready"; examples: UserExampleSummary[] }
  | { status: "failed"; failure: UserExampleStorageFailure; message: string };

export type UserExampleReadOutcome =
  | { status: "ready"; record: UserExampleRecord; project: CircuitProject }
  | { status: "missing" }
  | { status: "invalid"; message: string }
  | { status: "failed"; failure: UserExampleStorageFailure; message: string };

export type UserExampleDeleteOutcome =
  | { status: "deleted" }
  | { status: "failed"; failure: UserExampleStorageFailure; message: string };

export interface UserExamplesStoreSeams {
  /** Injectable IndexedDB factory for deterministic tests. */
  readonly idbFactory?: IDBFactory;
}

export interface UserExamplesStore {
  list(): Promise<UserExampleListOutcome>;
  save(
    project: CircuitProject,
    identity: { id: string; name: string; savedAt: string },
  ): Promise<UserExampleSaveOutcome>;
  read(id: string): Promise<UserExampleReadOutcome>;
  remove(id: string): Promise<UserExampleDeleteOutcome>;
  close(): void;
}

/** Thrown when the runtime exposes no IndexedDB at all (SSR, hard denial). */
class UserExamplesStorageUnavailableError extends Error {
  constructor() {
    super("IndexedDB is unavailable in this browsing context");
    this.name = "UserExamplesStorageUnavailableError";
  }
}

function classifyStorageFailure(error: unknown): UserExampleStorageFailure {
  if (error instanceof UserExamplesStorageUnavailableError) {
    return "storage-unavailable";
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError") return "quota-exceeded";
  if (
    name === "NotFoundError" ||
    name === "InvalidStateError" ||
    name === "SecurityError" ||
    name === "VersionError"
  ) {
    return "storage-unavailable";
  }
  return "storage-failed";
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDB request"));
  });
}

function decodeRecord(value: unknown): UserExampleRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.savedAt !== "string" ||
    typeof record.schemaVersion !== "number" ||
    typeof record.projectText !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    savedAt: record.savedAt,
    schemaVersion: record.schemaVersion,
    projectText: record.projectText,
  };
}

export function createUserExamplesStore(
  seams: UserExamplesStoreSeams = {},
): UserExamplesStore {
  let database: IDBDatabase | null = null;

  async function openDatabase(): Promise<IDBDatabase> {
    if (database) return database;
    const factory = seams.idbFactory ?? globalThis.indexedDB ?? null;
    if (!factory) throw new UserExamplesStorageUnavailableError();
    const request = factory.open(
      USER_EXAMPLES_DATABASE_NAME,
      USER_EXAMPLES_DATABASE_VERSION,
    );
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(USER_EXAMPLES_STORE_NAME)) {
        db.createObjectStore(USER_EXAMPLES_STORE_NAME);
      }
    };
    database = await requestToPromise(request as IDBRequest<IDBDatabase>);
    return database;
  }

  async function withStore<T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const db = await openDatabase();
    const transaction = db.transaction(USER_EXAMPLES_STORE_NAME, mode);
    return body(transaction.objectStore(USER_EXAMPLES_STORE_NAME));
  }

  return {
    async list() {
      try {
        const values = await withStore("readonly", (store) =>
          requestToPromise(store.getAll()),
        );
        const examples = values
          .map(decodeRecord)
          .filter((record): record is UserExampleRecord => record !== null)
          .map(({ projectText: _text, ...summary }) => summary)
          .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
        return { status: "ready" as const, examples };
      } catch (error) {
        return {
          status: "failed" as const,
          failure: classifyStorageFailure(error),
          message: failureMessage(error),
        };
      }
    },

    async save(project, identity) {
      const projectText = serializeProject(project);
      const record: UserExampleRecord = {
        id: identity.id,
        name: identity.name,
        savedAt: identity.savedAt,
        schemaVersion: project.schemaVersion,
        projectText,
      };
      const byteLength = new TextEncoder().encode(projectText).length;
      if (byteLength > USER_EXAMPLE_MAX_RECORD_BYTES) {
        return { status: "rejected-too-large" as const, byteLength };
      }
      try {
        await withStore("readwrite", (store) =>
          requestToPromise(store.put(record, record.id)),
        );
        return { status: "stored" as const, record };
      } catch (error) {
        return {
          status: "failed" as const,
          failure: classifyStorageFailure(error),
          message: failureMessage(error),
        };
      }
    },

    async read(id) {
      try {
        const value = await withStore("readonly", (store) =>
          requestToPromise(store.get(id)),
        );
        if (value === undefined) return { status: "missing" as const };
        const record = decodeRecord(value);
        if (!record) {
          return {
            status: "invalid" as const,
            message: "Stored example is not decodable",
          };
        }
        try {
          // The ordinary protocol boundary revalidates and, within the
          // rolling window, upgrades the snapshot before it can replace a
          // live Project.
          return {
            status: "ready" as const,
            record,
            project: parseProject(record.projectText),
          };
        } catch (error) {
          return {
            status: "invalid" as const,
            message:
              error instanceof ProjectFormatError
                ? (error.diagnostics[0]?.message ?? error.message)
                : failureMessage(error),
          };
        }
      } catch (error) {
        return {
          status: "failed" as const,
          failure: classifyStorageFailure(error),
          message: failureMessage(error),
        };
      }
    },

    async remove(id) {
      try {
        await withStore("readwrite", (store) =>
          requestToPromise(store.delete(id)),
        );
        return { status: "deleted" as const };
      } catch (error) {
        return {
          status: "failed" as const,
          failure: classifyStorageFailure(error),
          message: failureMessage(error),
        };
      }
    },

    close() {
      database?.close();
      database = null;
    },
  };
}
