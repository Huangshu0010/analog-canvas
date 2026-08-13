---
status: completed
experience: none
---

# Agent Transport Watchdog

## Goal

Make the browser-hosted Agent channel detect silent transport failure and recover promptly without changing the browser-authoritative editing model or replaying requests.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This target owns the browser session transport, Worker relay liveness handling, their focused tests, and current Agent connection documentation:

- `apps/editor/src/agent/`
- `worker/agent-session.ts`
- `worker/agent-session.test.ts`
- focused Agent transport documentation under `docs/agent/` and `docs/specs/`
- this plan and `plan/log.md`

Shared contracts: Agent envelopes and the public HTTP API remain unchanged. Project persistence, edit execution, and request replay are out of scope.

## Work

1. Add application-level WebSocket heartbeat acknowledgement and a browser stale-connection watchdog that reuses the existing reconnect loop.
2. Trigger immediate liveness recovery when the browser returns online or the page becomes visible.
3. Add periodic SSE keepalive comments so idle intermediaries do not silently expire the Agent event stream.
4. Protect the behavior with focused tests and document the transport semantics.

## Validation

- Focused editor Agent-session tests.
- Focused Worker Agent-session tests.
- Relevant TypeScript checks if exposed by the owning packages.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(agent): add transport liveness watchdog
```

## Outcome

Added a shared heartbeat control-frame contract, browser stale-connection
watchdog and wake recovery, and Worker SSE keepalive comments without changing
Circuit requests or replay semantics. Focused transport tests (25), full
typecheck, and `pnpm verify:branch` (121 files, 733 tests, workspace builds and
production smoke) passed. The generated Agent API artifact check also passed.
