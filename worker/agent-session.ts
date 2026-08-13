import {
  AGENT_SESSION_PROTOCOL_VERSION,
  AgentCircuitResponseSchema,
  AgentCircuitRequestSchema,
  DEFAULT_AGENT_SESSION_LIMITS,
  AgentSessionEventSchema,
  AgentSessionMachine,
  AgentSessionMessageSchema,
  agentEditCategory,
  agentCircuitOpenApi,
  type AgentCircuitRequest,
  type AgentSessionEvent,
  type AgentSessionLimits,
  type AgentSessionScope,
  type AgentTransportErrorCode,
  type PersistedAgentSessionState,
} from "@icm/agent-adapter";

const SESSION_STATE_KEY = "agent-session-v1";
const EDITOR_SOCKET_TAG = "editor";
const EDITOR_PROTOCOL = "icm-agent-session";
const FORWARD_TIMEOUT_MS = 30_000;
const EXPIRY_WARNING_MS = 60_000;
const CREATE_BODY_LIMIT = 64_000;
const CLAIM_BODY_LIMIT = 8_000;

export interface AgentRelayConfig {
  allowedOrigin: string | null;
  limits: AgentSessionLimits;
}

export interface RelayError {
  ok: false;
  error: { code: AgentTransportErrorCode; message: string };
}

export type AgentSessionNamespaceLike = {
  getByName(name: string): {
    fetch(input: string | Request, init?: RequestInit): Promise<Response>;
  };
};

export interface AgentSessionRouterEnv {
  AGENT_SESSION: AgentSessionNamespaceLike;
  AGENT_ALLOWED_ORIGIN?: string;
}

type DurableStorageLike = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  deleteAll?(): Promise<void>;
  setAlarm?(scheduledTime: number): Promise<void>;
};

type DurableStateLike = {
  storage: DurableStorageLike;
  blockConcurrencyWhile?(callback: () => Promise<void>): void;
  acceptWebSocket?(socket: WebSocket, tags?: string[]): void;
  getWebSockets?(tag?: string): WebSocket[];
};

type AgentSessionEnv = {
  AGENT_ALLOWED_ORIGIN?: string;
};

type WebSocketPairShape = { 0: WebSocket; 1: WebSocket };
type WebSocketPairConstructor = new () => WebSocketPairShape;

type PendingForward = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export function relayHeaders(allowedOrigin: string | null): Headers {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  if (allowedOrigin !== null) {
    headers.set("access-control-allow-origin", allowedOrigin);
    headers.set("vary", "Origin");
  }
  return headers;
}

function requestOriginAllowed(
  request: Request,
  allowedOrigin: string,
): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === allowedOrigin;
}

