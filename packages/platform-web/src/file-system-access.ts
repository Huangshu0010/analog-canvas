import { parseProject, serializeProject } from "@icm/model";
import type { CircuitProject } from "@icm/model";

/** Minimal structural types: File System Access is an optional browser API. */
export interface BrowserWritableFileStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

export interface BrowserProjectFileHandle {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<BrowserWritableFileStream>;
  queryPermission?(descriptor?: {
    mode: "read" | "readwrite";
  }): Promise<"granted" | "denied" | "prompt">;
  requestPermission?(descriptor?: {
    mode: "read" | "readwrite";
  }): Promise<"granted" | "denied" | "prompt">;
}

export function supportsBrowserFileSystemAccess(): boolean {
  return (
    typeof window !== "undefined" &&
    "showOpenFilePicker" in window &&
    "showSaveFilePicker" in window
  );
}

export async function readProjectFromHandle(
  handle: BrowserProjectFileHandle,
): Promise<CircuitProject> {
  return parseProject(await (await handle.getFile()).text());
}

export async function requestWritablePermission(
  handle: BrowserProjectFileHandle,
): Promise<boolean> {
  const descriptor = { mode: "readwrite" as const };
  const current = await handle.queryPermission?.(descriptor);
  if (current === "granted") return true;
  return (await handle.requestPermission?.(descriptor)) === "granted";
}

/**
 * Writes only to a FileHandle that the user selected. Callers must fall back to
 * an explicit download when permission is unavailable or denied.
 */
export async function writeProjectToHandle(
  handle: BrowserProjectFileHandle,
  project: CircuitProject,
): Promise<"written" | "permission-denied"> {
  if (!(await requestWritablePermission(handle))) return "permission-denied";
  const stream = await handle.createWritable();
  try {
    await stream.write(serializeProject(project));
    await stream.close();
    return "written";
  } catch (error) {
    await stream.abort?.();
    throw error;
  }
}
