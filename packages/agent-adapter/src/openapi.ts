import {
  AGENT_API_VERSION,
  AgentCircuitRequestJsonSchema,
  AgentCircuitResponseJsonSchema,
} from "./schema.js";
import {
  AgentClaimRequestJsonSchema,
  AgentTransportErrorResponseJsonSchema,
} from "./envelope.js";

function componentSchema(
  value: Record<string, unknown>,
  componentName: string,
): Record<string, unknown> {
  return componentSchemaValue(value, componentName) as Record<string, unknown>;
}

function componentSchemaValue(value: unknown, componentName: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => componentSchemaValue(item, componentName));
  }
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      // OpenAPI 3.1 supplies the dialect for component schemas.
      if (key === "$schema") return [];
      if (
        key === "$ref" &&
        typeof item === "string" &&
        item.startsWith("#/$defs/")
      ) {
        return [
          [key, `#/components/schemas/${componentName}/${item.slice(2)}`],
        ];
      }
      return [[key, componentSchemaValue(item, componentName)]];
    }),
  );
}

const agentCircuitRequestSchema = componentSchema(
  AgentCircuitRequestJsonSchema as Record<string, unknown>,
  "agentCircuitRequest",
);
const agentCircuitResponseSchema = componentSchema(
  AgentCircuitResponseJsonSchema as Record<string, unknown>,
  "agentCircuitResponse",
);
const agentClaimRequestSchema = componentSchema(
  AgentClaimRequestJsonSchema as Record<string, unknown>,
  "agentClaimRequest",
);
const agentTransportErrorResponseSchema = componentSchema(
  AgentTransportErrorResponseJsonSchema as Record<string, unknown>,
  "agentTransportErrorResponse",
);
const agentCircuitRequestRef = {
  $ref: "#/components/schemas/agentCircuitRequest",
} as const;
const agentCircuitResponseRef = {
  $ref: "#/components/schemas/agentCircuitResponse",
} as const;

export const agentCircuitRequestExamples = {
  capabilities: {
    summary: "Discover the current four-operation contract and limits",
    value: {
      apiVersion: "2.0",
      requestId: "capabilities-1",
      operation: "capabilities",
    },
  },
  snapshot: {
    summary: "Read one complete authorized Document",
    value: {
      apiVersion: "2.0",
      requestId: "snapshot-1",
      operation: "snapshot",
      documentId: "document-main",
      includeSourceSpans: false,
    },
  },
  transactDryRun: {
    summary: "Dry-run one atomic edit batch before committing the same edits",
    value: {
      apiVersion: "2.0",
      requestId: "dry-run-1",
      operation: "transact",
      documentId: "document-main",
      transactionId: "place-vin-1",
      expectedRevision: 0,
      dryRun: true,
      edits: [
        {
          kind: "add_port",
          port: {
            id: "VIN",
            name: "Vin",
            direction: "input",
            presentation: "hollow",
            position: { x: 200, y: 260 },
          },
        },
      ],
    },
  },
  render: {
    summary: "Render the formal scene after a successful commit",
    value: {
      apiVersion: "2.0",
      requestId: "render-1",
      operation: "render",
      documentId: "document-main",
      mode: "formal",
    },
  },
} as const;

export const agentClaimRequestExample = {
  claimCode: "session-id.one-time-claim",
} as const;

export const agentTransportErrorExamples = {
  "404": {
    ok: false,
    error: {
      code: "SESSION_NOT_FOUND",
      message: "Session is unknown or expired",
    },
  },
  "401": {
    ok: false,
    error: {
      code: "TOKEN_INVALID",
      message: "Bearer token is missing or unknown",
    },
  },
  "403": {
    ok: false,
    error: {
      code: "TOKEN_SCOPE_INSUFFICIENT",
      message: "Bearer token does not grant the required scope",
    },
  },
  "409": {
    ok: false,
    error: {
      code: "REQUEST_ID_REUSED",
      message: "requestId was already used with a different payload",
    },
  },
  "413": {
    ok: false,
    error: {
      code: "REQUEST_TOO_LARGE",
      message: "Request exceeds the byte limit",
    },
  },
  "429": {
    ok: false,
    error: { code: "RATE_LIMITED", message: "Session rate limit exceeded" },
  },
  "503": {
    ok: false,
    error: { code: "EDITOR_OFFLINE", message: "Editor is offline" },
  },
  "504": {
    ok: false,
    error: {
      code: "REQUEST_TIMEOUT",
      message: "The browser did not complete the request in time",
    },
  },
} as const;

function transportErrorResponse(
  example: (typeof agentTransportErrorExamples)[keyof typeof agentTransportErrorExamples],
) {
  return {
    description: "Typed Agent session transport error",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/agentTransportErrorResponse" },
        example,
      },
    },
  } as const;
}

const circuitSessionResponses = {
  "200": {
    description: "Circuit API response",
    content: { "application/json": { schema: agentCircuitResponseRef } },
  },
  "400": {
    description: "Malformed JSON or request-schema violation",
    content: {
      "application/json": {
        schema: agentCircuitResponseRef,
        example: {
          apiVersion: "2.0",
          requestId: "req-123",
          operation: "error",
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Request does not match the Circuit API schema",
          },
          diagnostics: [
            {
              code: "SCHEMA_VIOLATION",
              domain: "schema",
              severity: "error",
              path: ["edits", 2, "instance", "symbolVariantId"],
              message: "Expected a non-empty string or omitted field",
            },
          ],
        },
      },
    },
  },
  "401": transportErrorResponse(agentTransportErrorExamples["401"]),
  "403": transportErrorResponse(agentTransportErrorExamples["403"]),
  "404": transportErrorResponse(agentTransportErrorExamples["404"]),
  "409": transportErrorResponse(agentTransportErrorExamples["409"]),
  "413": transportErrorResponse(agentTransportErrorExamples["413"]),
  "429": transportErrorResponse(agentTransportErrorExamples["429"]),
  "503": transportErrorResponse(agentTransportErrorExamples["503"]),
  "504": transportErrorResponse(agentTransportErrorExamples["504"]),
} as const;