async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  const body = await readBoundedText(request, maxBytes);
  if (!body.ok) return { ok: false, tooLarge: true };
  try {
    return { ok: true, value: JSON.parse(body.text) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

/** Route the public `/api/agent/*` resource surface to one session DO. */
export async function routeAgentSessionRequest(
  request: Request,
  env: AgentSessionRouterEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/agent/")) return null;
  const allowedOrigin = env.AGENT_ALLOWED_ORIGIN ?? url.origin;
  if (!requestOriginAllowed(request, allowedOrigin)) {
    return jsonResponse(
      errorBody("UNAUTHORIZED_ORIGIN", errorMessage("UNAUTHORIZED_ORIGIN")),
      403,
      allowedOrigin,
    );
  }
  if (request.method === "OPTIONS") {
    const headers = relayHeaders(allowedOrigin);
    headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    headers.set(
      "access-control-allow-headers",
      "authorization, content-type, x-editor-secret",
    );
    return new Response(null, { status: 204, headers });
  }
  if (request.method === "GET" && url.pathname === "/api/agent/openapi.json") {
    return jsonResponse(agentCircuitOpenApi, 200, allowedOrigin);
  }

  if (request.method === "POST" && url.pathname === "/api/agent/sessions") {
    const parsedBody = await readBoundedJson(request, CREATE_BODY_LIMIT);
    if (!parsedBody.ok) {
      return jsonResponse(
        { error: parsedBody.tooLarge ? "Request too large" : "Invalid JSON" },
        parsedBody.tooLarge ? 413 : 400,
        allowedOrigin,
      );
    }
    const body = parsedBody.value as Record<string, unknown>;
    const sessionId = crypto.randomUUID();
    const response = await env.AGENT_SESSION.getByName(sessionId).fetch(
      "https://agent-session.internal/create",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, sessionId }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      session?: Record<string, unknown> & { claimCode?: unknown };
    } | null;
    if (!response.ok || !result?.session) {
      return jsonResponse(
        result ?? { error: "Session creation failed" },
        response.status,
        allowedOrigin,
      );
    }
    const rawClaim = result.session.claimCode;
    return jsonResponse(
      {
        ...result,
        session: {
          ...result.session,
          claimCode:
            typeof rawClaim === "string"
              ? `${sessionId}.${rawClaim}`
              : rawClaim,
        },
      },
      200,
      allowedOrigin,
    );
  }

  if (request.method === "POST" && url.pathname === "/api/agent/claims") {
    const parsedBody = await readBoundedJson(request, CLAIM_BODY_LIMIT);
    if (!parsedBody.ok) {
      return jsonResponse(
        errorBody(
          parsedBody.tooLarge ? "REQUEST_TOO_LARGE" : "CLAIM_INVALID",
          errorMessage(
            parsedBody.tooLarge ? "REQUEST_TOO_LARGE" : "CLAIM_INVALID",
          ),
        ),
        parsedBody.tooLarge ? 413 : 401,
        allowedOrigin,
      );
    }
    const body = parsedBody.value as {
      claimCode?: unknown;
    };
    const claimCode = typeof body?.claimCode === "string" ? body.claimCode : "";
    const separator = claimCode.indexOf(".");
    if (separator <= 0) {
      return jsonResponse(
        errorBody("CLAIM_INVALID", errorMessage("CLAIM_INVALID")),
        401,
        allowedOrigin,
      );
    }
    const sessionId = claimCode.slice(0, separator);
    const code = claimCode.slice(separator + 1);
    return env.AGENT_SESSION.getByName(sessionId).fetch(
      "https://agent-session.internal/claim",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      },
    );
  }

  const match =
    /^\/api\/agent\/sessions\/([^/]+)(?:\/(circuit|events|editor|control))?$/u.exec(
      url.pathname,
    );
  if (!match) return jsonResponse({ error: "Not found" }, 404, allowedOrigin);
  const [, sessionId, resource] = match;
  const internalPath = resource ? `/${resource}` : "/session";
  const headers = new Headers(request.headers);
  headers.delete("host");
  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await readBoundedText(
      request,
      DEFAULT_AGENT_SESSION_LIMITS.maxRequestBytes,
    );
    if (!body.ok) {
      return jsonResponse(
        errorBody("REQUEST_TOO_LARGE", errorMessage("REQUEST_TOO_LARGE")),
        413,
        allowedOrigin,
      );
    }
    init.body = body.text;
  }
  return env.AGENT_SESSION.getByName(sessionId!).fetch(
    new Request(`https://agent-session.internal${internalPath}`, init),
  );
}

function jsonResponse(
  body: unknown,
  status = 200,
  allowedOrigin: string | null = null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: relayHeaders(allowedOrigin),
  });
}

function errorBody(code: AgentTransportErrorCode, message: string): RelayError {
  return { ok: false, error: { code, message } };
}

function transportStatus(code: AgentTransportErrorCode): number {
  switch (code) {
    case "TOKEN_INVALID":
    case "TOKEN_EXPIRED":
    case "CLAIM_INVALID":
      return 401;
    case "TOKEN_SCOPE_INSUFFICIENT":
      return 403;
    case "SESSION_NOT_FOUND":
      return 404;
    case "REQUEST_TOO_LARGE":
    case "MESSAGE_TOO_LARGE":
      return 413;
    case "RATE_LIMITED":
      return 429;
    case "EDITOR_OFFLINE":
    case "EDITOR_DISCONNECTED":
      return 503;
    case "REQUEST_TIMEOUT":
      return 504;
    default:
      return 409;
  }
}

