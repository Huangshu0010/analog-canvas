import { useEffect, useRef, useState } from "react";

import { parseProject, serializeProject } from "@icm/model";
import type { CircuitProject } from "@icm/model";

import { createRecoveryScheduler } from "./recovery-scheduler";

export const PROJECT_RECOVERY_KEY = "icm.recovery.v1";
const PROJECT_RECOVERY_DELAY_MS = 400;

export interface ProjectRecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ProjectRecoveryLoadResult =
  | { kind: "none" }
  | { kind: "available"; project: CircuitProject }
  | { kind: "discarded-corrupt"; message: string };

export function loadProjectRecovery(
  storage: ProjectRecoveryStorage,
  key = PROJECT_RECOVERY_KEY,
): ProjectRecoveryLoadResult {
  const serialized = storage.getItem(key);
  if (!serialized) return { kind: "none" };
  try {
    return { kind: "available", project: parseProject(serialized) };
  } catch (error) {
    storage.removeItem(key);
    return {
      kind: "discarded-corrupt",
      message: error instanceof Error ? error.message : "invalid data",
    };
  }
}

export function clearProjectRecovery(
  storage: ProjectRecoveryStorage,
  key = PROJECT_RECOVERY_KEY,
): void {
  storage.removeItem(key);
}

export interface ProjectRecoveryOptions {
  key?: string;
  delayMs?: number;
  getStorage?: () => ProjectRecoveryStorage;
}

/** Browser-only recovery lifecycle; safe during server/static rendering. */
export function useProjectRecovery(
  onNotice: (message: string) => void,
  options: ProjectRecoveryOptions = {},
) {
  const [key] = useState(() => options.key ?? PROJECT_RECOVERY_KEY);
  const [delayMs] = useState(
    () => options.delayMs ?? PROJECT_RECOVERY_DELAY_MS,
  );
  const getStorage =
    options.getStorage ?? (() => globalThis.localStorage as Storage);
  const onNoticeRef = useRef(onNotice);
  onNoticeRef.current = onNotice;
  const getStorageRef = useRef(getStorage);
  getStorageRef.current = getStorage;
  const [candidate, setCandidate] = useState<CircuitProject | null>(null);
  const [scheduler] = useState(() =>
    createRecoveryScheduler<CircuitProject>({
      delayMs,
      write: (project) =>
        getStorageRef.current().setItem(key, serializeProject(project)),
    }),
  );

  useEffect(() => {
    const loaded = loadProjectRecovery(getStorageRef.current(), key);
    if (loaded.kind === "available") {
      setCandidate(loaded.project);
      onNoticeRef.current("Unsaved recovery is available");
    } else if (loaded.kind === "discarded-corrupt") {
      onNoticeRef.current(`Discarded corrupt recovery: ${loaded.message}`);
    }

    const flushWhenHidden = () => {
      if (globalThis.document.visibilityState === "hidden") scheduler.flush();
    };
    const flushOnPageHide = () => scheduler.flush();
    globalThis.window.addEventListener("visibilitychange", flushWhenHidden);
    globalThis.window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      globalThis.window.removeEventListener(
        "visibilitychange",
        flushWhenHidden,
      );
      globalThis.window.removeEventListener("pagehide", flushOnPageHide);
      scheduler.dispose();
    };
  }, [key, scheduler]);

  const clearStored = () => {
    scheduler.cancel();
    clearProjectRecovery(getStorageRef.current(), key);
    setCandidate(null);
  };

  return {
    candidate,
    stage: (project: CircuitProject) => scheduler.schedule(project),
    cancelPending: () => scheduler.cancel(),
    flush: () => scheduler.flush(),
    clearStored,
    consumeCandidate: () => {
      if (!candidate) return null;
      const project = candidate;
      clearStored();
      return project;
    },
  };
}
