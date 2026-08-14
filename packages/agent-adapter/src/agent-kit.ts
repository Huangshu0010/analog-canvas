/**
 * Small, provider-neutral operating material for an Agent that has no checkout
 * of this repository. The Kit has no Project data, credentials, or mutation
 * surface: it only tells an Agent how to use the existing session API.
 */

export const AGENT_OPERATING_KIT_FORMAT = "icm-agent-kit-v1";
export const AGENT_OPERATING_KIT_VERSION = "1";

export interface AgentOperatingKitFile {
  path: string;
  content: string;
}

export interface AgentOperatingKit {
  format: typeof AGENT_OPERATING_KIT_FORMAT;
  version: typeof AGENT_OPERATING_KIT_VERSION;
  files: readonly AgentOperatingKitFile[];
}

export const agentOperatingKit: AgentOperatingKit = {
  format: AGENT_OPERATING_KIT_FORMAT,
  version: AGENT_OPERATING_KIT_VERSION,
  files: [
    {
      path: "README.md",
      content: `# Interactive Circuit Maker Agent Kit

This private working folder is operating material for one browser-authorized
session. It is not a checkout of the editor and contains no Project data,
credential, or hidden tool.

Read \`AGENTS.md\`, then \`skills/icm-circuit-session/SKILL.md\`. Fetch the
published OpenAPI before forming requests; it is the wire-contract authority.
`,
    },
    {
      path: "AGENTS.md",
      content: `# Operating boundary

- The live browser Project is authoritative. Read it through \`snapshot\`; do
  not guess IDs, Net membership, pin order, or revision.
- Use only the published HTTPS API. Do not use DOM, mouse, keyboard, visual
  automation, source repositories, or a second edit path to change a circuit.
- \`transact\` is the sole mutation path. Preserve human edits, locks, and
  revision conflicts rather than trying to overwrite them.
- Keep bearer tokens only in memory. Never place a claim code or token in a
  file, URL, log, rendered annotation, or user-visible response.
- The browser must stay open. Treat a terminal session error as a request for a
  new human authorization, not permission to reconnect to another Project.
`,
    },
    {
      path: "skills/icm-circuit-session/SKILL.md",
      content: `# Interactive Circuit Maker live-session workflow

## Bootstrap

1. Redeem the human-provided claim code once at \`/api/agent/claims\`.
2. Keep only the latest \`sessionId\`, \`documentIds\`, and bearer token from
   that response.
3. Read \`/api/agent/openapi.json\`, then call \`capabilities\` once through
   \`/api/agent/sessions/{sessionId}/circuit\`.
4. Select only an authorized \`documentId\` and request one complete
   \`snapshot\` before deciding or editing.

## Edit loop

1. Reason from the Snapshot's resolved pins, Nets, Routes, Junctions, locks,
   diagnostics, and revision.
2. Use the Snapshot revision as \`expectedRevision\`. Dry-run a non-trivial,
   multi-object, routing, or connectivity transaction.
3. Commit exactly the reviewed edits while the revision is unchanged.
4. Render after a successful commit and read a fresh Snapshot before handoff.

## Files and recovery

Use the separate \`files\` resource only when capabilities and scope advertise
it. Staging is not import: a browser human must approve replacement.

On \`STALE_REVISION\`, refresh the Snapshot and reconsider. On an uncertain
transport result, retry only the exact same request ID and payload. On a token
loss, redeem a still-valid claim again; on revoked, expired, or replaced
Project state, stop and ask the human for a new connection.
`,
    },
    {
      path: "references/session-contract.md",
      content: `# Session contract quick reference

Circuit operations are exactly \`capabilities\`, \`snapshot\`, \`transact\`,
and \`render\`. The API has no planning, catalog-query, whole-Project mutation,
simulation, waveform, or filesystem operation.

Use request IDs only for an exact-payload retry. A changed request gets a new
request ID. The current OpenAPI and \`capabilities\` response define the exact
available scopes, edit kinds, and limits for this session.
`,
    },
  ],
};
