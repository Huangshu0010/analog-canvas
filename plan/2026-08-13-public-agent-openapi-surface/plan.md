---
status: completed
experience: none
---

# Public Agent OpenAPI Surface

## Goal

Make the deployed OpenAPI itself enforce the one copied Agent path. It must
publish only endpoints an external Agent may call: claim redemption and the
single authenticated session Circuit endpoint. Browser-owner control,
WebSocket, session creation/revocation, loopback transport, and event plumbing
remain implementation details but are not Agent-discoverable operations. This
does not add or remove a Circuit operation.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean. This target owns generated public OpenAPI declarations,
their tests/artifacts, and current session/API documentation. It does not alter
worker routing, internal browser control, loopback behavior, Circuit edits, or
session authorization semantics.

- `packages/agent-adapter/src/openapi.ts`
- `fixtures/agent-api/agent-circuit.openapi.json`
- Agent OpenAPI/schema/service tests
- `docs/specs/{agent-api,web-agent-session}.md` and `docs/agent/api-usage.md`
- this plan and `plan/log.md`

Read-only shared dependencies:

- `worker/agent-session.ts` and browser session hook, which continue using
  private browser-owner paths
- strict v2 request and response schemas already validated in the preceding
  golden-path target

## Work

1. Remove loopback and browser-owner/private endpoints from the deployed
   OpenAPI while retaining their runtime implementation.
2. Keep only the claim and session Circuit endpoints, each with production
   request/response schemas and the five minimal golden examples.
3. Remove now-unreachable public components and make path-set tests prove no
   secret-bearing or alternate endpoint is discoverable.
4. Reconcile current documentation: distinguish the external Agent surface
   from browser-private/session and optional local development transport.

## Validation

- focused Agent OpenAPI/request/service and worker session tests
- `pnpm agent-api:artifacts` and `pnpm agent-api:artifacts --check`
- `pnpm docs:check`, `pnpm typecheck`, `git diff --check`
- `pnpm verify:branch` because this changes the deployed public contract
- `git status --short --branch`

## Commit Intent

Commit as:

```text
refactor(agent): publish only the external session surface
```

## Outcome

The deployed OpenAPI now publishes exactly two external-Agent paths: claim
redemption and the authenticated session Circuit endpoint. Loopback and
browser-owner transport routes remain runtime-private and are no longer
discoverable through the hosted contract. Generated artifacts, focused
contract/Worker tests, documentation checks, and full branch verification
passed.
