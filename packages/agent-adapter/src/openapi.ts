import {
  AGENT_API_VERSION,
  AgentCircuitRequestJsonSchema,
  AgentCircuitResponseJsonSchema,
} from "./schema.js";

export const agentCircuitOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "Interactive Circuit Maker Agent Circuit API",
    version: AGENT_API_VERSION,
  },
  paths: {
    "/v1/circuit": {
      post: {
        operationId: "agentCircuitOperation",
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
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
} as const;
