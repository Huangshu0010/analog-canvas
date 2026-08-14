import { z } from "zod";
import {
  AgentSessionError,
  AuthoringActionSchema,
  changedObjectIds,
  type AgentSessionClient,
} from "@icm/agent-client";
import type { McpToolCallResult, McpToolDefinition } from "./protocol.js";
import {
  diagnosticsCompact,
  inspectConnectivity,
  inspectDocument,
  inspectObject,
  searchSnapshot,
  type SearchKind,
} from "./results.js";

/**
 * The default MCP tool surface (ADR 0020): about ten compact tools. The full
 * typed edit union is deliberately NOT injected into tool descriptions; it is
 * reachable only through `advanced_transact` after reading the
 * `analog-canvas://contract/advanced-edits` resource in this session.
 */
export interface ToolSessionState {
  client: AgentSessionClient;
  hasReadAdvancedContract(): boolean;
  markAdvancedContractRead(): void;
}

const ConnectArgs = z.strictObject({
  claimCode: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Claim code from the editor connect panel. Omit to resume the stored pairing.",
    ),
});

const DocumentArgs = z.strictObject({
  documentId: z.string().min(1).optional(),
});

const InspectArgs = z.strictObject({
  target: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("document") }),
    z.strictObject({
      kind: z.literal("object"),
      id: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    }),
    z.strictObject({
      kind: z.literal("net"),
      id: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    }),
    z.strictObject({
      kind: z.literal("connectivity"),
      id: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
    }),
    z.strictObject({ kind: z.literal("diagnostics") }),
  ]),
  detail: z.enum(["compact", "full"]).optional(),
});

