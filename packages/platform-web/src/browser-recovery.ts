import { parseProject, serializeProject } from "@icm/model";
import type { CircuitProject } from "@icm/model";

const DATABASE_NAME = "interactive-circuit-maker";
const DATABASE_VERSION = 1;
const RECOVERY_STORE = "recovery-v1";

export const BROWSER_RECOVERY_FORMAT = "icm-browser-recovery-v1";

export interface FormalFileHint {
  name: string;
  lastSavedAt?: string;
}

export interface BrowserRecoveryRecord {
  format: typeof BROWSER_RECOVERY_FORMAT;
  projectId: string;
  projectName: string;
  schemaVersion: number;
  updatedAt: string;
  projectText: string;
  formalFileHint?: FormalFileHint;
}

export type BrowserRecoveryReadResult =
  | { status: "missing" }
  | {
      status: "valid";
      record: BrowserRecoveryRecord;
      project: CircuitProject;
    }
  | { status: "corrupt"; message: string };

export type BrowserRecoveryWriteResult =
  | { status: "stored"; record: BrowserRecoveryRecord }
  | { status: "unavailable"; message: string }
  | { status: "quota-exceeded"; message: string }
  | { status: "failed"; message: string };

export interface BrowserRecoveryStoreOptions {
  maxRecords?: number;
  maxRecordBytes?: number;
  now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordError(message: string): BrowserRecoveryReadResult {
  return { status: "corrupt", message };
}

export function decodeBrowserRecoveryRecord(
  input: unknown,
  expectedProjectId?: string,
): BrowserRecoveryReadResult {
  if (!isRecord(input) || input.format !== BROWSER_RECOVERY_FORMAT) {
    return recordError("Recovery envelope format is invalid");
  }
  if (typeof input.projectId !== "string" || input.projectId.length === 0) {
    return recordError("Recovery envelope projectId is invalid");
  }
  if (expectedProjectId && input.projectId !== expectedProjectId) {
    return recordError("Recovery envelope belongs to another Project");
  }
  if (typeof input.projectName !== "string" || input.projectName.length === 0) {
    return recordError("Recovery envelope projectName is invalid");
  }
  if (
    typeof input.schemaVersion !== "number" ||
    !Number.isInteger(input.schemaVersion)
  ) {
    return recordError("Recovery envelope schemaVersion is invalid");
  }
  if (
    typeof input.updatedAt !== "string" ||
    Number.isNaN(Date.parse(input.updatedAt))
  ) {
    return recordError("Recovery envelope updatedAt is invalid");
  }
  if (typeof input.projectText !== "string") {
    return recordError("Recovery envelope projectText is invalid");
  }
  const formalFileHint = input.formalFileHint;
  if (
    formalFileHint !== undefined &&
    (!isRecord(formalFileHint) || typeof formalFileHint.name !== "string")
  ) {
    return recordError("Recovery envelope formalFileHint is invalid");
  }

  const record: BrowserRecoveryRecord = {
    format: BROWSER_RECOVERY_FORMAT,
    projectId: input.projectId,
    projectName: input.projectName,
    schemaVersion: input.schemaVersion,
    updatedAt: input.updatedAt,
    projectText: input.projectText,
    ...(formalFileHint
      ? {
          formalFileHint: {
            name: formalFileHint.name as string,
            ...(typeof formalFileHint.lastSavedAt === "string"
              ? { lastSavedAt: formalFileHint.lastSavedAt }
              : {}),
          },
        }
      : {}),
  };

  try {
    const project = parseProject(record.projectText);
    if (project.id !== record.projectId) {
      return recordError("Recovery Project id does not match its envelope");
    }
    return { status: "valid", record, project };
  } catch (error) {
    return recordError(
      error instanceof Error ? error.message : "Recovery Project is invalid",
    );
  }
}

export function createBrowserRecoveryRecord(
  project: CircuitProject,
  options: {
    updatedAt: string;
    formalFileHint?: FormalFileHint;
  },
): BrowserRecoveryRecord {
  return {
    format: BROWSER_RECOVERY_FORMAT,
    projectId: project.id,
    projectName: project.name,
    schemaVersion: project.schemaVersion,
    updatedAt: options.updatedAt,
    projectText: serializeProject(project),
    ...(options.formalFileHint
      ? { formalFileHint: options.formalFileHint }
      : {}),
  };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function openRecoveryDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is unavailable in this browser"),
    );
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECOVERY_STORE)) {
        database.createObjectStore(RECOVERY_STORE, { keyPath: "projectId" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Browser recovery failed";
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/**
 * Origin-local, non-authoritative crash recovery for the static Page editor.
 * Formal Project saves never pass through this store.
 */
export class BrowserRecoveryStore {
  readonly #maxRecords: number;
  readonly #maxRecordBytes: number;
  readonly #now: () => Date;

  constructor(options: BrowserRecoveryStoreOptions = {}) {
    this.#maxRecords = options.maxRecords ?? 5;
    this.#maxRecordBytes = options.maxRecordBytes ?? 4_000_000;
    this.#now = options.now ?? (() => new Date());
  }

  static isAvailable(): boolean {
    return typeof indexedDB !== "undefined";
  }

  async write(
    project: CircuitProject,
    formalFileHint?: FormalFileHint,
  ): Promise<BrowserRecoveryWriteResult> {
    if (!BrowserRecoveryStore.isAvailable()) {
      return {
        status: "unavailable",
        message:
          "IndexedDB is unavailable; this browser cannot keep a recovery copy.",
      };
    }
    const record = createBrowserRecoveryRecord(project, {
      updatedAt: this.#now().toISOString(),
      ...(formalFileHint ? { formalFileHint } : {}),
    });
    if (byteLength(record.projectText) > this.#maxRecordBytes) {
      return {
        status: "quota-exceeded",
        message:
          "This Project is too large for the configured browser recovery limit.",
      };
    }

    let database: IDBDatabase | undefined;
    try {
      database = await openRecoveryDatabase();
      const transaction = database.transaction(RECOVERY_STORE, "readwrite");
      const store = transaction.objectStore(RECOVERY_STORE);
      store.put(record);
      await transactionComplete(transaction);
      await this.prune(database);
      return { status: "stored", record };
    } catch (error) {
      return {
        status: isQuotaError(error) ? "quota-exceeded" : "failed",
        message: errorMessage(error),
      };
    } finally {
      database?.close();
    }
  }

  async read(projectId: string): Promise<BrowserRecoveryReadResult> {
    if (!BrowserRecoveryStore.isAvailable()) return { status: "missing" };
    let database: IDBDatabase | undefined;
    try {
      database = await openRecoveryDatabase();
      const transaction = database.transaction(RECOVERY_STORE, "readonly");
      const input = await requestResult(
        transaction.objectStore(RECOVERY_STORE).get(projectId),
      );
      await transactionComplete(transaction);
      return input === undefined
        ? { status: "missing" }
        : decodeBrowserRecoveryRecord(input, projectId);
    } catch (error) {
      return { status: "corrupt", message: errorMessage(error) };
    } finally {
      database?.close();
    }
  }

  async list(): Promise<readonly BrowserRecoveryReadResult[]> {
    if (!BrowserRecoveryStore.isAvailable()) return [];
    let database: IDBDatabase | undefined;
    try {
      database = await openRecoveryDatabase();
      const transaction = database.transaction(RECOVERY_STORE, "readonly");
      const inputs = await requestResult(
        transaction.objectStore(RECOVERY_STORE).getAll(),
      );
      await transactionComplete(transaction);
      return inputs
        .map((input) => decodeBrowserRecoveryRecord(input))
        .sort((left, right) => {
          const leftTime = left.status === "valid" ? left.record.updatedAt : "";
          const rightTime =
            right.status === "valid" ? right.record.updatedAt : "";
          return rightTime.localeCompare(leftTime);
        });
    } catch {
      return [];
    } finally {
      database?.close();
    }
  }

  async clear(projectId: string): Promise<void> {
    if (!BrowserRecoveryStore.isAvailable()) return;
    const database = await openRecoveryDatabase();
    try {
      const transaction = database.transaction(RECOVERY_STORE, "readwrite");
      transaction.objectStore(RECOVERY_STORE).delete(projectId);
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  private async prune(database: IDBDatabase): Promise<void> {
    const readTransaction = database.transaction(RECOVERY_STORE, "readonly");
    const records = (await requestResult(
      readTransaction.objectStore(RECOVERY_STORE).getAll(),
    )) as BrowserRecoveryRecord[];
    await transactionComplete(readTransaction);
    const stale = records
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(this.#maxRecords);
    if (stale.length === 0) return;
    const writeTransaction = database.transaction(RECOVERY_STORE, "readwrite");
    const store = writeTransaction.objectStore(RECOVERY_STORE);
    for (const record of stale) store.delete(record.projectId);
    await transactionComplete(writeTransaction);
  }
}
