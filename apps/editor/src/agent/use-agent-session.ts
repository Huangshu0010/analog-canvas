import { useCallback, useRef, useState } from "react";

import {
  AgentSessionMachine,
  type AgentSessionScope,
  type AgentSessionStatus,
} from "@icm/agent-adapter";

import type {
  AgentAuditEntry,
  AgentConnectionStatus,
} from "./connect-agent-panel";

/**
 * React binding for the Agent session (WP-WA5). Owns an
 * {@link AgentSessionMachine} and exposes the panel state plus grant/pause/
 * resume/revoke controls. All authorization/expiry/idempotency decisions live in
 * the state machine; this hook only mirrors its status into React and records a
 * bounded audit. The claim code is held only while the session is live and is
 * cleared on revoke/close; it is never sent to analytics or recovery.
 *
 * The network relay transport (WP-WA4 DO) is layered on top of this state; in the
 * no-network dev path the host is the in-browser `BrowserAgentHost` (WP-WA3).
 */

function machineStatusToConnection(
  status: AgentSessionStatus | "expired",
): AgentConnectionStatus {
  if (status === "expired") return "expired";
  if (status === "active") return "ready";
  return status;
}

export interface AgentSessionViewModel {
  status: AgentConnectionStatus;
  claimCode: string | null;
  scopes: readonly AgentSessionScope[];
  expiresAt: number | null;
  audit: readonly AgentAuditEntry[];
}

export interface UseAgentSessionResult extends AgentSessionViewModel {
  grant: (scopes: readonly AgentSessionScope[]) => void;
  markClaimed: () => void;
  pause: () => void;
  resume: () => void;
  revoke: () => void;
  /** Advance the visible status from the machine (e.g. on a heartbeat tick). */
  refresh: () => void;
}

export function useAgentSession(): UseAgentSessionResult {
  const machineRef = useRef<AgentSessionMachine | null>(null);
  const [view, setView] = useState<AgentSessionViewModel>({
    status: "idle",
    claimCode: null,
    scopes: [],
    expiresAt: null,
    audit: [],
  });

  const record = useCallback(
    (next: Partial<AgentSessionViewModel>, entry: AgentAuditEntry | null) => {
      setView((previous) => ({
        ...previous,
        ...next,
        audit: entry ? [...previous.audit, entry].slice(-32) : previous.audit,
      }));
    },
    [],
  );

  const snapshot = useCallback(
    (overrides: Partial<AgentSessionViewModel> = {}): AgentSessionViewModel => {
      const machine = machineRef.current;
      if (!machine) {
        return { ...view, ...overrides };
      }
      return {
        ...view,
        status: machineStatusToConnection(machine.statusAt(Date.now())),
        ...overrides,
      };
    },
    [view],
  );

  const grant = useCallback(
    (scopes: readonly AgentSessionScope[]) => {
      const now = Date.now();
      const created = AgentSessionMachine.create({
        projectSessionId: crypto.randomUUID(),
        projectId: crypto.randomUUID(),
        documentIds: [],
        scopes,
        now,
        random: () => crypto.randomUUID(),
      });
      machineRef.current = created.machine;
      record(
        {
          status: "ready",
          claimCode: created.session.claimCode,
          scopes,
          expiresAt: created.session.expiresAt,
        },
        { at: now, kind: "granted" },
      );
    },
    [record],
  );

  const markClaimed = useCallback(() => {
    record({}, { at: Date.now(), kind: "claimed" });
  }, [record]);

  const pause = useCallback(() => {
    machineRef.current?.pause();
    record({ status: "paused" }, { at: Date.now(), kind: "paused" });
  }, [record]);

  const resume = useCallback(() => {
    machineRef.current?.resume();
    record({ status: "ready" }, { at: Date.now(), kind: "resumed" });
  }, [record]);

  const revoke = useCallback(() => {
    machineRef.current?.revoke();
    record(
      { status: "revoked", claimCode: null },
      { at: Date.now(), kind: "revoked" },
    );
  }, [record]);

  const refresh = useCallback(() => {
    setView((previous) => {
      const machine = machineRef.current;
      if (!machine) return previous;
      return {
        ...previous,
        status: machineStatusToConnection(machine.statusAt(Date.now())),
      };
    });
  }, []);

  return {
    ...view,
    grant,
    markClaimed,
    pause,
    resume,
    revoke,
    refresh,
  };
}
