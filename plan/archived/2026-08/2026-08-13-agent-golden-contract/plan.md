---
status: completed
experience: none
---

# Agent Golden Path and Recoverable Request Contract

## Goal

Make the existing four-operation Circuit API self-sufficient for an external
Agent: one copied lifecycle, one production request schema, one stable
machine-repairable error envelope, atomic dry-run/commit guidance, and focused
contract tests. Do not add a Circuit operation, validation endpoint, SDK, or
source-code dependency.

This target also begins isolating new Agent writes from runtime legacy input
compatibility. It must not claim that the wider VDD/Port/RichText/typed-netlist
migration audit is complete; those model migrations need separate targets
before legacy readers/assets can be removed safely.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle
```

The branch was dirty with an unplanned AP2 Project-transaction prototype owned
by the preceding coworker. The new user boundary explicitly pauses Project API
expansion. Those changes were preserved reversibly as
`stash@{0}: wip/ap2-project-transactions-before-four-operation-contract`; the
worktree is now clean. This target does not consume or overwrite that stash.

Owned paths:

- `packages/agent-adapter/src/schema.ts`
- `packages/agent-adapter/src/diagnostics.ts` or a narrow new shared request
  error module under `packages/agent-adapter/src/`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/openapi.ts`
- `packages/agent-adapter/src/index.ts`
- focused `packages/agent-adapter/src/*.test.ts`
- `worker/agent-session.ts`
- `worker/agent-session.test.ts`
- `apps/editor/src/agent/use-agent-session.ts`
- `apps/editor/src/agent/connect-agent-panel.tsx`
- focused editor Agent tests and web-session E2E where required
- generated `fixtures/agent-api/` artifacts
- current Agent usage/response documentation where the public contract changes
- mechanical Prettier-only normalization of the already-committed AP1 files
  `packages/agent-adapter/src/catalog.ts`, `snapshot.ts`, and
  `snapshot.v3.test.ts` when required by the branch gate; no AP1 behavior change
- this plan and `plan/log.md`

Read-only/shared dependencies:

- `packages/edit-engine` current atomic/dry-run/revision behavior
- `packages/model` legacy migration schema
- the AP2 stash named above
- current VDD/Port/RichText/netlist compatibility paths identified in the
  supplied audit

## Work

1. Define one exported request parser and stable error converter used by the
   relay, browser host, and Circuit service. Return all schema issues as
   redacted `SCHEMA_VIOLATION` diagnostics with stable paths; malformed JSON
   uses the same `INVALID_REQUEST` envelope without a field path.
2. Ensure a schema-invalid request is rejected by the relay before browser
   forwarding/idempotency execution and cannot change a Document revision.
3. Publish explicit OpenAPI responses for 200/400/401/403/409/413/429/503 and
   five minimal legal examples: claim, capabilities, snapshot, transact
   dry-run, and render. All examples must validate against production schemas.
4. Replace Copy Instructions with the fixed ten-step lifecycle. Never copy,
   log, or display a bearer token. Closing the panel remains UI-only.
5. Audit the Agent authoring input versus migration-only legacy shapes. Add a
   strict Agent authoring schema for legacy alternatives that can be isolated
   without first changing persisted model authority; record blocked wider
   migrations rather than falsely narrowing the compatibility schema.
6. Add focused contract coverage: copied claim lifecycle, OpenAPI examples,
   empty `symbolVariantId` path, no forward/no revision change, panel Close,
   exact-payload idempotency, and every public response matching a declared
   OpenAPI schema.
7. Assess a user-triggered Rotate Agent Access control. Implement it only if it
   can invalidate the previous bearer capability without adding a Circuit
   operation or silently broadening scopes; otherwise record the precise
   missing session-machine authority for the next target.

## Validation

- `pnpm test:local packages/agent-adapter/src/service.test.ts packages/agent-adapter/src/contract-characterization.test.ts worker/agent-session.test.ts apps/editor/src/agent/connect-agent-panel.test.tsx apps/editor/src/agent/browser-agent-host.test.ts`
- relevant web-session E2E if session UI/control behavior changes
- `pnpm agent-api:artifacts`
- `pnpm agent-api:artifacts:check`
- `pnpm typecheck`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

Run `pnpm verify:branch` when the completed target crosses the relay, browser,
generated contract, and editor boundaries as expected.

## Commit Intent

Commit as one bounded contract change only after focused and branch validation:

```text
fix(agent): close the four-operation request contract
```

## Outcome

Closed the hosted Agent surface around one v2 four-operation request/response
schema and one shared parser/error converter. Relay and browser reject invalid
requests before forwarding, while the explicitly named compatibility parser
keeps frozen local v1/v3 fixtures isolated from production OpenAPI and
capabilities. Copy Instructions now define the complete claim-to-verification
lifecycle; Close remains UI-only and Rotate revokes then recreates access with
the same Project, Documents, and scopes. New Agent writes require canonical
RichText/VisualAnchor/typed-netlist forms where current model authority exists.

The wider VDD/Port/power-domain and remaining persisted compatibility migration
is deliberately unresolved and was not represented as complete. The paused
AP2 prototype remains recoverable in
`stash@{0}: wip/ap2-project-transactions-before-four-operation-contract`.

Validation passed: 63 focused contract tests, the web Agent session E2E,
generated artifact check, typecheck, docs check, and `pnpm verify:branch`
(113 files / 705 tests, all workspace builds, production smoke). Final rerun
after capabilities cleanup passed the same 705-test branch gate and E2E.
