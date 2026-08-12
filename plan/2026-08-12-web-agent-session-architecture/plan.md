---
status: completed
experience: none
---

# Web Agent Session Architecture Plan

## Goal

Define a detailed, reviewable implementation roadmap for securely connecting an
authorized external Agent to the live browser editor without visual automation,
MCP, a second mutation engine, or server-side Project persistence. Preserve the
existing Snapshot/typed-transaction/render domain API where it is sound, and
identify the browser-host, authorization, relay, event, validation, and delivery
work required to make it a web product.

## State and Ownership

Start state from `git status --short --branch` in the dedicated worktree:

```text
## codex/web-agent-session-architecture
```

The dedicated worktree is clean and was created from `main` at
`d446821f2d4550bac103440c9c7ffd94dc73aa41`. Concurrent VDD rail work remains in
the original worktree and branch. This planning target does not edit its model,
Edit Engine, renderer, symbol, fixture, generated API, or editor implementation
files.

Owned paths:

- `docs/roadmap/web-agent-session-integration-plan.md`
- `docs/roadmap/README.md`
- `plan/2026-08-12-web-agent-session-architecture/plan.md`
- one append-only entry in `plan/log.md`

Read-only evidence and credible shared dependencies:

- `packages/agent-adapter/**`
- `packages/edit-engine/**`
- `packages/model/**`
- `apps/editor/src/document/**`
- `apps/editor/src/app/App.tsx`
- `worker/**`
- `docs/specs/agent-api.md`
- `docs/adr/0005-agent-api-without-mcp.md`
- `docs/adr/0007-snapshot-driven-agent-workflow.md`
- concurrent VDD rail branch changes to `App.tsx`, model, Edit Engine, renderer,
  generated Agent API artifacts, specs, and `plan/log.md`

The roadmap must make merging the VDD rail branch into `main` and rebasing each
implementation target onto that result an explicit prerequisite. The only
likely planning-branch merge overlap is the append-only `plan/log.md` entry.

## Work

1. Record the current browser/editor, Agent API, loopback transport, and Worker
   boundaries from repository evidence.
2. Freeze the recommended browser-authoritative architecture and explicitly
   reject DOM automation, MCP, public loopback, whole-Project replacement, a
   second Edit Engine, and premature server-authoritative collaboration.
3. Define session lifecycle, capability-token authorization, permission scopes,
   relay endpoints, browser channel messages, request idempotency, revision
   events, privacy, audit, failure semantics, and revocation behavior.
4. Define how Agent transactions enter the same `EditorDocumentController` and
   `DocumentHistory` as human transactions, including undo/recovery/UI refresh
   parity and dynamic resolver/project state.
5. Decompose delivery into bounded work packages with ownership, dependencies,
   risks, focused validation, user-visible demonstrations, and exit gates.
6. Add the roadmap to the roadmap index and close this documentation target.

## Validation

- Manually cross-check every proposed retained/replaced boundary against the
  current source paths cited in the roadmap.
- Check that every work package has a bounded owner, prerequisites, validation,
  and exit gate, and that no package assumes VDD changes are absent.
- Check roadmap Markdown links with `pnpm references:check` if dependencies are
  available in the new worktree; otherwise record the limitation.
- `git diff --check`
- `git status --short --branch`

This target changes documentation only, so no TypeScript build or test suite is
required.

## Commit Intent

Commit as:

```text
docs(agent): plan browser-authorized agent sessions
```

## Outcome

Created a source-evidenced browser Agent-session roadmap that retains the
existing semantic Snapshot/transaction/render core, replaces the independent
store/commit browser boundary, freezes a browser-authoritative temporary relay
architecture, and decomposes delivery into eight bounded work packages. The
roadmap explicitly treats the concurrent VDD rail branch as a pre-implementation
mainline dependency and leaves all of its implementation files untouched.
