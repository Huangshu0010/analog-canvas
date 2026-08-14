import {
  AgentCircuitResponseSchema,
  type AgentCircuitRequest,
  type AgentCircuitResponse,
} from "@icm/agent-adapter";
import {
  invalidResponseFailure,
  networkFailure,
  transportFailure,
} from "./errors.js";

export interface ClaimSuccess {
  sessionId: string;
  /** Secret bearer. Stays inside the Helper; never returned to a model. */
  agentToken: string;
  tokenExpiresAt: number;
  scopes: string[];
  projectId: string;
  documentIds: string[];
}

export interface AgentHttpClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
}

interface ClaimResponseBody {
  ok?: boolean;
  agentToken?: unknown;
  tokenExpiresAt?: unknown;
  scopes?: unknown;
  projectId?: unknown;
  documentIds?: unknown;
  error?: { code?: unknown; message?: unknown };
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}${path}`;
}

/**
 * Thin HTTP client for the public four-operation API. It knows the three
 * endpoints a Helper needs (claim, circuit, kit/openapi are not its concern),
 * enforces a request timeout, and normalizes every failure into an
 * `AgentSessionError` so callers never inspect raw status codes.
 */
export class AgentHttpClient {
  private readonly baseUrlValue: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: AgentHttpClientOptions) {
    this.baseUrlValue = options.baseUrl;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.requestTimeoutMs ?? 30_000;
  }

  get baseUrl(): string {
    return this.baseUrlValue;
  }

  /**
   * Redeem a `<sessionId>.<code>` claim code. The session ID travels in the
   * claim code prefix, so the response alone is sufficient afterwards.
   */
  async claim(claimCode: string): Promise<ClaimSuccess> {
    const response = await this.send("/api/agent/claims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimCode }),
    });
    const body = (await response
      .json()
      .catch(() => null)) as ClaimResponseBody | null;
    if (response.ok && body?.ok === true) {
      if (
        typeof body.agentToken !== "string" ||
        typeof body.tokenExpiresAt !== "number" ||
        !Array.isArray(body.scopes) ||
        typeof body.projectId !== "string" ||
        !Array.isArray(body.documentIds)
      ) {
        throw invalidResponseFailure(
          "Claim response is missing required fields",
        );
      }
      return {
        sessionId: claimCode.slice(0, claimCode.indexOf(".")),
        agentToken: body.agentToken,
        tokenExpiresAt: body.tokenExpiresAt,
        scopes: body.scopes.map((scope) => String(scope)),
        projectId: body.projectId,
        documentIds: body.documentIds.map((id) => String(id)),
      };
    }
    throw this.transportError(response.status, body);
  }

  /**
   * Invoke one four-operation request. A 200 response is parsed against the
   * canonical response schema; every non-200 response is normalized to an
   * `AgentSessionError`.
   */
  async circuit(
    sessionId: string,
    agentToken: string,
    request: AgentCircuitRequest,
  ): Promise<AgentCircuitResponse> {
    const response = await this.send(
      `/api/agent/sessions/${encodeURIComponent(sessionId)}/circuit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${agentToken}`,
        },
        body: JSON.stringify(request),
      },
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw this.transportError(
        response.status,
        body as ClaimResponseBody | null,
      );
    }
    const parsed = AgentCircuitResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw invalidResponseFailure("Circuit response failed schema validation");
    }
    return parsed.data;
  }

  private async send(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(joinUrl(this.baseUrl, path), {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw networkFailure(
        error instanceof Error ? error.message : "Network request failed",
      );
    }
    return response;
  }

  private transportError(
    status: number,
    body: ClaimResponseBody | null,
  ): Error {
    const code = typeof body?.error?.code === "string" ? body.error.code : "";
    const message =
      typeof body?.error?.message === "string" ? body.error.message : "";
    if (code && message) {
      return transportFailure(code, message, status);
    }
    if (status === 401) {
      return transportFailure("TOKEN_INVALID", "Unauthorized", status);
    }
    if (status === 503) {
      return transportFailure("EDITOR_OFFLINE", "Editor is offline", status);
    }
    return transportFailure(
      "HTTP_ERROR",
      `HTTP ${status}${message ? `: ${message}` : ""}`,
      status,
    );
  }
}
