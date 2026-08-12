import type { AgentSessionScope, AgentTransportErrorCode } from "./envelope.js";

/**
 * Pure, runtime-agnostic Agent session state machine (WP-WA4). All time is
 * injected (`now`, epoch ms) and all randomness is injected (`random`), so the
 * entire authorization/idempotency/expiry/limit contract is deterministic and
 * fake-time testable without the Cloudflare runtime.
 *
 * Contract source: [`docs/specs/web-agent-session.md`](../../docs/specs/web-agent-session.md).
 * The machine never inspects or persists a Project and never creates an actor or
 * edit — it only authenticates, authorizes, deduplicates, expires, and rate
 * limits. Secrets are stored as verifiers and compared in constant time.
 */

export type AgentSessionStatus = "active" | "paused" | "revoked";

export interface AgentSessionLimits {
  /** One-time claim lifetime (≤ 5 min). */
  claimTtlMs: number;
  /** Capability token lifetime. */
  tokenTtlMs: number;
  /** Whole-session lifetime; the token never outlives it. */
  sessionTtlMs: number;
  /** Hard request-body ceiling before any forward. */
  maxRequestBytes: number;
  /** Sliding request rate limit. */
  rateLimit: { windowMs: number; maxRequests: number };
  /** How long a completed requestId result is served as idempotent. */
  resultCacheTtlMs: number;
}

export const DEFAULT_AGENT_SESSION_LIMITS: AgentSessionLimits = {
  claimTtlMs: 5 * 60 * 1000,
  tokenTtlMs: 60 * 60 * 1000,
  sessionTtlMs: 60 * 60 * 1000,
  maxRequestBytes: 2_000_000,
  rateLimit: { windowMs: 60_000, maxRequests: 60 },
  resultCacheTtlMs: 5 * 60 * 1000,
};

/** Secrets returned once when a session is created. */
export interface CreatedAgentSession {
  sessionId: string;
  editorSecret: string;
  claimCode: string;
  claimExpiresAt: number;
  expiresAt: number;
}

/** A successfully redeemed claim yields a bearer token, returned once. */
export interface RedeemedAgentClaim {
  agentToken: string;
  tokenExpiresAt: number;
  scopes: AgentSessionScope[];
}

export interface AuthorizedAgent {
  sessionId: string;
  scopes: AgentSessionScope[];
  expiresAt: number;
}

export type SessionAuthorizationResult =
  | { ok: true; session: AuthorizedAgent }
  | { ok: false; code: AgentTransportErrorCode };

export type RequestBeginResult =
  | { kind: "cached"; result: unknown }
  | { kind: "proceed" }
  | { kind: "rejected"; code: AgentTransportErrorCode };

interface ClaimRecord {
  codeVerifier: string;
  expiresAt: number;
  used: boolean;
}

interface TokenRecord {
  verifier: string;
  scopes: AgentSessionScope[];
  expiresAt: number;
}

interface RateWindow {
  windowStart: number;
  count: number;
}

interface CachedResult {
  result: unknown;
  completedAt: number;
}

interface SessionInternals {
  sessionId: string;
  editorSecretVerifier: string;
  projectSessionId: string;
  projectId: string;
  documentIds: Set<string>;
  scopes: AgentSessionScope[];
  status: AgentSessionStatus;
  expiresAt: number;
  claim: ClaimRecord | null;
  token: TokenRecord | null;
  rateWindow: RateWindow;
  cache: Map<string, CachedResult>;
}

/** Constant-time string equality for equal-length high-entropy secrets. */
export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export interface CreateAgentSessionOptions {
  limits?: Partial<AgentSessionLimits>;
  projectSessionId: string;
  projectId: string;
  documentIds: readonly string[];
  scopes: readonly AgentSessionScope[];
  now: number;
  random: () => string;
}

export class AgentSessionMachine {
  private constructor(
    private readonly limits: AgentSessionLimits,
    private readonly internals: SessionInternals,
    private readonly random: () => string,
  ) {}

  /**
   * Create a session bound to an immutable `projectSessionId`, a Project
   * identity, and the authorized Document set. Plaintext secrets are returned
   * once; only verifiers are retained. The granted scopes are carried into any
   * token minted at claim redemption.
   */
  static create(options: CreateAgentSessionOptions): {
    machine: AgentSessionMachine;
    session: CreatedAgentSession;
  } {
    const limits = { ...DEFAULT_AGENT_SESSION_LIMITS, ...options.limits };
    const sessionId = options.random();
    const editorSecret = options.random();
    const claimCode = options.random();
    const claimExpiresAt = options.now + limits.claimTtlMs;
    const expiresAt = options.now + limits.sessionTtlMs;
    const machine = new AgentSessionMachine(
      limits,
      {
        sessionId,
        editorSecretVerifier: editorSecret,
        projectSessionId: options.projectSessionId,
        projectId: options.projectId,
        documentIds: new Set(options.documentIds),
        scopes: [...options.scopes],
        status: "active",
        expiresAt,
        claim: {
          codeVerifier: claimCode,
          expiresAt: claimExpiresAt,
          used: false,
        },
        token: null,
        rateWindow: { windowStart: options.now, count: 0 },
        cache: new Map(),
      },
      options.random,
    );
    return {
      machine,
      session: {
        sessionId,
        editorSecret,
        claimCode,
        claimExpiresAt,
        expiresAt,
      },
    };
  }