function errorMessage(code: AgentTransportErrorCode): string {
  const messages: Record<AgentTransportErrorCode, string> = {
    SESSION_NOT_FOUND: "Session is unknown or expired",
    SESSION_EXPIRED: "Session has expired",
    SESSION_PAUSED: "Session is paused",
    SESSION_REVOKED: "Session has been revoked",
    PROJECT_REPLACED: "The browser opened a different Project",
    CLAIM_INVALID: "Claim code is unknown or malformed",
    CLAIM_EXPIRED: "Claim code has expired",
    CLAIM_ALREADY_USED: "Claim code has already been used",
    TOKEN_INVALID: "Bearer token is missing or unknown",
    TOKEN_EXPIRED: "Bearer token has expired",
    TOKEN_SCOPE_INSUFFICIENT: "The token does not grant this operation",
    EDITOR_OFFLINE: "The authorized browser editor is offline",
    EDITOR_DISCONNECTED: "The browser editor disconnected",
    REQUEST_TOO_LARGE: "Request exceeds the relay ceiling",
    MESSAGE_TOO_LARGE: "Browser message exceeds the relay ceiling",
    RATE_LIMITED: "Too many requests; back off and retry",
    REQUEST_IN_PROGRESS: "The same request is already in progress",
    REQUEST_ID_REUSED: "The requestId was reused with a different payload",
    REQUEST_RESULT_UNAVAILABLE:
      "The request already ran but its terminal response is no longer cached",
    REQUEST_TIMEOUT: "The browser did not complete the request in time",
    UNSUPPORTED_PROTOCOL_VERSION: "Unsupported session protocol version",
    UNAUTHORIZED_ORIGIN: "Origin is not authorized",
  };
  return messages[code];
}

