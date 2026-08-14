// Project file service: canonical serialization, progressive-enhancement
// File System Access saves, download fallback, and staged opens.
//
// Truthful outcome reporting is the contract of this module:
//
// - only a completed `createWritable`/`write`/`close` sequence reports
//   `write-confirmed`;
// - a browser download the platform cannot confirm reports
//   `download-requested`, never "saved";
// - picker cancellation, permission denial, and stream failures at open,
//   write, or close are distinct typed outcomes;
// - a failed save aborts the writable stream where supported and never
//   touches recovery records;
// - opens are staged completely (bytes → JSON/schema diagnostics →
//   approved-symbol validation) before the caller may replace the live
//   Project, and rejected input leaves everything unchanged.
//
// File handles are transient runtime capabilities: nothing here serializes a
// handle into Project JSON or a recovery record.

import {
  parseProject,
  serializeProject,
  ProjectFormatError,
  type CircuitProject,
} from "@icm/model";

export type ProjectFileState =
  | "new"
  | "opened"
  | "dirty"
  | "write-confirmed"
  | "download-requested"
  | "write-failed";

export interface ProjectFileOpenDiagnostic {
  code:
    | "READ_FAILED"
    | "INVALID_JSON"
    | "INVALID_PROJECT"
    | "UNSUPPORTED_SCHEMA_VERSION"
    | "UNSUPPORTED_SYMBOL";
  message: string;
  path?: ReadonlyArray<string | number>;
}

export type ProjectFileOpenOutcome =
  | {
      status: "opened";
      project: CircuitProject;
      fileName: string;
      topDocumentRevision: number;
    }
  | { status: "rejected"; diagnostics: ProjectFileOpenDiagnostic[] };

export type ProjectSaveOutcome =
  | {
      status: "write-confirmed";
      fileName: string;
      bytes: number;
      at: string;
    }
  | { status: "download-requested"; fileName: string; bytes: number }
  | { status: "picker-cancelled" }
  | { status: "permission-denied"; message: string }
  | {
      status: "write-failed";
      stage: "open" | "write" | "close";
      message: string;
    }
  | { status: "serialization-failed"; message: string };

interface ProjectFilePickerWindow {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    excludeAcceptAllOption?: boolean;
  }) => Promise<ProjectFileHandleLike>;
}

interface ProjectWritableStreamLike {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
  abort?(reason?: unknown): Promise<void>;
}

interface ProjectFileHandleLike {
  name?: string;
  createWritable(options?: {
    keepExistingData?: boolean;
  }): Promise<ProjectWritableStreamLike>;
}

interface ProjectFileAnchorLike {
  href: string;
  download: string;
  click(): void;
}

interface ProjectFileDocumentLike {
  createElement(tagName: "a"): ProjectFileAnchorLike;
}

export interface ProjectFileServiceSeams {
  getWindow?: () => ProjectFilePickerWindow | null;
  getDocument?: () => ProjectFileDocumentLike | null;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  now?: () => string;
  setTimeout?: (handler: () => void, ms: number) => unknown;
}

function defaultWindow(): ProjectFilePickerWindow | null {
  return (globalThis as { window?: ProjectFilePickerWindow }).window ?? null;
}

function defaultDocument(): ProjectFileDocumentLike | null {
  try {
    return (
      (globalThis as { document?: ProjectFileDocumentLike }).document ?? null
    );
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown failure";
}

export function projectFileBaseName(projectName: string): string {
  const cleaned = projectName
    .trim()
    .replace(/[\\/:*?"<>|]+/gu, "-")
    .replace(/\s+/gu, " ");
  return cleaned.length > 0 ? cleaned : "project";
}

function isPickerAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isPickerDenied(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  );
}

/**
 * Download the canonical Project bytes as a Blob. Because the browser does
 * not confirm durable download completion, callers must report
 * `download-requested`, not "saved".
 */
export function requestProjectDownload(
  project: CircuitProject,
  seams: ProjectFileServiceSeams = {},
):
  | { status: "download-requested"; fileName: string; bytes: number }
  | { status: "failed"; message: string } {
  let text: string;
  try {
    text = serializeProject(project);
  } catch (error) {
    return { status: "failed", message: errorMessage(error) };
  }
  const fileName = `${projectFileBaseName(project.name)}.icproj.json`;
  const documentLike = seams.getDocument?.() ?? defaultDocument();
  if (documentLike === null) {
    return { status: "failed", message: "no document available for download" };
  }
  const urlFactory =
    seams.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const urlReleaser =
    seams.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));
  const schedule =
    seams.setTimeout ??
    ((handler: () => void, ms: number) => globalThis.setTimeout(handler, ms));
  const url = urlFactory(new Blob([text], { type: "application/json" }));
  const anchor = documentLike.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  schedule(() => urlReleaser(url), 0);
  return {
    status: "download-requested",
    fileName,
    bytes: new TextEncoder().encode(text).length,
  };
}

/**
 * Save the canonical Project. File System Access is progressive
 * enhancement: when available, a completed write/close sequence is a
 * confirmed save; otherwise (or on explicit denial) fall back to a download
 * the platform cannot confirm.
 */