const SearchArgs = z.strictObject({
  query: z.string().min(1),
  kinds: z
    .array(
      z.enum([
        "instance",
        "net",
        "route",
        "junction",
        "annotation",
        "drafting",
        "property",
        "diagnostic",
      ]),
    )
    .optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const ApplyActionsArgs = z.strictObject({
  actions: z.array(AuthoringActionSchema).min(1).max(256),
  verify: z.boolean().optional(),
});

const AdvancedTransactArgs = z.strictObject({
  edits: z.array(z.unknown()).min(1).max(256),
  dryRun: z.boolean().optional(),
});

const RenderArgs = z.strictObject({
  mode: z.enum(["formal", "diagnostics"]).optional(),
  bounds: z
    .strictObject({
      x: z.number().int(),
      y: z.number().int(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  documentId: z.string().min(1).optional(),
});

interface ToolEntry {
  definition: McpToolDefinition;
  handle: (args: unknown, session: ToolSessionState) => Promise<unknown>;
}

const jsonSchemaOf = (schema: z.ZodType): Record<string, unknown> =>
  z.toJSONSchema(schema, { target: "draft-2020-12", reused: "ref" }) as Record<
    string,
    unknown
  >;

function textResult(value: unknown, isError = false): McpToolCallResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function toolErrorResponse(error: unknown): McpToolCallResult {
  if (error instanceof AgentSessionError) {
    return textResult(
      {
        ok: false,
        error: error.toJSON(),
        hint:
          error.category === "unrecoverable-credential"
            ? "call connect with a fresh claim code from the editor"
            : error.category === "editor-offline"
              ? "the authorized browser editor is not attached; ask the human to reopen the project"
              : undefined,
      },
      true,
    );
  }
  return textResult(
    {
      ok: false,
      error: {
        code: "TOOL_FAILURE",
        message: error instanceof Error ? error.message : String(error),
      },
    },
    true,
  );
}

const TOOLS: readonly ToolEntry[] = [
  {
    definition: {
      name: "connect",
      description:
        "Pair with the live browser editor. First time: pass the claim code shown in the editor's Agent connect panel. Later starts resume automatically while the pairing is valid. After connecting, read the analog-canvas://reference/quickstart resource.",
      inputSchema: jsonSchemaOf(ConnectArgs),
    },
    handle: async (args, session) => {
      const parsed = ConnectArgs.parse(args ?? {});
      const report = await session.client.connect(parsed.claimCode);
      return {
        ok: true,
        mode: report.mode,
        projectId: report.projectId,
        documentIds: report.documentIds,
        tokenExpiresAt: report.tokenExpiresAt,
        capabilities: report.capabilities,
        context: report.context,
      };
    },
  },
  {
    definition: {
      name: "connection_status",
      description:
        "Report pairing and editor-attachment state (unpaired/connecting/online/editor-offline/reconnecting/revoked) plus token validity. Tokens themselves are never returned.",
      inputSchema: jsonSchemaOf(z.strictObject({})),
    },
    handle: async (_args, session) => session.client.status(),
  },
  {
    definition: {
      name: "get_context",
      description:
        "Compact context for the current document: project/document identity, revision, instance/net counts, and error/warning totals. Fetches and caches a snapshot when needed.",
      inputSchema: jsonSchemaOf(DocumentArgs),
    },
    handle: async (args, session) => {
      const parsed = DocumentArgs.parse(args ?? {});
      const entry = await session.client.snapshot(parsed.documentId);
      const summary = session.client.summary(entry.documentId);
      return {
        ...(summary ?? {}),
        connection: session.client.connection.snapshot.state,
        fetchedAt: entry.fetchedAt,
      };
    },
  },
  {
    definition: {
      name: "inspect",
      description:
        "Read facts from the cached snapshot: a document overview, one object (instance/net/route/junction/annotation), net connectivity, or diagnostics. detail:'full' returns complete instance/net projections.",
      inputSchema: jsonSchemaOf(InspectArgs),
    },
    handle: async (args, session) => {
      const parsed = InspectArgs.parse(args);
      const entry = await session.client.snapshot();
      switch (parsed.target.kind) {
        case "document":
          return inspectDocument(entry, parsed.detail ?? "compact");
        case "object":
          return inspectObject(entry, parsed.target);
        case "net":
          return inspectObject(entry, parsed.target);
        case "connectivity":
          return inspectConnectivity(entry, parsed.target);
        case "diagnostics":
          return diagnosticsCompact(entry);
      }
    },
  },
  {
    definition: {
      name: "search",
      description:
        "Case-insensitive search over instance names/symbols, nets, routes, junctions, annotations, drafting text, properties, and diagnostics in the cached snapshot.",
      inputSchema: jsonSchemaOf(SearchArgs),
    },
    handle: async (args, session) => {
      const parsed = SearchArgs.parse(args);
      const entry = await session.client.snapshot();
      return {
        query: parsed.query,
        hits: searchSnapshot(
          entry,
          parsed.query,
          parsed.kinds as readonly SearchKind[] | undefined,
          parsed.limit ?? 20,
        ),
      };
    },
  },
  {
    definition: {
      name: "apply_actions",
      description:
        "Apply compact circuit actions (place-component, add-power-rail, connect, disconnect, move, rotate, mirror, rename, set-property, add-label, edit-text, annotate, arrange, delete). Actions compile to existing typed edits/wire intents, are dry-run first, then committed atomically per transaction with revision checks. Style guidance: analog-canvas://reference/razavi-style; workflow: analog-canvas://reference/workflow.",
      inputSchema: jsonSchemaOf(ApplyActionsArgs),
    },
    handle: async (args, session) => {
      const parsed = ApplyActionsArgs.parse(args);
      const report = await session.client.applyActions(parsed.actions, {
        verify: parsed.verify ?? true,
      });
      return report;
    },
  },
  {
    definition: {
      name: "advanced_transact",
      description:
        "Escape hatch: submit raw typed edits from the full edit union. Requires reading analog-canvas://contract/advanced-edits in this session first; it is not the standard workflow.",
      inputSchema: jsonSchemaOf(AdvancedTransactArgs),
    },
    handle: async (args, session) => {
      if (!session.hasReadAdvancedContract()) {
        return new ToolFailure({
          ok: false,
          error: {
            code: "ADVANCED_CONTRACT_NOT_READ",
            message:
              "read resource analog-canvas://contract/advanced-edits before using advanced_transact",
          },
        });
      }
      const parsed = AdvancedTransactArgs.parse(args);
      return session.client.advancedTransact(parsed.edits, {
        ...(parsed.dryRun !== undefined ? { dryRun: parsed.dryRun } : {}),
      });
    },
  },
  {
    definition: {
      name: "verify",
      description:
        "Refresh the snapshot and report revision, error/warning totals, and which object IDs changed since the cached snapshot. Use after edits or when a transaction reported STATE_CHANGED.",
      inputSchema: jsonSchemaOf(DocumentArgs),
    },
    handle: async (args, session) => {
      const client = session.client;
      const parsed = DocumentArgs.parse(args ?? {});
      const documentId = parsed.documentId;
      const before = client.cachedSnapshot(documentId);
      const fresh = await client.refreshSnapshot(documentId);
      const changed =
        before && before.documentId === fresh.documentId
          ? changedObjectIds(before.snapshot, fresh.snapshot)
          : [];
      const counts = diagnosticsCompact(fresh).counts;
      return { revision: fresh.revision, ...counts, changedObjectIds: changed };
    },
  },
  {
    definition: {
      name: "render",
      description:
        "Render the current document to SVG and return it as an image content block (image/svg+xml) plus a compact text summary (revision, sha256, byteLength).",
      inputSchema: jsonSchemaOf(RenderArgs),
    },
    handle: async (args, session) => {
      const parsed = RenderArgs.parse(args);
      const response = await session.client.render({
        ...(parsed.mode ? { mode: parsed.mode } : {}),
        ...(parsed.bounds ? { bounds: parsed.bounds } : {}),
        ...(parsed.documentId ? { documentId: parsed.documentId } : {}),
      });
      return {
        __render: response,
      };
    },
  },
];

export function listToolDefinitions(): McpToolDefinition[] {
  return TOOLS.map((tool) => tool.definition);
}

/** Marker for a tool that completed with a structured failure payload. */
export class ToolFailure {
  constructor(readonly value: unknown) {}
}

export async function callTool(
  name: string,
  args: unknown,
  session: ToolSessionState,
): Promise<McpToolCallResult> {
  const tool = TOOLS.find((entry) => entry.definition.name === name);
  if (!tool) {
    return textResult(
      { ok: false, error: { code: "UNKNOWN_TOOL", message: name } },
      true,
    );
  }
  try {
    const result = await tool.handle(args ?? {}, session);
    if (result instanceof ToolFailure) {
      return textResult(result.value, true);
    }
    if (result !== null && typeof result === "object" && "__render" in result) {
      const response = (
        result as {
          __render: Awaited<ReturnType<AgentSessionClient["render"]>>;
        }
      ).__render;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                revision: response.revision,
                mode: response.artifact.mode,
                byteLength: response.artifact.byteLength,
                sha256: response.artifact.sha256,
                diagnostics: response.diagnostics.length,
              },
              null,
              2,
            ),
          },
          {
            type: "image",
            data: response.artifact.data,
            mimeType: "image/svg+xml",
          },
        ],
      };
    }
    // Structured reports carry their own `ok: false` failure state.
    const failed =
      result !== null &&
      typeof result === "object" &&
      "ok" in result &&
      (result as { ok?: unknown }).ok === false;
    return textResult(result, failed);
  } catch (error) {
    return toolErrorResponse(error);
  }
}
