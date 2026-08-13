import { useEffect, useState, type ReactNode } from "react";

import type { AgentSessionScope } from "@icm/agent-adapter";

/**
 * Connect Agent panel (WP-WA5). Presentational component for the browser-side
 * authorization surface: permission presets, the one-time claim code shown after
 * grant, the connection status, pause/revoke controls, and a recent-operation
 * audit. State and secrets are owned by the parent (see `useAgentSession`); this
 * component never persists a secret and never sends one to analytics.
 *
 * Contract: [`docs/specs/web-agent-session.md`](../../../docs/specs/web-agent-session.md).
 */

export type AgentConnectionStatus =
  | "idle"
  | "creating"
  | "waiting-for-agent"
  | "connected"
  | "working"
  | "paused"
  | "reconnecting"
  | "offline"
  | "revoked"
  | "expired";

export interface AgentAuditEntry {
  at: number;
  kind:
    | "granted"
    | "claimed"
    | "operation"
    | "paused"
    | "resumed"
    | "revoked"
    | "replaced";
  detail?: string;
}

export interface PermissionPreset {
  id: "review" | "layout" | "full";
  label: string;
  scopes: AgentSessionScope[];
}

export const AGENT_PERMISSION_PRESETS: readonly PermissionPreset[] = [
  {
    id: "review",
    label: "Review",
    scopes: ["circuit.snapshot", "circuit.render", "circuit.source-spans"],
  },
  {
    id: "layout",
    label: "Layout Edit",
    scopes: [
      "circuit.snapshot",
      "circuit.render",
      "circuit.source-spans",
      "circuit.edit.geometry",
    ],
  },
  {
    id: "full",
    label: "Full Circuit Edit",
    scopes: [
      "circuit.snapshot",
      "circuit.render",
      "circuit.source-spans",
      "circuit.edit.geometry",
      "circuit.edit.connectivity",
      "circuit.edit.presentation",
    ],
  },
];

export interface ConnectAgentPanelProps {
  open: boolean;
  status: AgentConnectionStatus;
  claimCode: string | null;
  scopes: readonly AgentSessionScope[];
  expiresAt: number | null;
  audit: readonly AgentAuditEntry[];
  error: string | null;
  now: number;
  onGrant: (scopes: AgentSessionScope[]) => void;
  onPause: () => void;
  onResume: () => void;
  onReconnect: () => void;
  onRotate: () => void;
  onRevoke: () => void;
  onClose: () => void;
}

export function agentConnectionInstructions(
  origin: string,
  claimCode: string,
): string {
  const claimUrl = `${origin}/api/agent/claims`;
  const circuitUrl = `${origin}/api/agent/sessions/{sessionId}/circuit`;
  const openApiUrl = `${origin}/api/agent/openapi.json`;
  return `Connect to the Interactive Circuit Maker Agent API.
1. Redeem claimCode exactly once by POSTing ${JSON.stringify({ claimCode })} to ${claimUrl}, and retain the complete response in memory.
2. Never log or display agentToken.
3. Use only sessionId and documentIds returned by the claim response; replace {sessionId} in the Circuit URL with that value, and send agentToken only as the Bearer token.
4. Call capabilities once through POST ${circuitUrl}.
5. Request one complete snapshot for the selected documentId.
6. Validate every request against the published OpenAPI: ${openApiUrl}
7. Dry-run non-trivial transact requests using the snapshot revision.
8. Commit the same edits only if dry-run succeeds and the revision is unchanged.
9. Render, then request a fresh snapshot for final verification.
10. Reuse a requestId only when retrying the exact same payload.`;
}

const STATUS_LABEL: Record<AgentConnectionStatus, string> = {
  idle: "Not connected",
  creating: "Creating secure session…",
  "waiting-for-agent": "Waiting for Agent to claim",
  connected: "Agent connected",
  working: "Agent working…",
  paused: "Paused",
  reconnecting: "Reconnecting to Agent relay…",
  offline: "Editor relay offline",
  revoked: "Revoked",
  expired: "Expired",
};