const claimResponses = {
  "200": {
    description: "Claim redeemed",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/agentClaimResponse" },
      },
    },
  },
  "401": transportErrorResponse(agentTransportErrorExamples["401"]),
  "404": transportErrorResponse(agentTransportErrorExamples["404"]),
  "409": transportErrorResponse(agentTransportErrorExamples["409"]),
  "413": transportErrorResponse(agentTransportErrorExamples["413"]),
} as const;

export const agentCircuitOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "Interactive Circuit Maker Agent Circuit API",
    version: AGENT_API_VERSION,
  },
  paths: {
    "/v2/circuit": {
      post: {
        operationId: "agentCircuitV2Operation",
        description: "Snapshot-driven Agent circuit workflow endpoint.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: agentCircuitRequestRef,
              examples: agentCircuitRequestExamples,
            },
          },
        },
        responses: {
          "200": {
            description: "Agent Circuit API response",
            content: {
              "application/json": { schema: agentCircuitResponseRef },
            },
          },
        },
      },
    },
    "/api/agent/sessions": {
      post: {
        operationId: "agentSessionCreate",
        description:
          "Browser creates an Agent session bound to the open Project. Returns the editor secret and one-time claim code once; the relay persists neither.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "projectSessionId",
                  "projectId",
                  "documentIds",
                  "scopes",
                ],
                properties: {
                  projectSessionId: { type: "string", minLength: 1 },
                  projectId: { type: "string", minLength: 1 },
                  documentIds: {
                    type: "array",
                    items: { type: "string", minLength: 1 },
                  },
                  scopes: {
                    type: "array",
                    items: { type: "string", minLength: 1 },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/agentSessionCreated" },
              },
            },
          },
        },
      },
    },
    "/api/agent/claims": {
      post: {
        operationId: "agentClaimRedeem",
        description:
          "Exchange a one-time, short-lived claim code for a scoped, expiring bearer token. Single-use.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/agentClaimRequest" },
              example: agentClaimRequestExample,
            },
          },
        },
        responses: claimResponses,
      },
    },
    "/api/agent/sessions/{sessionId}/circuit": {
      post: {
        operationId: "agentSessionCircuit",
        description:
          "Send one Circuit API request over the session. The relay validates the strict payload and required token scopes, then forwards it to the live browser without applying or rewriting edits.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: agentCircuitRequestRef,
              examples: agentCircuitRequestExamples,
            },
          },
        },
        responses: circuitSessionResponses,
      },
    },
    "/api/agent/sessions/{sessionId}/events": {
      get: {
        operationId: "agentSessionEvents",
        description:
          "Bounded SSE event stream: editor online/offline, document.revision-changed, operation.*, and terminal session.*/document.replaced events.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Server-Sent Events stream",
            content: {
              "text/event-stream": { schema: { type: "string" } },
            },
          },
        },
      },
    },
    "/api/agent/sessions/{sessionId}/control": {
      post: {
        operationId: "agentSessionControl",
        description:
          "Browser-owner pause, resume, revoke, or Project-replacement control. Requires x-editor-secret.",
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "x-editor-secret",
            in: "header",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["action"],
                properties: {
                  action: {
                    type: "string",
                    enum: ["pause", "resume", "revoke", "replace-project"],
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Control applied" } },
      },
    },
    "/api/agent/sessions/{sessionId}/editor": {
      get: {
        operationId: "agentSessionEditorChannel",
        description:
          "Browser WebSocket command channel. Uses the icm-agent-session subprotocol plus the editor secret.",
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: { "101": { description: "WebSocket switching protocols" } },
      },
    },
    "/api/agent/sessions/{sessionId}": {
      delete: {
        operationId: "agentSessionDisconnect",
        description:
          "Disconnect the Agent capability. The session can be revoked.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
        ],
        responses: {
          "204": { description: "Disconnected" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
    schemas: {
      agentClaimRequest: agentClaimRequestSchema,
      agentTransportErrorResponse: agentTransportErrorResponseSchema,
      agentCircuitRequest: agentCircuitRequestSchema,
      agentCircuitResponse: agentCircuitResponseSchema,
      agentSessionCreated: {
        type: "object",
        additionalProperties: false,
        required: ["ok", "session"],
        properties: {
          ok: { type: "boolean", const: true },
          session: {
            type: "object",
            additionalProperties: false,
            required: [
              "sessionId",
              "editorSecret",
              "claimCode",
              "claimExpiresAt",
              "expiresAt",
            ],
            properties: {
              sessionId: { type: "string", minLength: 1 },
              editorSecret: { type: "string", minLength: 1 },
              claimCode: { type: "string", minLength: 1 },
              claimExpiresAt: { type: "integer", minimum: 0 },
              expiresAt: { type: "integer", minimum: 0 },
            },
          },
        },
      },
      agentClaimResponse: {
        type: "object",
        additionalProperties: false,
        required: [
          "ok",
          "sessionId",
          "agentToken",
          "tokenExpiresAt",
          "scopes",
          "projectId",
          "documentIds",
        ],
        properties: {
          ok: { type: "boolean", const: true },
          sessionId: { type: "string", minLength: 1 },
          agentToken: { type: "string", minLength: 1 },
          tokenExpiresAt: { type: "integer", minimum: 0 },
          scopes: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
          projectId: { type: "string", minLength: 1 },
          documentIds: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const;