function bearerToken(request: Request): string {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function editorSecret(request: Request): string {
  const protocols = (request.headers.get("sec-websocket-protocol") ?? "")
    .split(",")
    .map((value) => value.trim());
  if (protocols[0] === EDITOR_PROTOCOL && protocols[1]) return protocols[1];
  return request.headers.get("x-editor-secret") ?? "";
}

function operationScopes(request: AgentCircuitRequest): AgentSessionScope[] {
  switch (request.operation) {
    case "capabilities":
      return [];
    case "snapshot":
    case "query":
      return [
        "circuit.snapshot",
        ...(request.includeSourceSpans
          ? ["circuit.source-spans" as const]
          : []),
      ];
    case "render":
      return ["circuit.render"];
    case "transact":
      if (request.wireIntent) {
        return ["circuit.edit.geometry", "circuit.edit.connectivity"];
      }
      return [
        ...new Set(
          (request.edits ?? []).flatMap((edit) => {
            const category = agentEditCategory(edit.kind);
            return category === "unsupported"
              ? []
              : ([`circuit.edit.${category}`] as AgentSessionScope[]);
          }),
        ),
      ];
  }
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function redeemClaimResponse(
  machine: AgentSessionMachine,
  code: string,
  now: number,
):
  | {
      ok: true;
      agentToken: string;
      tokenExpiresAt: number;
      scopes: string[];
      projectId: string;
      documentIds: string[];
    }
  | RelayError {
  const result = machine.redeemClaim(code, now);
  return result.ok
    ? {
        ok: true,
        agentToken: result.claim.agentToken,
        tokenExpiresAt: result.claim.tokenExpiresAt,
        scopes: [...result.claim.scopes],
        projectId: machine.projectId,
        documentIds: machine.documentIds,
      }
    : errorBody(result.code, errorMessage(result.code));
}

export async function forwardCircuitRequest(
  machine: AgentSessionMachine,
  token: string,
  requestId: string,
  payloadBytes: number,
  payload: unknown,
  now: number,
  forward: (payload: unknown) => Promise<unknown>,
  payloadHash = requestId,
): Promise<{ ok: true; result: unknown } | RelayError> {
  const auth = machine.authorize(token, now);
  if (!auth.ok) return errorBody(auth.code, errorMessage(auth.code));
  const size = machine.checkSize(payloadBytes);
  if (!size.ok) return errorBody(size.code, errorMessage(size.code));
  const begin = machine.beginRequest(requestId, now, payloadHash);
  if (begin.kind === "rejected") {
    return errorBody(begin.code, errorMessage(begin.code));
  }
  if (begin.kind === "cached") return { ok: true, result: begin.result };
  try {
    const result = await forward(payload);
    machine.completeRequest(requestId, result, Date.now());
    return { ok: true, result };
  } catch (error) {
    machine.failRequest(requestId);
    throw error;
  }
}

export function revokeSession(machine: AgentSessionMachine): { ok: true } {
  machine.revoke();
  return { ok: true };
}

/** Cloudflare Durable Object owning one temporary Agent session. */
export class AgentSessionDO {
  private machine: AgentSessionMachine | null = null;
  private readonly ready: Promise<void>;
  private creating = false;
  private readonly pendingForwards = new Map<string, PendingForward>();
  private readonly eventSubscribers = new Set<
    ReadableStreamDefaultController<Uint8Array>
  >();

  constructor(
    private readonly state: DurableStateLike,
    private readonly env: AgentSessionEnv,
  ) {
    this.ready = this.initialize();
    this.state.blockConcurrencyWhile?.(() => this.ready);
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    const allowedOrigin = this.env.AGENT_ALLOWED_ORIGIN ?? null;
    if (request.method === "POST" && url.pathname === "/create") {
      return this.create(request, allowedOrigin);
    }
    const machine = await this.loadMachine();
    if (!machine) {
      return jsonResponse(
        errorBody("SESSION_NOT_FOUND", errorMessage("SESSION_NOT_FOUND")),
        404,
        allowedOrigin,
      );
    }
    if (request.method === "POST" && url.pathname === "/claim") {
      return this.claim(request, machine, allowedOrigin);
    }
    if (url.pathname === "/editor") {
      return this.connectEditor(request, machine);
    }
    if (request.method === "POST" && url.pathname === "/circuit") {
      return this.circuit(request, machine, allowedOrigin);
    }
    if (request.method === "GET" && url.pathname === "/events") {
      return this.events(request, machine, allowedOrigin);
    }
    if (request.method === "POST" && url.pathname === "/control") {
      return this.control(request, machine, allowedOrigin);
    }
    if (request.method === "DELETE" && url.pathname === "/session") {
      return this.disconnect(request, machine, allowedOrigin);
    }
    return jsonResponse({ error: "Not found" }, 404, allowedOrigin);
  }

  async webSocketMessage(_socket: WebSocket, message: string | ArrayBuffer) {
    await this.ready;
    const machine = await this.loadMachine();
    if (!machine) return;
    const text =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    const size = machine.checkMessageSize(
      new TextEncoder().encode(text).byteLength,
    );
    if (size && !size.ok) {
      for (const [requestId, pending] of this.pendingForwards) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(size.code));
        machine.failRequest(requestId, false);
      }
      this.pendingForwards.clear();
      await this.persist();
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return;
    }
    const parsed = AgentSessionMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    const envelope = parsed.data;
    if (envelope.sessionId !== machine.sessionId) return;
    if (envelope.kind === "circuit-response") {
      const pending = this.pendingForwards.get(envelope.requestId);
      if (!pending) return;
      const response = AgentCircuitResponseSchema.safeParse(envelope.payload);
      if (!response.success) {
        clearTimeout(pending.timeout);
        this.pendingForwards.delete(envelope.requestId);
        pending.reject(new Error("INVALID_BROWSER_RESPONSE"));
        machine.failRequest(envelope.requestId, false);
        await this.persist();
        return;
      }
      clearTimeout(pending.timeout);
      this.pendingForwards.delete(envelope.requestId);
      pending.resolve(response.data);
    } else if (envelope.kind === "event") {
      const event = AgentSessionEventSchema.safeParse(envelope.payload);
      if (event.success && event.data.sessionId === machine.sessionId) {
        this.emit(event.data);
      }
    }
  }

  async webSocketClose(socket?: WebSocket) {
    await this.ready;
    const replacement = (
      this.state.getWebSockets?.(EDITOR_SOCKET_TAG) ?? []
    ).some(
      (candidate) =>
        candidate !== socket && candidate.readyState === WebSocket.OPEN,
    );
    if (replacement) return;
    this.emit({
      type: "editor.offline",
      sessionId: this.machine?.sessionId ?? "unknown",
    });
    for (const [requestId, pending] of this.pendingForwards) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("EDITOR_DISCONNECTED"));
      this.machine?.failRequest(requestId, false);
    }
    this.pendingForwards.clear();
    const status = this.machine?.statusAt(Date.now());
    if (status === "revoked" || status === "expired") {
      await this.state.storage.deleteAll?.();
    } else {
      await this.persist();
    }
  }

  async alarm(): Promise<void> {
    await this.ready;
    const machine = await this.loadMachine();
    if (machine && Date.now() < machine.expiresAt) {
      const event: AgentSessionEvent = {
        type: "session.expiring",
        sessionId: machine.sessionId,
        expiresAt: new Date(machine.expiresAt).toISOString(),
      };
      this.emit(event);
      this.notifyEditor(event);
      await this.state.storage.setAlarm?.(machine.expiresAt);
      return;
    }
    if (machine) {
      machine.revoke();
      this.emit({ type: "session.revoked", sessionId: machine.sessionId });
      this.notifyEditor({
        type: "session.revoked",
        sessionId: machine.sessionId,
      });
    }
    for (const pending of this.pendingForwards.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("SESSION_EXPIRED"));
    }
    this.pendingForwards.clear();
    for (const subscriber of this.eventSubscribers) subscriber.close();
    this.eventSubscribers.clear();
    await this.state.storage.deleteAll?.();
    this.machine = null;
  }

  private async create(
    request: Request,
    allowedOrigin: string | null,
  ): Promise<Response> {
    if (this.creating || this.machine) {
      return jsonResponse(
        { error: "Session already exists" },
        409,
        allowedOrigin,
      );
    }
    this.creating = true;
    try {
      const body = (await request.json().catch(() => null)) as {
        sessionId?: unknown;
        projectSessionId?: unknown;
        projectId?: unknown;
        documentIds?: unknown;
        scopes?: unknown;
      } | null;
      if (
        !body ||
        typeof body.sessionId !== "string" ||
        typeof body.projectSessionId !== "string" ||
        typeof body.projectId !== "string" ||
        !Array.isArray(body.documentIds) ||
        !body.documentIds.every((value) => typeof value === "string") ||
        !Array.isArray(body.scopes)
      ) {
        return jsonResponse(
          { error: "Invalid session request" },
          400,
          allowedOrigin,
        );
      }
      const scopes = body.scopes.filter(
        (value): value is AgentSessionScope =>
          typeof value === "string" &&
          [
            "circuit.snapshot",
            "circuit.render",
            "circuit.source-spans",
            "circuit.edit.geometry",
            "circuit.edit.connectivity",
            "circuit.edit.presentation",
          ].includes(value),
      );
      if (
        scopes.length !== body.scopes.length ||
        body.documentIds.length === 0
      ) {
        return jsonResponse(
          { error: "Invalid session scopes or Documents" },
          400,
          allowedOrigin,
        );
      }
      const created = AgentSessionMachine.create({
        sessionId: body.sessionId,
        projectSessionId: body.projectSessionId,
        projectId: body.projectId,
        documentIds: body.documentIds,
        scopes,
        now: Date.now(),
        random: () => crypto.randomUUID(),
      });
      this.machine = created.machine;
      await this.persist();
      await this.state.storage.setAlarm?.(
        Math.max(Date.now(), created.session.expiresAt - EXPIRY_WARNING_MS),
      );
      return jsonResponse(
        { ok: true, session: created.session },
        200,
        allowedOrigin,
      );
    } finally {
      this.creating = false;
    }
  }

  private async claim(
    request: Request,
    machine: AgentSessionMachine,
    allowedOrigin: string | null,
  ): Promise<Response> {
    const body = (await request.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    const code = typeof body?.code === "string" ? body.code : "";
    const result = redeemClaimResponse(machine, code, Date.now());
    await this.persist();
    if (!result.ok) {
      return jsonResponse(
        result,
        transportStatus(result.error.code),
        allowedOrigin,
      );
    }
    this.emit({ type: "session.ready", sessionId: machine.sessionId });
    this.notifyEditor({ type: "session.ready", sessionId: machine.sessionId });
    return jsonResponse(
      { ...result, sessionId: machine.sessionId },
      200,
      allowedOrigin,
    );
  }

  private connectEditor(
    request: Request,
    machine: AgentSessionMachine,
  ): Response {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return jsonResponse({ error: "WebSocket upgrade required" }, 426);
    }
    if (!machine.authorizeEditor(editorSecret(request))) {
      return jsonResponse(
        errorBody("TOKEN_INVALID", "Invalid editor secret"),
        401,
      );
    }
    const Pair = (
      globalThis as typeof globalThis & {
        WebSocketPair?: WebSocketPairConstructor;
      }
    ).WebSocketPair;
    if (!Pair || !this.state.acceptWebSocket) {
      return jsonResponse({ error: "WebSocket runtime unavailable" }, 501);
    }
    const pair = new Pair();
    const previousSockets = this.state.getWebSockets?.(EDITOR_SOCKET_TAG) ?? [];
    this.state.acceptWebSocket(pair[1], [EDITOR_SOCKET_TAG]);
    this.emit({ type: "editor.online", sessionId: machine.sessionId });
    for (const socket of previousSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(4001, "editor transport replaced");
      }
    }
    if (machine.claimed) {
      pair[1].send(
        JSON.stringify({
          protocolVersion: AGENT_SESSION_PROTOCOL_VERSION,
          sessionId: machine.sessionId,
          messageId: crypto.randomUUID(),
          requestId: `event-${crypto.randomUUID()}`,
          sentAt: new Date().toISOString(),
          kind: "event",
          payload: { type: "session.ready", sessionId: machine.sessionId },
        }),
      );
    }
    return new Response(null, {
      status: 101,
      headers: { "sec-websocket-protocol": EDITOR_PROTOCOL },
      webSocket: pair[0],
    } as ResponseInit & { webSocket: WebSocket });
  }

  private async circuit(
    request: Request,
    machine: AgentSessionMachine,
    allowedOrigin: string | null,
  ): Promise<Response> {
    const raw = await request.text();
    const size = machine.checkSize(new TextEncoder().encode(raw).byteLength);
    if (!size.ok) {
      return jsonResponse(
        errorBody(size.code, errorMessage(size.code)),
        transportStatus(size.code),
        allowedOrigin,
      );
    }
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return jsonResponse(
        { error: "Invalid Circuit request" },
        400,
        allowedOrigin,
      );
    }
    const parsed = AgentCircuitRequestSchema.safeParse(input);
    if (!parsed.success)
      return jsonResponse(
        { error: "Invalid Circuit request" },
        400,
        allowedOrigin,
      );
    const circuitRequest = parsed.data;
    const auth = machine.authorize(bearerToken(request), Date.now());
    if (!auth.ok) {
      return jsonResponse(
        errorBody(auth.code, errorMessage(auth.code)),
        transportStatus(auth.code),
        allowedOrigin,
      );
    }
    const scopeAllowed = operationScopes(circuitRequest).every(
      (required) => machine.assertScope(auth.session.scopes, required).ok,
    );
    if (!scopeAllowed) {
      return jsonResponse(
        errorBody(
          "TOKEN_SCOPE_INSUFFICIENT",
          errorMessage("TOKEN_SCOPE_INSUFFICIENT"),
        ),
        403,
        allowedOrigin,
      );
    }
    if ("documentId" in circuitRequest) {
      const requestDocumentId = circuitRequest.documentId;
      if (requestDocumentId !== undefined) {
        const document = machine.assertDocument(
          machine.projectId,
          requestDocumentId,
        );
        if (!document.ok) {
          return jsonResponse(
            errorBody(
              document.code,
              "Document is outside the authorized session",
            ),
            403,
            allowedOrigin,
          );
        }
      }
    }
    const payloadHash = await sha256Text(raw);
    const begin = machine.beginRequest(
      circuitRequest.requestId,
      Date.now(),
      payloadHash,
    );
    if (begin.kind === "cached")
      return jsonResponse(begin.result, 200, allowedOrigin);
    if (begin.kind === "rejected") {
      return jsonResponse(
        errorBody(begin.code, errorMessage(begin.code)),
        transportStatus(begin.code),
        allowedOrigin,
      );
    }
    await this.persist();
    this.emit({
      type: "operation.started",
      sessionId: machine.sessionId,
      requestId: circuitRequest.requestId,
    });
    try {
      const result = await this.forwardToEditor(machine, circuitRequest);
      machine.completeRequest(circuitRequest.requestId, result, Date.now());
      await this.persist();
      this.emit({
        type: "operation.completed",
        sessionId: machine.sessionId,
        requestId: circuitRequest.requestId,
      });
      return jsonResponse(result, 200, allowedOrigin);
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "";
      const code: AgentTransportErrorCode =
        errorCode === "REQUEST_TIMEOUT" || errorCode === "MESSAGE_TOO_LARGE"
          ? errorCode
          : errorCode === "EDITOR_OFFLINE"
            ? "EDITOR_OFFLINE"
            : "EDITOR_DISCONNECTED";
      machine.failRequest(circuitRequest.requestId, code === "EDITOR_OFFLINE");
      await this.persist();
      this.emit({
        type: "operation.failed",
        sessionId: machine.sessionId,
        requestId: circuitRequest.requestId,
      });
      return jsonResponse(
        errorBody(code, errorMessage(code)),
        transportStatus(code),
        allowedOrigin,
      );
    }
  }

  private async events(
    request: Request,
    machine: AgentSessionMachine,
    allowedOrigin: string | null,
  ): Promise<Response> {
    const auth = machine.authorize(bearerToken(request), Date.now());
    if (!auth.ok)
      return jsonResponse(
        errorBody(auth.code, errorMessage(auth.code)),
        transportStatus(auth.code),
        allowedOrigin,
      );
    const encoder = new TextEncoder();
    let subscriber: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        subscriber = controller;
        this.eventSubscribers.add(controller);
        controller.enqueue(encoder.encode(": connected\n\n"));
      },
      cancel: () => {
        if (subscriber) this.eventSubscribers.delete(subscriber);
      },
    });
    const headers = relayHeaders(allowedOrigin);
    headers.set("content-type", "text/event-stream");
    headers.set("connection", "keep-alive");
    return new Response(stream, { headers });
  }

  private async control(
    request: Request,
    machine: AgentSessionMachine,
    allowedOrigin: string | null,
  ): Promise<Response> {
    if (
      !machine.authorizeEditor(request.headers.get("x-editor-secret") ?? "")
    ) {
      return jsonResponse(
        errorBody("TOKEN_INVALID", "Invalid editor secret"),
        401,
        allowedOrigin,
      );
    }
    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
    } | null;
    if (body?.action === "pause") machine.pause();
    else if (body?.action === "resume") machine.resume();
    else if (body?.action === "revoke") machine.revoke();
    else if (body?.action === "replace-project") machine.replaceProject();
    else
      return jsonResponse(
        { error: "Unknown control action" },
        400,
        allowedOrigin,
      );
    if (body.action === "revoke" || body.action === "replace-project") {
      await this.state.storage.deleteAll?.();
    } else {
      await this.persist();
    }
    const type =
      body.action === "pause"
        ? "session.paused"
        : body.action === "replace-project"
          ? "document.replaced"
          : body.action === "revoke"
            ? "session.revoked"
            : "session.ready";
    this.emit({ type, sessionId: machine.sessionId } as AgentSessionEvent);
    return jsonResponse(
      { ok: true, status: machine.statusAt(Date.now()) },
      200,
      allowedOrigin,
    );
  }

  private async disconnect(
    request: Request,
    machine: AgentSessionMachine,
    allowedOrigin: string | null,
  ): Promise<Response> {
    const token = bearerToken(request);
    const editorAuthorized = machine.authorizeEditor(
      request.headers.get("x-editor-secret") ?? "",
    );
    if (!editorAuthorized && !machine.authorize(token, Date.now()).ok) {
      return jsonResponse(
        errorBody("TOKEN_INVALID", errorMessage("TOKEN_INVALID")),
        401,
        allowedOrigin,
      );
    }
    machine.revoke();
    this.emit({ type: "session.revoked", sessionId: machine.sessionId });
    this.notifyEditor({
      type: "session.revoked",
      sessionId: machine.sessionId,
    });
    await this.state.storage.deleteAll?.();
    return new Response(null, {
      status: 204,
      headers: relayHeaders(allowedOrigin),
    });
  }

  private async forwardToEditor(
    machine: AgentSessionMachine,
    payload: AgentCircuitRequest,
  ): Promise<unknown> {
    const sockets = this.state.getWebSockets?.(EDITOR_SOCKET_TAG) ?? [];
    const socket = sockets.find(
      (candidate) => candidate.readyState === WebSocket.OPEN,
    );
    if (!socket) throw new Error("EDITOR_OFFLINE");
    const requestId = payload.requestId;
    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingForwards.delete(requestId);
        reject(new Error("REQUEST_TIMEOUT"));
      }, FORWARD_TIMEOUT_MS);
      this.pendingForwards.set(requestId, { resolve, reject, timeout });
    });
    socket.send(
      JSON.stringify({
        protocolVersion: AGENT_SESSION_PROTOCOL_VERSION,
        sessionId: machine.sessionId,
        messageId: crypto.randomUUID(),
        requestId,
        sentAt: new Date().toISOString(),
        kind: "circuit-request",
        payload,
      }),
    );
    return response;
  }

  private emit(event: AgentSessionEvent): void {
    const encoded = new TextEncoder().encode(
      `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
    );
    for (const subscriber of [...this.eventSubscribers]) {
      try {
        subscriber.enqueue(encoded);
      } catch {
        this.eventSubscribers.delete(subscriber);
      }
    }
  }

  private notifyEditor(event: AgentSessionEvent): void {
    const sockets = this.state.getWebSockets?.(EDITOR_SOCKET_TAG) ?? [];
    for (const socket of sockets) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      socket.send(
        JSON.stringify({
          protocolVersion: AGENT_SESSION_PROTOCOL_VERSION,
          sessionId: event.sessionId,
          messageId: crypto.randomUUID(),
          requestId: `event-${crypto.randomUUID()}`,
          sentAt: new Date().toISOString(),
          kind: "event",
          payload: event,
        }),
      );
    }
  }

  private async loadMachine(): Promise<AgentSessionMachine | null> {
    if (this.machine) return this.machine;
    const stored =
      await this.state.storage.get<PersistedAgentSessionState>(
        SESSION_STATE_KEY,
      );
    if (!stored) return null;
    this.machine = AgentSessionMachine.restore(stored, () =>
      crypto.randomUUID(),
    );
    return this.machine;
  }

  private async initialize(): Promise<void> {
    const stored =
      await this.state.storage.get<PersistedAgentSessionState>(
        SESSION_STATE_KEY,
      );
    if (stored) {
      this.machine = AgentSessionMachine.restore(stored, () =>
        crypto.randomUUID(),
      );
    }
  }

  private async persist(): Promise<void> {
    if (!this.machine) return;
    const status = this.machine.statusAt(Date.now());
    if (status === "revoked" || status === "expired") {
      await this.state.storage.deleteAll?.();
      return;
    }
    await this.state.storage.put(SESSION_STATE_KEY, this.machine.serialize());
  }
}