function formatExpiry(expiresAt: number | null, now: number): string {
  if (expiresAt === null) return "\u2014";
  const seconds = Math.max(0, Math.round((expiresAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function ConnectAgentPanel(props: ConnectAgentPanelProps): ReactNode {
  const [clock, setClock] = useState(props.now);
  useEffect(() => {
    if (!props.open) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [props.open]);
  if (!props.open) return null;
  const connected = props.status !== "idle" && props.status !== "creating";
  const terminal = props.status === "revoked" || props.status === "expired";

  return (
    <div
      className="agent-panel"
      data-testid="connect-agent-panel"
      data-status={props.status}
    >
      <section
        className="agent-dialog"
        role="dialog"
        aria-label="Connect Agent"
      >
        <div className="agent-panel-header">
          <h2>Connect Agent</h2>
          <button type="button" onClick={props.onClose} aria-label="Close">
            Close
          </button>
        </div>

        <p className="agent-panel-status" data-testid="agent-status">
          {STATUS_LABEL[props.status]}
          <span className="agent-panel-expiry">
            {" "}
            (expires in {formatExpiry(props.expiresAt, clock)})
          </span>
        </p>

        {props.error ? (
          <p className="agent-panel-error" role="alert">
            {props.error}
          </p>
        ) : null}

        {!connected ? (
          <div className="agent-panel-grant" data-testid="agent-grant">
            <p>Grant a scoped, short-lived capability to an external Agent.</p>
            <ul>
              {AGENT_PERMISSION_PRESETS.map((preset) => (
                <li key={preset.id}>
                  <button
                    type="button"
                    className="agent-preset-button"
                    data-testid={`agent-preset-${preset.id}`}
                    onClick={() => props.onGrant(preset.scopes)}
                  >
                    {preset.label}
                  </button>
                  <span className="agent-preset-scopes">
                    {preset.scopes.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {props.claimCode !== null && !terminal ? (
          <div className="agent-panel-claim" data-testid="agent-claim">
            <p>
              Give this one-time code and the editor address to the Agent. It
              expires in minutes.
            </p>
            <code data-testid="agent-claim-code">{props.claimCode}</code>
            <button
              type="button"
              data-testid="agent-copy-instructions"
              onClick={() => {
                const origin = window.location.origin;
                void navigator.clipboard
                  .writeText(
                    agentConnectionInstructions(origin, props.claimCode!),
                  )
                  .catch(() => undefined);
              }}
            >
              Copy Agent connection instructions
            </button>
            <p className="agent-panel-scopes">
              Scopes: {props.scopes.join(", ")}
            </p>
          </div>
        ) : null}

        {connected ? (
          <div className="agent-panel-controls">
            {props.status === "connected" ||
            props.status === "waiting-for-agent" ||
            props.status === "working" ? (
              <button
                type="button"
                data-testid="agent-pause"
                onClick={props.onPause}
              >
                Pause
              </button>
            ) : null}
            {props.status === "paused" ? (
              <button
                type="button"
                data-testid="agent-resume"
                onClick={props.onResume}
              >
                Resume
              </button>
            ) : null}
            {props.status === "offline" || props.status === "reconnecting" ? (
              <button
                type="button"
                data-testid="agent-reconnect"
                onClick={props.onReconnect}
              >
                Reconnect
              </button>
            ) : null}
            {!terminal ? (
              <>
                <button
                  type="button"
                  data-testid="agent-rotate"
                  onClick={props.onRotate}
                >
                  Rotate Agent Access
                </button>
                <button
                  type="button"
                  data-testid="agent-revoke"
                  onClick={props.onRevoke}
                >
                  Revoke
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {props.audit.length > 0 ? (
          <ul className="agent-panel-audit" data-testid="agent-audit">
            {props.audit
              .slice()
              .reverse()
              .map((entry, index) => (
                <li
                  key={`${entry.at}-${index}`}
                  data-testid="agent-audit-entry"
                >
                  <span>{new Date(entry.at).toISOString()}</span>
                  <span>{entry.kind}</span>
                  {entry.detail ? <span>{entry.detail}</span> : null}
                </li>
              ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
