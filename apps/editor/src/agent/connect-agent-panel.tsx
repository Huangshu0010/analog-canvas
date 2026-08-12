import type { ReactNode } from "react";

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
  "idle" | "ready" | "paused" | "revoked" | "expired";

export interface AgentAuditEntry {
  at: number;
  kind: "granted" | "claimed" | "paused" | "resumed" | "revoked" | "replaced";
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
  now: number;
  onGrant: (scopes: AgentSessionScope[]) => void;
  onPause: () => void;
  onResume: () => void;
  onRevoke: () => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<AgentConnectionStatus, string> = {
  idle: "Not connected",
  ready: "Connected",
  paused: "Paused",
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
  if (!props.open) return null;
  const connected = props.status !== "idle";
  const terminal = props.status === "revoked" || props.status === "expired";

  return (
    <div
      className="agent-panel"
      role="dialog"
      aria-label="Connect Agent"
      data-testid="connect-agent-panel"
      data-status={props.status}
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
          (expires in {formatExpiry(props.expiresAt, props.now)})
        </span>
      </p>

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
          <p>Give this one-time code to the Agent. It expires in minutes.</p>
          <code data-testid="agent-claim-code">{props.claimCode}</code>
          <p className="agent-panel-scopes">
            Scopes: {props.scopes.join(", ")}
          </p>
        </div>
      ) : null}

      {connected ? (
        <div className="agent-panel-controls">
          {props.status === "ready" ? (
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
          {!terminal ? (
            <button
              type="button"
              data-testid="agent-revoke"
              onClick={props.onRevoke}
            >
              Revoke
            </button>
          ) : null}
        </div>
      ) : null}

      {props.audit.length > 0 ? (
        <ul className="agent-panel-audit" data-testid="agent-audit">
          {props.audit
            .slice()
            .reverse()
            .map((entry, index) => (
              <li key={`${entry.at}-${index}`} data-testid="agent-audit-entry">
                <span>{new Date(entry.at).toISOString()}</span>
                <span>{entry.kind}</span>
                {entry.detail ? <span>{entry.detail}</span> : null}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
