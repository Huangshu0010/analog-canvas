import type { z } from "zod";

import {
  AGENT_API_V1_VERSION,
  AGENT_API_VERSION,
  AGENT_API_V3_VERSION,
  AgentCircuitRequestSchema,
  AgentProductionCircuitRequestSchema,
  AgentCircuitResponseSchema,
  type AgentCircuitRequest,
  type AgentCircuitResponse,
} from "./schema.js";

const INVALID_REQUEST_ID = "invalid-request";
const INVALID_REQUEST_MESSAGE = "Request does not match the Circuit API schema";

type RequestParseResult =
  | { success: true; data: AgentCircuitRequest }
  | { success: false; response: AgentCircuitResponse };

function candidateRecord(input: unknown): Record<string, unknown> | null {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : null;
}

function responseVersion(input: unknown) {
  const candidate = candidateRecord(input)?.apiVersion;
  if (candidate === AGENT_API_V1_VERSION) return AGENT_API_V1_VERSION;
  if (candidate === AGENT_API_V3_VERSION) return AGENT_API_V3_VERSION;
  return AGENT_API_VERSION;
}

function responseRequestId(input: unknown): string {
  const candidate = candidateRecord(input)?.requestId;
  return typeof candidate === "string" &&
    candidate.length > 0 &&
    candidate.length <= 256
    ? candidate
    : INVALID_REQUEST_ID;
}

function issueMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === "too_small" && issue.origin === "string") {
    return "Expected a non-empty string or omitted field";
  }
  if (issue.code === "invalid_type") {
    return `Expected ${String(issue.expected)}`;
  }
  if (issue.code === "unrecognized_keys") {
    return `Remove unsupported field${issue.keys.length === 1 ? "" : "s"}: ${issue.keys.join(", ")}`;
  }
  if (issue.code === "custom") return issue.message;
  if (issue.code === "invalid_value") return "Use one of the allowed values";
  return "Value does not satisfy the request contract";
}

/**
 * Build the only schema-failure envelope used by relay, browser host, and
 * Circuit service. It never includes rejected values or authorization data.
 */
export function invalidAgentRequestResponse(
  input: unknown,
  issues: readonly z.core.$ZodIssue[] = [],
  apiVersion = responseVersion(input),
): AgentCircuitResponse {
  return AgentCircuitResponseSchema.parse({
    apiVersion,
    requestId: responseRequestId(input),
    operation: "error",
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: INVALID_REQUEST_MESSAGE,
    },
    diagnostics: issues.map((issue) => ({
      code: "SCHEMA_VIOLATION",
      domain: "schema",
      severity: "error",
      ...(issue.path.length > 0 ? { path: [...issue.path] } : {}),
      message: issueMessage(issue),
    })),
  });
}

/** Parse with the production request schema and the stable error converter. */
export function parseAgentCircuitRequest(input: unknown): RequestParseResult {
  const parsed = AgentProductionCircuitRequestSchema.safeParse(input);
  return parsed.success
    ? { success: true, data: parsed.data }
    : {
        success: false,
        // Hosted traffic has exactly one supported response dialect. Returning
        // v2 here prevents an unsupported requested version from becoming an
        // accidental response-contract selector.
        response: invalidAgentRequestResponse(
          input,
          parsed.error.issues,
          AGENT_API_VERSION,
        ),
      };
}

/** Explicit migration-only parser; hosted traffic must never call it. */
export function parseCompatibleAgentCircuitRequest(
  input: unknown,
): RequestParseResult {
  const parsed = AgentCircuitRequestSchema.safeParse(input);
  return parsed.success
    ? { success: true, data: parsed.data }
    : {
        success: false,
        response: invalidAgentRequestResponse(input, parsed.error.issues),
      };
}
