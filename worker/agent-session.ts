import type {
  AgentSessionLimits,
  AgentSessionMachine,
  AgentTransportErrorCode,
} from "@icm/agent-adapter";

/**
 * Agent session relay transport (WP-WA4). The security-critical decisions live
 * in the pure {@link AgentSessionMachine}; this module is the HTTP/transport
 * glue. The browser forward is an injected async callback so the relay
 * orchestration (authorize → size → idempotency → forward → cache) is testable
 * without the Cloudflare WebSocket runtime.
 *
 * Contract: [`docs/specs/web-agent-session.md`](../docs/specs/web-agent-session.md).
 * The relay never interprets the circuit payload; `forward` carries it opaquely
 * to the browser host, which is the only place an edit can be dispatched.
 */

export interface AgentRelayConfig {
  /** Allowlisted Origin for CORS, or null to deny cross-origin requests. */
  allowedOrigin: string | null;
  limits: AgentSessionLimits;
}

/** A typed relay error ready to serialize as the JSON error body. */
export interface RelayError {
  ok: false;
  error: { code: AgentTransportErrorCode; message: string };
}

/** Headers every relay response carries. */
export function relayHeaders(allowedOrigin: string | null): Headers {
  const headers = new Headers({ "cache-control": "no-store" });
  if (allowedOrigin !== null) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("vary", "Origin");
  }
  return headers;
}

function errorBody(code: AgentTransportErrorCode, message: string): RelayError {
  return { ok: false, error: { code, message } };
}

/**
 * Redeem a one-time claim. Returns the bearer token (once) or a typed error.
 * The caller serializes the result with {@link relayHeaders}.
 */
export function redeemClaimResponse(
  machine: AgentSessionMachine,
  code: string,
  now: number,
):
  | { ok: true; agentToken: string; tokenExpiresAt: number; scopes: string[] }
  | RelayError {
  const result = machine.redeemClaim(code, now);
  if (!result.ok) {
    return errorBody(result.code, claimMessage(result.code));
  }
  return {
    ok: true,
    agentToken: result.claim.agentToken,
    tokenExpiresAt: result.claim.tokenExpiresAt,
    scopes: [...result.claim.scopes],
  };
}

/**
 * Forward one Agent circuit request to the browser host and cache its terminal
 * result by `requestId`. Authorization, request-size, idempotency, and rate
 * limits are enforced before `forward` runs; a repeated `requestId` returns the
 * cached result and never calls `forward` again.
 */
export async function forwardCircuitRequest(
  machine: AgentSessionMachine,
  token: string,
  requestId: string,
  payloadBytes: number,
  payload: unknown,
  now: number,
  forward: (payload: unknown) => Promise<unknown>,
): Promise<{ ok: true; result: unknown } | RelayError> {
  const auth = machine.authorize(token, now);
  if (!auth.ok) {
    return errorBody(auth.code, authMessage(auth.code));
  }
  const size = machine.checkSize(payloadBytes);
  if (!size.ok) {
    return errorBody("REQUEST_TOO_LARGE", "Request exceeds the relay ceiling");
  }
  const begin = machine.beginRequest(requestId, now);
  if (begin.kind === "rejected") {
    return errorBody(begin.code, beginMessage(begin.code));
  }
  if (begin.kind === "cached") {
    return { ok: true, result: begin.result };
  }
  // Proceed: forward to the browser host (the only place an edit may dispatch).
  const result = await forward(payload);
  machine.completeRequest(requestId, result, now);
  return { ok: true, result };
}

/** Revoke a session (Agent disconnect). */
export function revokeSession(machine: AgentSessionMachine): { ok: true } {
  machine.revoke();
  return { ok: true };
}

function claimMessage(code: AgentTransportErrorCode): string {
  switch (code) {
    case "CLAIM_INVALID":
      return "Claim code is unknown or malformed";
    case "CLAIM_EXPIRED":
      return "Claim code has expired";
    case "CLAIM_ALREADY_USED":
      return "Claim code has already been used";
    default:
      return lifecycleMessage(code);
  }
}

function authMessage(code: AgentTransportErrorCode): string {
  switch (code) {
    case "TOKEN_INVALID":
      return "Bearer token is missing or unknown";
    case "TOKEN_EXPIRED":
      return "Bearer token has expired";
    default:
      return lifecycleMessage(code);
  }
}

function beginMessage(code: AgentTransportErrorCode): string {
  return code === "RATE_LIMITED"
    ? "Too many requests; back off and retry"
    : lifecycleMessage(code);
}

function lifecycleMessage(code: AgentTransportErrorCode): string {
  switch (code) {
    case "SESSION_NOT_FOUND":
      return "Session is unknown or expired";
    case "SESSION_EXPIRED":
      return "Session has expired";
    case "SESSION_PAUSED":
      return "Session is paused";
    case "SESSION_REVOKED":
      return "Session has been revoked";
    default:
      return "Request rejected";
  }
}

/*
 * The Durable Object + WebSocket browser channel wraps the functions above. It
 * is written to the Cloudflare contract (one AgentSession Durable Object per
 * session; the browser connects via an authenticated WebSocket using the editor
 * secret; Agent claim/circuit/events/delete requests are handled here and
 * circuit requests are forwarded to the browser over that socket). The
 * transport cannot be executed outside the Cloudflare runtime, so it is verified
 * on deployment in WP-WA7; every authorization, size, idempotency, expiry, and
 * limit decision is delegated to the tested state machine above.
 */
