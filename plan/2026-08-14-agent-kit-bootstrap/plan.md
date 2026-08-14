---
status: completed
experience: none
---

# Agent Kit Bootstrap

## Goal

Let an external Agent establish a small private working folder with the
Interactive Circuit Maker operating rules before it touches a live session,
without adding a second mutation protocol, project data copy, or provider
integration.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-copy-card...origin/codex/agent-copy-card
```

The dedicated worktree is clean. This target extends the preceding connection
presentation commit on the same review branch. It owns:

- `packages/agent-adapter/src/agent-kit.ts` and its public export
- `worker/agent-session.ts` and focused relay tests
- `apps/editor/src/agent/connect-agent-panel.tsx` and its focused tests
- `docs/specs/web-agent-session.md`, `docs/agent/README.md`,
  `docs/agent/api-usage.md`, and factual plan records

Read-only shared dependencies are the existing Agent Circuit OpenAPI,
session/claim state machine, and File Resource; the Kit must only point to
them and must not alter their schemas or authorization semantics.

## Work

1. Define one small, versioned, browser-safe Kit payload containing only an
   `AGENTS.md` operating boundary and a `SKILL.md` Snapshot-driven workflow.
2. Publish it from one read-only public route, separate from Circuit and File
   operations, with no secrets or Project content.
3. Shorten the copied hand-off so an Agent first fetches the Kit, then redeems
   the claim and uses the existing OpenAPI/API lifecycle.
4. Document the one-request bootstrap and protect its route, payload, and
   visible-copy references with focused tests.

## Validation

- `pnpm test:local worker/agent-session.test.ts apps/editor/src/agent/connect-agent-panel.test.tsx packages/agent-adapter/src/agent-kit.test.ts`
- `pnpm typecheck`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(agent): publish compact operating kit
```

## Outcome

Published a four-file, 3.9 KB browser-safe operating Kit at one read-only
`GET /api/agent/kit` route. The copied claim hand-off now directs an Agent to
materialize that private folder before redeeming the existing claim and calling
the unchanged OpenAPI. The editor bundle does not contain the Kit payload;
tests, typechecking, documentation-link validation, and a dependency-aware
production editor build passed.