export async function saveProjectArtifact(
  project: CircuitProject,
  seams: ProjectFileServiceSeams = {},
): Promise<ProjectSaveOutcome> {
  let text: string;
  try {
    text = serializeProject(project);
  } catch (error) {
    return { status: "serialization-failed", message: errorMessage(error) };
  }
  const bytes = new TextEncoder().encode(text).length;
  const suggestedName = `${projectFileBaseName(project.name)}.icproj.json`;
  const pickerWindow = seams.getWindow?.() ?? defaultWindow();
  const picker = pickerWindow?.showSaveFilePicker;
  if (typeof picker !== "function") {
    const download = requestProjectDownload(project, seams);
    if (download.status === "failed") {
      return { status: "serialization-failed", message: download.message };
    }
    return download;
  }

  let handle: ProjectFileHandleLike;
  try {
    handle = await picker.call(pickerWindow, {
      suggestedName,
      types: [
        {
          description: "Analog Canvas Project",
          accept: { "application/json": [".icproj.json", ".json"] },
        },
      ],
    });
  } catch (error) {
    if (isPickerAbort(error)) return { status: "picker-cancelled" };
    if (isPickerDenied(error)) {
      // Progressive enhancement only: without a granted location, fall back
      // to the download path instead of failing the save.
      const download = requestProjectDownload(project, seams);
      if (download.status === "failed") {
        return {
          status: "permission-denied",
          message: errorMessage(error),
        };
      }
      return download;
    }
    return { status: "permission-denied", message: errorMessage(error) };
  }

  let writable: ProjectWritableStreamLike;
  try {
    writable = await handle.createWritable();
  } catch (error) {
    return {
      status: "write-failed",
      stage: "open",
      message: errorMessage(error),
    };
  }
  try {
    await writable.write(text);
  } catch (error) {
    await abortQuietly(writable);
    return {
      status: "write-failed",
      stage: "write",
      message: errorMessage(error),
    };
  }
  try {
    await writable.close();
  } catch (error) {
    await abortQuietly(writable);
    return {
      status: "write-failed",
      stage: "close",
      message: errorMessage(error),
    };
  }
  return {
    status: "write-confirmed",
    fileName: handle.name ?? suggestedName,
    bytes,
    at: seams.now?.() ?? new Date().toISOString(),
  };
}

async function abortQuietly(
  writable: ProjectWritableStreamLike,
): Promise<void> {
  try {
    await writable.abort?.(new Error("save abandoned after failure"));
  } catch {
    // An stream that already failed may reject abort as well; the recovery
    // records and the live Project are unaffected either way.
  }
}

/**
 * Fully stage an opened Project candidate: read bytes, parse with schema
 * diagnostics, then run the caller's approved-symbol validation. Only a
 * `status: "opened"` result may replace the live Project; anything else
 * leaves Project, selection, history, recovery, and file state untouched.
 */
export async function stageProjectFile(
  file: { name: string; text(): Promise<string> },
  findUnsupportedSymbols: (project: CircuitProject) => string[],
): Promise<ProjectFileOpenOutcome> {
  let serialized: string;
  try {
    serialized = await file.text();
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [{ code: "READ_FAILED", message: errorMessage(error) }],
    };
  }
  let project: CircuitProject;
  try {
    project = parseProject(serialized);
  } catch (error) {
    if (error instanceof ProjectFormatError) {
      return {
        status: "rejected",
        diagnostics: error.diagnostics.map((diagnostic) => ({
          code: diagnostic.code,
          message: diagnostic.message,
          ...(diagnostic.path.length === 0
            ? {}
            : { path: [...diagnostic.path] }),
        })),
      };
    }
    return {
      status: "rejected",
      diagnostics: [
        {
          code: "INVALID_JSON",
          message: errorMessage(error),
        },
      ],
    };
  }
  const unsupported = findUnsupportedSymbols(project);
  if (unsupported.length > 0) {
    return {
      status: "rejected",
      diagnostics: [
        {
          code: "UNSUPPORTED_SYMBOL",
          message: `Project uses unsupported non-Razavi symbols: ${unsupported.join(", ")}`,
        },
      ],
    };
  }
  const topDocument = project.documents.find(
    (candidate) => candidate.id === project.topDocumentId,
  );
  if (topDocument === undefined) {
    return {
      status: "rejected",
      diagnostics: [
        {
          code: "INVALID_PROJECT",
          message: "top document is missing from the Project",
        },
      ],
    };
  }
  return {
    status: "opened",
    project,
    fileName: file.name,
    topDocumentRevision: topDocument.revision,
  };
}

export function formatProjectOpenDiagnostics(
  diagnostics: readonly ProjectFileOpenDiagnostic[],
): string {
  const first = diagnostics[0];
  if (first === undefined) return "Project open failed";
  const location =
    first.path && first.path.length > 0 ? ` at ${first.path.join(".")}` : "";
  return `${first.code}${location}: ${first.message}`;
}
