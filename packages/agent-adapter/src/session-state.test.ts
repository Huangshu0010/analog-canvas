import { describe, expect, it } from "vitest";

import type { AgentSessionScope } from "./envelope.js";

import {
  AgentSessionMachine,
  constantTimeEqual,
  type AgentSessionLimits,
} from "./session-state.js";

const scopes: AgentSessionScope[] = [
  "circuit.snapshot",
  "circuit.render",
  "circuit.edit.geometry",
];

function setup(overrides: Partial<AgentSessionLimits> = {}) {
  let counter = 0;
  const random = () => `rand-${counter++}`;
  let time = 1_000_000;
  const now = () => time;
  const advance = (ms: number) => {
    time += ms;
  };
  const created = AgentSessionMachine.create({
    limits: overrides,
    projectSessionId: "project-session-1",
    projectId: "project-1",
    documentIds: ["document-1"],
    scopes,
    now: now(),
    random,
  });
  return {
    machine: created.machine,
    session: created.session,
    random,
    now,
    advance,
  };
}

// WP-WA4: the relay's authorization/idempotency/expiry/limit guarantees are
// exercised here with fake time. The machine never touches a Project or edit.

describe("AgentSessionMachine", () => {
  it("creates a session, returns secrets once, and authenticates the editor", () => {
    const { machine, session } = setup();
    expect(session.sessionId).toMatch(/^rand-/u);
    expect(session.editorSecret).toMatch(/^rand-/u);
    expect(session.claimCode).toMatch(/^rand-/u);
    expect(machine.authorizeEditor(session.editorSecret)).toBe(true);
    expect(machine.authorizeEditor("wrong")).toBe(false);
  });

  it("redeems a one-time claim for a scoped token and rejects reuse", () => {
    const { machine, session, now } = setup();
    const first = machine.redeemClaim(session.claimCode, now());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.claim.scopes).toEqual(scopes);

    const auth = machine.authorize(first.claim.agentToken, now());
    expect(auth.ok).toBe(true);

    const reuse = machine.redeemClaim(session.claimCode, now());
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.code).toBe("CLAIM_ALREADY_USED");
  });

  it("rejects an unknown claim code", () => {
    const { machine, now } = setup();
    const result = machine.redeemClaim("not-the-code", now());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLAIM_INVALID");
  });

  it("expires an unused claim after its TTL", () => {
    const { machine, session, now, advance } = setup({ claimTtlMs: 60_000 });
    advance(60_001);
    const result = machine.redeemClaim(session.claimCode, now());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLAIM_EXPIRED");
  });

  it("rejects a wrong token and an expired token", () => {
    const { machine, session, now, advance } = setup({ tokenTtlMs: 60_000 });
    const redeemed = machine.redeemClaim(session.claimCode, now());
    if (!redeemed.ok) throw new Error("claim failed");

    expect(machine.authorize("wrong-token", now()).ok).toBe(false);
    advance(60_001);
    const expired = machine.authorize(redeemed.claim.agentToken, now());
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.code).toBe("TOKEN_EXPIRED");
  });

  it("expires the whole session even with a live-looking token", () => {
    const { machine, session, now, advance } = setup({ sessionTtlMs: 120_000 });
    const redeemed = machine.redeemClaim(session.claimCode, now());
    if (!redeemed.ok) throw new Error("claim failed");
    advance(120_001);
    const result = machine.authorize(redeemed.claim.agentToken, now());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SESSION_EXPIRED");
  });

  it("pauses and resumes; revoke is terminal", () => {
    const { machine, session, now } = setup();
    const redeemed = machine.redeemClaim(session.claimCode, now());
    if (!redeemed.ok) throw new Error("claim failed");
    const token = redeemed.claim.agentToken;

    machine.pause();
    let auth = machine.authorize(token, now());
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.code).toBe("SESSION_PAUSED");

    machine.resume();
    auth = machine.authorize(token, now());
    expect(auth.ok).toBe(true);

    machine.revoke();
    auth = machine.authorize(token, now());
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.code).toBe("SESSION_REVOKED");
  });

  it("enforces scopes on an authorized session", () => {
    const { machine } = setup();
    expect(machine.assertScope(scopes, "circuit.snapshot").ok).toBe(true);
    expect(machine.assertScope(scopes, "circuit.edit.connectivity").ok).toBe(
      false,
    );
  });

  it("serves the cached result for a repeated requestId and never re-runs", () => {
    const { machine, now, advance } = setup();
    const begin = machine.beginRequest("request-1", now());
    expect(begin.kind).toBe("proceed");

    machine.completeRequest("request-1", { revision: 7, ok: true }, now());

    // A retry within the cache TTL returns the same terminal result.
    advance(1_000);
    const replay = machine.beginRequest("request-1", now());
    expect(replay.kind).toBe("cached");
    if (replay.kind === "cached")
      expect(replay.result).toEqual({ revision: 7, ok: true });

    // A new requestId proceeds normally.
    const next = machine.beginRequest("request-2", now());
    expect(next.kind).toBe("proceed");
  });

  it("rate-limits requests over the configured window", () => {
    const { machine, now } = setup({
      rateLimit: { windowMs: 60_000, maxRequests: 3 },
    });
    expect(machine.beginRequest("a", now()).kind).toBe("proceed");
    expect(machine.beginRequest("b", now()).kind).toBe("proceed");
    expect(machine.beginRequest("c", now()).kind).toBe("proceed");
    const limited = machine.beginRequest("d", now());
    expect(limited.kind).toBe("rejected");
    if (limited.kind === "rejected") expect(limited.code).toBe("RATE_LIMITED");
  });

  it("enforces the relay request-size ceiling", () => {
    const { machine } = setup({ maxRequestBytes: 128 });
    expect(machine.checkSize(100).ok).toBe(true);
    const tooLarge = machine.checkSize(129);
    expect(tooLarge.ok).toBe(false);
    if (!tooLarge.ok) expect(tooLarge.code).toBe("REQUEST_TOO_LARGE");
  });

  it("revokes the session on Project replacement and invalidates the token", () => {
    const { machine, session, now } = setup();
    const redeemed = machine.redeemClaim(session.claimCode, now());
    if (!redeemed.ok) throw new Error("claim failed");
    const token = redeemed.claim.agentToken;

    machine.replaceProject();
    expect(machine.statusAt(now())).toBe("revoked");

    const auth = machine.authorize(token, now());
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.code).toBe("SESSION_REVOKED");
  });

  it("compares secrets in constant time for equal-length inputs", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
    expect(constantTimeEqual("abc123", "abc1234")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
