import { describe, expect, it, vi } from "vitest";

import {
  AgentSessionMachine,
  type AgentSessionLimits,
} from "@icm/agent-adapter";

import {
  forwardCircuitRequest,
  redeemClaimResponse,
  relayHeaders,
  revokeSession,
} from "./agent-session";

const limits: Partial<AgentSessionLimits> = {
  claimTtlMs: 60_000,
  tokenTtlMs: 60_000,
  sessionTtlMs: 120_000,
  maxRequestBytes: 128,
  rateLimit: { windowMs: 60_000, maxRequests: 10 },
};

function setup() {
  let counter = 0;
  const random = () => `rand-${counter++}`;
  let time = 1_000_000;
  const created = AgentSessionMachine.create({
    limits,
    projectSessionId: "project-session-1",
    projectId: "project-1",
    documentIds: ["document-1"],
    scopes: ["circuit.snapshot", "circuit.edit.geometry"],
    now: time,
    random,
  });
  return {
    machine: created.machine,
    session: created.session,
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

function tokenFor(
  machine: AgentSessionMachine,
  code: string,
  now: number,
): string {
  const redeemed = machine.redeemClaim(code, now);
  if (!redeemed.ok) throw new Error("claim failed in fixture");
  return redeemed.claim.agentToken;
}

// WP-WA4: the relay orchestration (authorize → size → idempotency → forward →
// cache) is tested with an injected forward callback; the real Cloudflare
// WebSocket browser channel is the deployment-verified transport.

describe("agent-session relay", () => {
  it("redeems a claim and rejects reuse with typed errors", () => {
    const { machine, session, now } = setup();
    const first = redeemClaimResponse(machine, session.claimCode, now());
    expect(first.ok).toBe(true);

    const reuse = redeemClaimResponse(machine, session.claimCode, now());
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.error.code).toBe("CLAIM_ALREADY_USED");
  });

  it("forwards an authorized request and caches its result", async () => {
    const { machine, session, now } = setup();
    const token = tokenFor(machine, session.claimCode, now());
    const forward = vi.fn(async () => ({ revision: 9 }));

    const result = await forwardCircuitRequest(
      machine,
      token,
      "request-1",
      10,
      { example: true },
      now(),
      forward,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result).toEqual({ revision: 9 });
    expect(forward).toHaveBeenCalledTimes(1);
  });

  it("serves the cached result on retry and never calls forward again", async () => {
    const { machine, session, now } = setup();
    const token = tokenFor(machine, session.claimCode, now());
    const forward = vi.fn(async () => ({ revision: 9 }));

    await forwardCircuitRequest(
      machine,
      token,
      "request-1",
      10,
      {},
      now(),
      forward,
    );
    const replay = await forwardCircuitRequest(
      machine,
      token,
      "request-1",
      10,
      {},
      now(),
      forward,
    );

    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.result).toEqual({ revision: 9 });
    expect(forward).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized payload before forwarding", async () => {
    const { machine, session, now } = setup();
    const token = tokenFor(machine, session.claimCode, now());
    const forward = vi.fn(async () => "should-not-run");

    const result = await forwardCircuitRequest(
      machine,
      token,
      "request-big",
      129, // maxRequestBytes is 128
      {},
      now(),
      forward,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("REQUEST_TOO_LARGE");
    expect(forward).not.toHaveBeenCalled();
  });

  it("rejects a bad token before forwarding", async () => {
    const { machine, now } = setup();
    const forward = vi.fn(async () => "should-not-run");

    const result = await forwardCircuitRequest(
      machine,
      "not-a-token",
      "request-1",
      10,
      {},
      now(),
      forward,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TOKEN_INVALID");
    expect(forward).not.toHaveBeenCalled();
  });

  it("revokes the session so subsequent forwarding fails", async () => {
    const { machine, session, now } = setup();
    const token = tokenFor(machine, session.claimCode, now());
    const forward = vi.fn(async () => ({}));

    expect(revokeSession(machine).ok).toBe(true);

    const result = await forwardCircuitRequest(
      machine,
      token,
      "request-1",
      10,
      {},
      now(),
      forward,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SESSION_REVOKED");
    expect(forward).not.toHaveBeenCalled();
  });

  it("emits no-store and allowlisted CORS headers", () => {
    const headers = relayHeaders("https://editor.example");
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("access-control-allow-origin")).toBe(
      "https://editor.example",
    );
    expect(headers.get("vary")).toBe("Origin");

    const denied = relayHeaders(null);
    expect(denied.get("access-control-allow-origin")).toBeNull();
    expect(denied.get("cache-control")).toBe("no-store");
  });
});
