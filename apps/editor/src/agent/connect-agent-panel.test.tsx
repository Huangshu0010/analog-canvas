import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AgentPropertiesSection,
  ConnectAgentPanel,
  agentConnectionInstructions,
  type AgentConnectionStatus,
} from "./connect-agent-panel";

function baseProps(
  overrides: Partial<Parameters<typeof ConnectAgentPanel>[0]>,
) {
  return {
    open: true,
    status: "idle" as AgentConnectionStatus,
    claimCode: null,
    claimExpiresAt: null,
    scopes: [],
    expiresAt: null,
    error: null,
    now: 0,
    onGrant: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onReconnect: vi.fn(),
    onNewConnection: vi.fn(),
    onRevoke: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// The dialog is only authorization and hand-off; ongoing session controls live
// in Properties. Secrets remain props-only and are never persisted here.

describe("ConnectAgentPanel", () => {
  it("provides one complete golden-path lifecycle without a bearer value", () => {
    const instructions = agentConnectionInstructions(
      "https://editor.example",
      "claim-once",
    );
    expect(instructions).toContain("Connect to Analog Canvas");
    expect(instructions).toContain(
      'Call connect with {"claimCode":"claim-once"}',
    );
    expect(instructions).toContain("analog-canvas://reference/quickstart");
    expect(instructions).toContain("connector resumes automatically");
    expect(instructions).toContain("https://editor.example/api/agent/kit");
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

  it("shows an expiring connection hand-off while waiting for the Agent", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({
          status: "waiting-for-agent",
          claimCode: "CLAIM-12345",
          claimExpiresAt: 30_000,
          scopes: ["circuit.snapshot", "circuit.render"],
          expiresAt: 60_000,
          now: 0,
        })}
      />,
    );
    expect(markup).toContain('data-testid="agent-claim-code"');
    expect(markup).toContain('data-testid="agent-copy-instructions"');
    expect(markup).toContain('data-testid="agent-copy-text"');
    expect(markup).toContain('class="agent-copy-card"');
    expect(markup).toContain("Plain text");
    expect(markup).toContain(
      "Connect to Analog Canvas through its configured MCP server.",
    );
    expect(markup).toContain(
      "Call connect with {&quot;claimCode&quot;:&quot;CLAIM-12345&quot;}",
    );
    expect(markup).toContain("CLAIM-12345");
    expect(markup).toContain("circuit.snapshot, circuit.render");
    expect(markup).toContain('data-testid="agent-pause"');
    expect(markup).toContain('data-testid="agent-revoke"');
    expect(markup).toContain('aria-label="Copy connection setup"');
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

  it("offers a replacement connection while connected", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({
          status: "connected",
          claimCode: "still-valid-claim",
          claimExpiresAt: 30_000,
          expiresAt: 60_000,
        })}
      />,
    );
    expect(markup).toContain('data-testid="agent-new-connection"');
    expect(markup).toContain("New connection");
    expect(markup).toContain("still-valid-claim");
  });

  it("offers a new connection in a terminal revoked state", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({
          status: "revoked",
          claimCode: null,
        })}
      />,
    );
    expect(markup).toContain("Disconnected");
    expect(markup).not.toContain('data-testid="agent-claim"');
    expect(markup).not.toContain('data-testid="agent-revoke"');
    expect(markup).toContain('data-testid="agent-new-connection"');
  });

  it("keeps active connection management inside Properties", () => {
    const markup = renderToStaticMarkup(
      <AgentPropertiesSection
        status="connected"
        claimCode={null}
        claimExpiresAt={null}
        scopes={["circuit.snapshot", "circuit.render"]}
        expiresAt={8 * 60 * 60 * 1_000}
        error={null}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReconnect={vi.fn()}
        onNewConnection={vi.fn()}
        onRevoke={vi.fn()}
        expanded={false}
        onToggleDetails={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(markup).toContain('data-testid="agent-properties"');
    expect(markup).toContain("Connected");
    expect(markup).toContain("Manage");
    expect(markup).toContain('data-testid="agent-pause"');
    expect(markup).not.toContain('data-testid="agent-revoke"');
  });

  it("does not expose an expired claim code", () => {
    const markup = renderToStaticMarkup(
      <ConnectAgentPanel
        {...baseProps({
          status: "waiting-for-agent",
          claimCode: "expired-claim",
          claimExpiresAt: 1,
          expiresAt: 60_000,
          now: 2,
        })}
      />,
    );
    expect(markup).toContain('data-testid="agent-claim-expired"');
    expect(markup).not.toContain('data-testid="agent-claim-code"');
    expect(markup).toContain("Generate another");
  });
});