  get sessionId(): string {
    return this.internals.sessionId;
  }

  get projectId(): string {
    return this.internals.projectId;
  }

  /** Visible status at `now`, deriving `expired` from the session lifetime. */
  statusAt(now: number): AgentSessionStatus | "expired" {
    if (this.internals.status === "revoked") return "revoked";
    if (now >= this.internals.expiresAt) return "expired";
    return this.internals.status;
  }

  /** Authenticate the browser WebSocket channel with the editor secret. */
  authorizeEditor(secret: string): boolean {
    return constantTimeEqual(secret, this.internals.editorSecretVerifier);
  }

  /** Exchange a one-time claim code for a scoped capability token. */
  redeemClaim(
    code: string,
    now: number,
  ):
    | { ok: true; claim: RedeemedAgentClaim }
    | { ok: false; code: AgentTransportErrorCode } {
    const lifecycle = this.lifecycleCode(now);
    if (lifecycle) return { ok: false, code: lifecycle };
    const claim = this.internals.claim;
    if (!claim || !constantTimeEqual(code, claim.codeVerifier)) {
      return { ok: false, code: "CLAIM_INVALID" };
    }
    if (claim.used) return { ok: false, code: "CLAIM_ALREADY_USED" };
    if (now >= claim.expiresAt) return { ok: false, code: "CLAIM_EXPIRED" };

    claim.used = true;
    const agentToken = this.random();
    const tokenExpiresAt = Math.min(
      now + this.limits.tokenTtlMs,
      this.internals.expiresAt,
    );
    this.internals.token = {
      verifier: agentToken,
      scopes: [...this.internals.scopes],
      expiresAt: tokenExpiresAt,
    };
    return {
      ok: true,
      claim: {
        agentToken,
        tokenExpiresAt,
        scopes: this.internals.token.scopes,
      },
    };
  }

  /** Validate an Agent bearer token and return the authorized session. */
  authorize(token: string, now: number): SessionAuthorizationResult {
    const lifecycle = this.lifecycleCode(now);
    if (lifecycle) return { ok: false, code: lifecycle };
    if (this.internals.status === "paused") {
      return { ok: false, code: "SESSION_PAUSED" };
    }
    const record = this.internals.token;
    if (!record || !constantTimeEqual(token, record.verifier)) {
      return { ok: false, code: "TOKEN_INVALID" };
    }
    if (now >= record.expiresAt) return { ok: false, code: "TOKEN_EXPIRED" };
    return {
      ok: true,
      session: {
        sessionId: this.internals.sessionId,
        scopes: [...record.scopes],
        expiresAt: record.expiresAt,
      },
    };
  }

  /** Require a scope on an already-authorized session. */
  assertScope(
    scopes: readonly AgentSessionScope[],
    required: AgentSessionScope,
  ): { ok: true } | { ok: false; code: AgentTransportErrorCode } {
    return scopes.includes(required)
      ? { ok: true }
      : { ok: false, code: "TOKEN_SCOPE_INSUFFICIENT" };
  }

  /**
   * Begin a forwarded request: reject on pause/revoke/expiry/rate-limit, serve a
   * cached terminal result for a repeated `requestId`, or allow the forward to
   * proceed. Never re-runs a completed request.
   */
  beginRequest(requestId: string, now: number): RequestBeginResult {
    const lifecycle = this.lifecycleCode(now);
    if (lifecycle) return { kind: "rejected", code: lifecycle };
    if (this.internals.status === "paused") {
      return { kind: "rejected", code: "SESSION_PAUSED" };
    }
    const cached = this.internals.cache.get(requestId);
    if (cached && now - cached.completedAt < this.limits.resultCacheTtlMs) {
      return { kind: "cached", result: cached.result };
    }
    const { rateLimit } = this.limits;
    const window = this.internals.rateWindow;
    if (now - window.windowStart >= rateLimit.windowMs) {
      window.windowStart = now;
      window.count = 0;
    }
    if (window.count >= rateLimit.maxRequests) {
      return { kind: "rejected", code: "RATE_LIMITED" };
    }
    window.count += 1;
    return { kind: "proceed" };
  }

  /** Cache a terminal forwarded result for idempotent replay. */
  completeRequest(requestId: string, result: unknown, now: number): void {
    this.internals.cache.set(requestId, { result, completedAt: now });
  }

  /** Enforce the relay-level request-size ceiling. */
  checkSize(
    bytes: number,
  ): { ok: true } | { ok: false; code: AgentTransportErrorCode } {
    return bytes > this.limits.maxRequestBytes
      ? { ok: false, code: "REQUEST_TOO_LARGE" }
      : { ok: true };
  }

  pause(): void {
    if (this.internals.status === "active") this.internals.status = "paused";
  }

  resume(): void {
    if (this.internals.status === "paused") this.internals.status = "active";
  }

  revoke(): void {
    this.internals.status = "revoked";
  }

  /**
   * Project replacement terminates the session (document.replaced). The old token
   * can never address the new Project; the user must authorize a new session.
   */
  replaceProject(): void {
    this.internals.status = "revoked";
    this.internals.token = null;
    this.internals.claim = null;
  }

  private lifecycleCode(now: number): AgentTransportErrorCode | null {
    if (this.internals.status === "revoked") return "SESSION_REVOKED";
    if (now >= this.internals.expiresAt) return "SESSION_EXPIRED";
    return null;
  }
}
