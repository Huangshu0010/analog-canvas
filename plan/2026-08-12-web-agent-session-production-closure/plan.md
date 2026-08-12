---
status: completed
experience: none
---

# Web Agent Session Production Closure

## Goal

Turn the disconnected web-Agent prototypes into one usable production vertical
slice: the published Worker creates and owns temporary session relay state, the
browser opens an authenticated command channel bound to the real Project and
Documents, external Agents claim and call the existing Circuit API, writes enter
the shared editor history/recovery path, and retry/scope/replacement guarantees
are deterministic.

## State and Ownership

Start state:

```text
## codex/web-agent-session-architecture
```

The worktree is clean at `6898437`. The preceding review found that WA0-WA3
contain useful contracts/core code, while WA4-WA7 were marked complete without
the Worker/DO/browser transport and product E2E required by their exit gates.

Owned paths:

- `packages/agent-adapter/src/{envelope,session-state,service,openapi}.ts`
- focused Agent adapter tests and generated Agent API artifacts
- `worker/{agent-session,index}.ts`, their tests, `wrangler.jsonc`
- `apps/editor/src/agent/**`
- `apps/editor/src/document/document-controller.ts` and focused tests
- the minimum `apps/editor/src/app/App.tsx` integration and Agent-session E2E
- `docs/adr/0016-browser-authoritative-agent-session.md`,
  `docs/specs/web-agent-session.md`, Agent API usage docs and roadmap status
- WA4/WA5/WA7 plan status corrections, this plan, and one `plan/log.md` entry
- dependency/lockfile changes only if the Worker runtime test needs them

Read-only shared contracts unless a failing integration proves a required
change: circuit model schemas, routing/edit kinds, symbol assets, renderer
geometry, SPICE import, VDD rail implementation, and unrelated editor features.

## Work

1. Make the session state serializable and safe: hashed secret verifiers,
   in-flight request dedupe with payload identity, bounded result cache,
   Project/Document/scope checks, and explicit lifecycle snapshots.
2. Implement and route a real `AgentSessionDO`: create, claim by POST body,
   browser WebSocket, circuit forwarding/result correlation, control/revoke,
   SSE events, persistence, timeout/offline behavior, CORS, and limits; register
   Worker binding/migration.
3. Replace the browser-local fake session with a network client bound to the
   actual Project/session identity and Documents. Instantiate the live
   `BrowserAgentHost`/Circuit service, handle relay messages, synchronize UI and
   recovery, publish results/events, and revoke on Project replacement/close.
4. Correct UI lifecycle labels and automatic expiry; never display Connected
   before claim/channel readiness.
5. Align OpenAPI/docs with implemented routes and move claim secrets out of URL
   paths.
6. Add deterministic unit/integration tests for concurrency, payload mismatch,
   scope/document isolation, Worker routing/DO behavior, browser host wiring,
   project replacement, and grant-to-edit-to-undo/revoke product flow.
7. Restore truthful WA4/WA5/WA7 and roadmap status, then run focused checks and
   the complete delivery gate justified by this cross-runtime change.

## Validation

- focused Agent adapter, Worker, controller, browser-host and panel tests
- production editor build and Worker dry-run/bundle validation
- Playwright web-Agent grant/claim/snapshot/transact/undo/pause/revoke flow
- 100/500-instance existing Snapshot/render performance gate
- `pnpm agent-api:artifacts:check`
- clean `pnpm install --frozen-lockfile` followed by `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as one corrective vertical-slice commit after the complete acceptance
flow is green:

```text
feat(agent): connect browser-authorized Agent sessions end to end
```

## Outcome

Delivered the browser-authoritative production vertical slice. The published
Worker now routes the public session/claim/Circuit/SSE/control/OpenAPI surface
to a real `AgentSessionDO`; the browser authenticates a Project-bound WebSocket
and executes strict Circuit API requests through the live
`EditorDocumentController`/`DocumentHistory` path. Scope and Document isolation,
Project-replacement fencing, hashed credentials, bounded request/message/cache
limits, persisted non-content request ledgers, browser-side at-most-once
dedupe, expiry alarms, revocation cleanup, lifecycle/revision events, and
no-Project-payload Durable Object storage are covered.

The Connect Agent UI now reflects the real network lifecycle, preserves a live
session when its panel is merely closed, exposes pause/resume/revoke and a
bounded audit, and copies self-describing Agent connection instructions linked
to the deployed OpenAPI document. The generated contract and accepted
ADR/spec/roadmap now describe the implemented routes.

Validation is green on the final code: frozen install; `pnpm ci:check` under the
CI environment (static, 108 files / 669 unit tests, production/release/perf
checks, and 92 Playwright scenarios); focused Agent product E2E; generated API
artifact check; 500-instance performance baseline; production build; Wrangler
4.120.1 dry-run with both Durable Object bindings; `git diff --check`. Earlier
no-retry local 16-worker runs exposed pre-existing resource-sensitive E2E
timeouts, and every affected scenario passed focused; the canonical CI run with
its configured retry completed successfully without weakening any check.
