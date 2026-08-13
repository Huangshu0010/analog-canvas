import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ConnectAgentPanel,
  agentConnectionInstructions,
  type AgentAuditEntry,
  type AgentConnectionStatus,
} from "./connect-agent-panel";

function baseProps(
  overrides: Partial<Parameters<typeof ConnectAgentPanel>[0]>,
) {
  return {
    open: true,
    status: "idle" as AgentConnectionStatus,
    claimCode: null,
    scopes: [],
    expiresAt: null,
    audit: [],
    error: null,
    now: 0,
    onGrant: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onReconnect: vi.fn(),
    onRotate: vi.fn(),
    onRevoke: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// WP-WA5: the panel renders the grant surface, the one-time claim code, status,
// pause/resume/revoke controls, and the audit across connection states. Secrets
// live only in props while the session is live; nothing here persists them.

describe("ConnectAgentPanel", () => {
  it("provides one complete golden-path lifecycle without a bearer value", () => {
    const instructions = agentConnectionInstructions(
      "https://editor.example",
      "claim-once",
    );
    expect(instructions).toContain(
      'POSTing {"claimCode":"claim-once"} to https://editor.example/api/agent/claims',
    );
    expect(instructions).toContain("4. Call capabilities once");
    expect(instructions).toContain("7. Dry-run non-trivial transact requests");
    expect(instructions).toContain("9. Render, then request a fresh snapshot");
    expect(instructions).toContain(
      "10. Reuse a requestId only when retrying the exact same payload",
    );
    expect(instructions).not.toMatch(/Bearer [A-Za-z0-9_-]{20,}/u);
  });

  it("renders nothing when closed", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel {...baseProps({ open: false })} />,
    );
    expect(markup).toBe("");
  });

  it("offers the three permission presets in the idle state", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel {...baseProps({ status: "idle" })} />,
    );
    expect(markup).toContain("Connect Agent");
    expect(markup).toContain("Not connected");
    expect(markup).toContain('data-testid="agent-preset-review"');
    expect(markup).toContain('data-testid="agent-preset-layout"');
    expect(markup).toContain('data-testid="agent-preset-full"');
    expect(markup).toContain("Review");
    expect(markup).toContain("Full Circuit Edit");
  });

  it("shows the one-time claim code while waiting for the Agent", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({
          status: "waiting-for-agent",
          claimCode: "CLAIM-12345",
          scopes: ["circuit.snapshot", "circuit.render"],
          expiresAt: 60_000,
          now: 0,
        })}
      />,
    );
    expect(markup).toContain('data-testid="agent-claim-code"');
    expect(markup).toContain('data-testid="agent-copy-instructions"');
    expect(markup).toContain("CLAIM-12345");
    expect(markup).toContain("circuit.snapshot, circuit.render");
    expect(markup).toContain('data-testid="agent-pause"');
    expect(markup).toContain('data-testid="agent-revoke"');
    // No grant presets after connecting.
    expect(markup).not.toContain('data-testid="agent-grant"');
  });

  it("offers resume instead of pause while paused", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({ status: "paused", claimCode: "C1" })}
      />,
    );
    expect(markup).toContain('data-testid="agent-resume"');
    expect(markup).not.toContain('data-testid="agent-pause"');
  });

  it("offers explicit recovery while the relay is reconnecting or offline", () => {
    for (const status of ["reconnecting", "offline"] as const) {
      const markup = renderToStaticMarkup(
        <ConnectAgentPanel {...baseProps({ status })} />,
      );
      expect(markup).toContain('data-testid="agent-reconnect"');
      expect(markup).toContain('data-testid="agent-revoke"');
    }
  });

  it("offers user-triggered access rotation while connected", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel {...baseProps({ status: "connected" })} />,
    );
    expect(markup).toContain('data-testid="agent-rotate"');
    expect(markup).toContain("Rotate Agent Access");
  });

  it("hides the claim code and controls in a terminal revoked state", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({
          status: "revoked",
          claimCode: null,
          audit: [
            {
              at: 0,
              kind: "granted",
            },
            { at: 1, kind: "revoked" },
          ] as AgentAuditEntry[],
        })}
      />,
    );
    expect(markup).toContain("Revoked");
    expect(markup).not.toContain('data-testid="agent-claim"');
    expect(markup).not.toContain('data-testid="agent-revoke"');
    // The audit still records the grant and the revocation.
    expect(markup).toContain('data-testid="agent-audit"');
  });
});
