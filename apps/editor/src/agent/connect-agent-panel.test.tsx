import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ConnectAgentPanel,
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
    now: 0,
    onGrant: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onRevoke: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// WP-WA5: the panel renders the grant surface, the one-time claim code, status,
// pause/resume/revoke controls, and the audit across connection states. Secrets
// live only in props while the session is live; nothing here persists them.

describe("ConnectAgentPanel", () => {
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

  it("shows the one-time claim code, scopes, and pause/revoke when ready", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({
          status: "ready",
          claimCode: "CLAIM-12345",
          scopes: ["circuit.snapshot", "circuit.render"],
          expiresAt: 60_000,
          now: 0,
        })}
      />,
    );
    expect(markup).toContain('data-testid="agent-claim-code"');
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
