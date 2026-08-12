---
status: completed
experience: none
---

# WP-WA0 — Contract ADR and Threat Model

## Goal

Freeze the browser-authoritative Agent session contract as accepted/proposed
documentation so every later work package (WP-WA1–WA7) starts with no unresolved
authority, identity, retry, expiry, or project-replacement decision. Produce the
ADR that decides the architecture and the spec that records the full transport,
authorization, event, idempotency, dispatch, error, and threat contract.

This is the first implementation work package of the
[`web-agent-session-integration-plan`](../../docs/roadmap/web-agent-session-integration-plan.md)
roadmap. It changes documentation only.

## State and Ownership

Start state from `git status --short --branch` in the dedicated worktree:

```text
## codex/web-agent-session-architecture
```

The worktree is clean. `codex/web-agent-session-architecture` was rebased onto
`main` (`0e96608`) after the drawn VDD rail merged, so the edit-kind inventory
and generated artifacts are current. The roadmap's prerequisite is satisfied.

VDD merge impact on this target, verified by `git diff d446821..0e96608`:

- `packages/agent-adapter/**` — unchanged.
- `apps/editor/src/document/**` — unchanged.
- `AGENT_EDIT_KINDS` — unchanged; the drawn VDD rail reuses existing typed
  edits, so the permission scope table needs no edit-kind increment.
- `packages/edit-engine/src/transaction.ts` — adds one validation rule: a Route
  with `presentation === "power-rail"` must belong to a VDD Net. The spec notes
  this new non-electrical Route presentation value.

Owned paths:

- `docs/adr/0016-browser-authoritative-agent-session.md`
- `docs/specs/web-agent-session.md`
- `docs/adr/README.md` (index append)
- `docs/specs/README.md` (table append)
- `docs/specs/agent-api.md` (cross-link + `power-rail` note)
- `docs/roadmap/web-agent-session-integration-plan.md` (status note)
- `plan/2026-08-12-web-agent-session-wa0/plan.md`
- one append-only entry in `plan/log.md`

Read-only evidence and credible shared dependencies:

- `packages/agent-adapter/src/{schema,service,snapshot,http}.ts`
- `apps/editor/src/document/document-controller.ts`
- `packages/edit-engine/src/{transaction,history}.ts`
- `worker/index.ts`
- `docs/adr/0005-agent-api-without-mcp.md`, `docs/adr/0007-snapshot-driven-agent-workflow.md`
- `docs/specs/agent-api.md`

## Work

1. Author ADR 0016 freezing: browser authority; one domain protocol + editor
   host boundary + session transport boundary; capability-token identity
   (sessionId / editorSecret / claimCode / agentToken); and the explicitly
   rejected approaches (DOM automation, MCP, public loopback, whole-Project
   replacement, second Edit Engine, server Project persistence, silent
   re-targeting). Status `proposed`, awaiting human acceptance, with every
   decision resolved.
2. Author `docs/specs/web-agent-session.md` recording: actors and secrets;
   permission scope table (v2 snapshot read path; v1 query legacy); Project
   binding and replacement; transport resource model and relay message envelope;
   serialization, idempotency, and concurrency; event stream; browser host
   `dispatchTransaction` contract; the full typed transport error catalog; and a
   threat model table. Note the VDD `power-rail` Route presentation.
3. Append 0016 to `docs/adr/README.md`; append the new spec to the
   `docs/specs/README.md` table; cross-link `docs/specs/agent-api.md` to the new
   spec and note `power-rail`.
4. Add a WP-WA0 status note to the roadmap.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm references:check` (doc link integrity)
- Prettier on the new/changed Markdown (`docs/**` and `plan/**`)
- Manual review: every WP-WA1–WA7 exit gate has a frozen decision to cite; the
  error catalog, scope table, envelope, and event list are internally
  consistent with the existing `agent-adapter` schema and `document-controller`
  dispatch surface.

This target changes documentation only, so no TypeScript build or test suite is
required.

## Commit Intent

Commit as:

```text
docs(agent): freeze browser-authorized session contract (WP-WA0)
```

## Outcome

Froze the browser-authoritative Agent session contract as documentation. Added
ADR 0016 (browser authority, three-boundary model, capability-token identity,
rejected alternatives) and `docs/specs/web-agent-session.md` (actors/secrets,
permission scope table mapped to `AgentPermissions`, Project binding/replacement,
transport resource model, relay envelope, serialization/idempotency/concurrency,
event stream, browser host `dispatchTransaction` contract, typed transport
error catalog, invariants, and threat model). Indexed both in `docs/adr/README.md`
and `docs/specs/README.md`, cross-linked `docs/specs/agent-api.md`, and marked
WP-WA0 complete in the roadmap.

Verified against rebased `main` (`0e96608`): VDD touched no `agent-adapter` or
`document-controller` file, added no edit kinds, and its only agent-facing
increment is the non-electrical `power-rail` Route presentation, noted in both
`agent-api.md` and the new spec. Every WP-WA1–WA7 exit gate now has a frozen
authority, identity, retry, expiry, scope, and project-replacement decision to
cite. Documentation-only target; validated with `pnpm references:check`,
Prettier on all touched Markdown, and `git diff --check`.
