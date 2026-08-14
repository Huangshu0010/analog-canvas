/**
 * Connection state machine for the local MCP adapter. It deliberately tracks
 * the credential/editor relationship, not host UI visibility: a closed panel
 * or an idle host does not change the state, only claim, editor attachment,
 * revocation, and transport outcomes do.
 */
export type AgentConnectionState =
  | "unpaired"
  | "connecting"
  | "online"
  | "editor-offline"
  | "reconnecting"
  | "revoked";

export type ConnectionEvent =
  /** A claim or resume attempt started. */
  | "claim-started"
  | "resume-started"
  /** A four-operation request completed successfully. */
  | "request-succeeded"
  /** Transport reported the authorized editor is not attached. */
  | "editor-detached"
  /** Local transport failed; an automatic exact-payload retry is scheduled. */
  | "transport-interrupted"
  /** Retry attempts exhausted or the credential is terminally unusable. */
  | "credential-revoked"
  /** Stored credential removed locally. */
  | "reset";

const TRANSITIONS: Record<
  ConnectionEvent,
  Partial<Record<AgentConnectionState, AgentConnectionState>>
> = {
  "claim-started": {
    unpaired: "connecting",
    revoked: "connecting",
    "editor-offline": "connecting",
  },
  "resume-started": {
    unpaired: "connecting",
    revoked: "connecting",
    "editor-offline": "connecting",
  },
  "request-succeeded": {
    connecting: "online",
    online: "online",
    "editor-offline": "online",
    reconnecting: "online",
  },
  "editor-detached": {
    online: "editor-offline",
    connecting: "editor-offline",
    reconnecting: "editor-offline",
  },
  "transport-interrupted": {
    connecting: "reconnecting",
    online: "reconnecting",
    "editor-offline": "reconnecting",
  },
  "credential-revoked": {
    connecting: "revoked",
    online: "revoked",
    "editor-offline": "revoked",
    reconnecting: "revoked",
  },
  reset: {
    revoked: "unpaired",
    "editor-offline": "unpaired",
    online: "unpaired",
    connecting: "unpaired",
    reconnecting: "unpaired",
  },
};

export interface ConnectionSnapshot {
  state: AgentConnectionState;
  since: number;
  /** Code of the failure that produced the most recent non-online state. */
  lastErrorCode: string | null;
}

/** Pure transition function so state logic is unit-testable without IO. */
export function connectionTransition(
  state: AgentConnectionState,
  event: ConnectionEvent,
): AgentConnectionState {
  return TRANSITIONS[event][state] ?? state;
}

export class ConnectionTracker {
  private state: AgentConnectionState = "unpaired";
  private since: number;
  private lastErrorCode: string | null = null;
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
    this.since = now();
  }

  get snapshot(): ConnectionSnapshot {
    return {
      state: this.state,
      since: this.since,
      lastErrorCode: this.lastErrorCode,
    };
  }

  apply(event: ConnectionEvent, errorCode?: string): AgentConnectionState {
    const next = connectionTransition(this.state, event);
    if (errorCode !== undefined) {
      this.lastErrorCode = errorCode;
    }
    if (next !== this.state) {
      this.state = next;
      this.since = this.now();
      if (next === "online") this.lastErrorCode = null;
    }
    return this.state;
  }
}
