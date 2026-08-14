import type { AgentTransportErrorCode } from "@icm/agent-adapter";

/**
 * Failure categories the session client maps transport outcomes to. They drive
 * the connection state machine instead of leaking raw HTTP status codes to an
 * MCP host.
 */
export type AgentFailureCategory =
  /** The stored credential is unusable; a new human claim is required. */
  | "unrecoverable-credential"
  /** The authorized editor is not attached right now. */
  | "editor-offline"
  /** Retry with the exact same request ID and payload is allowed. */
  | "retryable"
  /** The server rejected the request shape or a protocol rule. */
  | "request-rejected"
  /** Local transport could not reach the API at all. */
  | "network";

export class AgentSessionError extends Error {
  readonly code: string;
  readonly category: AgentFailureCategory;
  readonly httpStatus: number | undefined;

  constructor(
    code: string,
    message: string,
    category: AgentFailureCategory,
    httpStatus?: number,
  ) {
    super(message);
    this.name = "AgentSessionError";
    this.code = code;
    this.category = category;
    this.httpStatus = httpStatus;
  }

  toJSON(): { code: string; message: string; category: AgentFailureCategory } {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
    };
  }
}

const UNRECOVERABLE_CREDENTIAL_CODES = new Set<string>([
  "SESSION_NOT_FOUND",
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "PROJECT_REPLACED",
  "CLAIM_INVALID",
  "CLAIM_EXPIRED",
  "CLAIM_ALREADY_USED",
  "CONNECTOR_INVALID",
  "CONNECTOR_EXPIRED",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
]);

const EDITOR_OFFLINE_CODES = new Set<string>([
  "EDITOR_OFFLINE",
  "EDITOR_DISCONNECTED",
]);

const RETRYABLE_CODES = new Set<string>(["RATE_LIMITED", "REQUEST_TIMEOUT"]);

/**
 * Normalize a transport-level failure identified by its wire error code (see
 * `AgentTransportErrorCodeSchema`) plus HTTP status into the local failure
 * taxonomy. Unknown codes are treated as rejected requests so the caller sees
 * the server's message instead of a crash.
 */
export function transportFailure(
  code: AgentTransportErrorCode | string,
  message: string,
  httpStatus?: number,
): AgentSessionError {
  if (UNRECOVERABLE_CREDENTIAL_CODES.has(code)) {
    return new AgentSessionError(
      code,
      message,
      "unrecoverable-credential",
      httpStatus,
    );
  }
  if (EDITOR_OFFLINE_CODES.has(code)) {
    return new AgentSessionError(code, message, "editor-offline", httpStatus);
  }
  if (RETRYABLE_CODES.has(code)) {
    return new AgentSessionError(code, message, "retryable", httpStatus);
  }
  return new AgentSessionError(code, message, "request-rejected", httpStatus);
}

export function networkFailure(detail: string): AgentSessionError {
  return new AgentSessionError("NETWORK_FAILURE", detail, "network");
}

export function invalidResponseFailure(detail: string): AgentSessionError {
  return new AgentSessionError("INVALID_RESPONSE", detail, "request-rejected");
}
