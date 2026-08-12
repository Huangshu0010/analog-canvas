import {
  AGENT_API_VERSION,
  AgentCircuitRequestJsonSchema,
  AgentCircuitResponseJsonSchema,
} from "./schema.js";

/**
 * Shared typed-error response for the web-session transport (ADR 0016 / WP-WA6).
 * `code` is one of the transport error codes in `envelope.ts` plus the Circuit
 * API domain codes.
 */
const transportErrorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok", "error"],
  properties: {
    ok: { type: "boolean", const: false },
    revision: { type: "integer", minimum: 0 },
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: {
        code: { type: "string", minLength: 1 },
        message: { type: "string" },
      },
    },
  },
} as const;

export const agentCircuitOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "Interactive Circuit Maker Agent Circuit API",
    version: AGENT_API_VERSION,
  },
  paths: {
    "/v1/circuit": {
      post: {
        operationId: "agentCircuitV1Operation",
        deprecated: true,
        description: "Legacy scoped-query compatibility endpoint.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: AgentCircuitRequestJsonSchema },
          },
        },
        responses: {
          "200": {
            description: "Agent Circuit API response",
            content: {
              "application/json": { schema: AgentCircuitResponseJsonSchema },
            },
          },
        },
      },
    },
    "/v2/circuit": {
      post: {
        operationId: "agentCircuitV2Operation",
        description: "Snapshot-driven Agent circuit workflow endpoint.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: AgentCircuitRequestJsonSchema },
          },
        },
        responses: {
          "200": {
            description: "Agent Circuit API response",
            content: {
              "application/json": { schema: AgentCircuitResponseJsonSchema },
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
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["claimCode"],
                properties: {
                  claimCode: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Claim redeemed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/agentClaimResponse" },
              },
            },
          },
          default: {
            description: "Claim error",
            content: {
              "application/json": { schema: transportErrorSchema },
            },
          },
        },
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
            "application/json": { schema: AgentCircuitRequestJsonSchema },
          },
        },
        responses: {
          "200": {
            description: "Circuit API response",
            content: {
              "application/json": { schema: AgentCircuitResponseJsonSchema },
            },
          },
          default: {
            description: "Transport or Circuit error",
            content: {
              "application/json": { schema: transportErrorSchema },
            },
          },
        },
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
        required: ["ok", "sessionId", "agentToken", "tokenExpiresAt", "scopes"],
        properties: {
          ok: { type: "boolean", const: true },
          sessionId: { type: "string", minLength: 1 },
          agentToken: { type: "string", minLength: 1 },
          tokenExpiresAt: { type: "integer", minimum: 0 },
          scopes: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const;
