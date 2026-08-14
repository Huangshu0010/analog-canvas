---
status: completed
experience: none
---

# Agent MCP review fixes

## Goal

Close the implementation gaps found in PR #49 before M4/M5: visible pin-to-pin
wiring, explicit transaction boundaries without hidden partial success,
document-consistent reads and writes, fresh state for human/Agent concurrency,
credential-contract consistency, and an MCP-native quickstart.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-mcp-adapter...origin/codex/agent-mcp-adapter
```

The worktree is clean. This target owns:

- `packages/agent-client/**`
- `apps/mcp-server/**`
- `packages/agent-adapter/src/agent-kit.ts` only where the shared MCP/HTTP
  guidance source must become transport-aware
- `docs/agent/**`, ADR 0019/0020 only where current credential and entry-point
  wording must match implemented M0-M3 behavior
- generated MCP resources and their generator/tests
- this plan and `plan/log.md`

Read-only shared dependencies are `worker/**`, `apps/editor/**`,
`packages/edit-engine/**`, and the four-operation API schemas. M4/M5 remain
excluded: no server-issued connector credential, editor Revoke UI, file tools,
package publication, or deployed golden path.

## Work

1. Make normal pin-to-pin authoring create visible routed geometry and add
   focused regression coverage.
2. Make `apply_actions` transaction boundaries explicit and safe: reject a
   batch that cannot be one atomic underlying transaction, keep cache state
   correct on every outcome, and preserve the two-phase create/wire workflow.
3. Carry one selected `documentId` through MCP reads and Helper transactions;
   refresh state for Agent decisions in the presence of human edits.
4. Remove bearer persistence from M0-M3 resume behavior and align the ADR,
   status, and tool descriptions with process-lifetime credentials until M4.
5. Publish an MCP-native quickstart from the shared knowledge source while
   retaining the raw HTTP Kit fallback, then regenerate MCP resources.
6. Add focused tests for every corrected contract and review the complete diff.

## Validation

- `pnpm test:local packages/agent-client apps/mcp-server packages/agent-adapter`
- `pnpm mcp:resources:check`
- `pnpm typecheck`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`
- `pnpm verify:branch` because the target crosses MCP, Helper, generated
  resources, and public Agent documentation

## Commit Intent

Commit as:

```text
fix(agent): close MCP adapter review gaps
```

## Outcome

Closed the M0-M3 review gaps without changing the browser relay, editor, Edit
Engine, or four-operation HTTP contract. Normal `connect` actions now use one
visible `wireIntent`; mixed edit/wire or size-split batches fail before any
commit; reads and writes honor an explicit document and refresh around human
edits; RichText and explicit waypoints survive the compact action layer; and
bearer state is confined to the current MCP process pending M4. The MCP
quickstart is now transport-native while the raw HTTP workflow remains an
explicit fallback resource.

Validation passed: 129 focused Agent/MCP/adapter tests, generated-resource and
Markdown checks, `pnpm typecheck`, `git diff --check`, and
`pnpm verify:branch` (112 test files / 638 tests, all workspace builds, static
contracts, and editor production smoke).
