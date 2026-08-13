# ADR 0019: Four-Operation Agent Golden Contract

Status: `accepted`

Date: `2026-08-13`

Supersedes: the API-surface expansion in
[`ADR 0018`](0018-agent-project-lifecycle-and-v3-api.md)

Owners: `packages/agent-adapter`, `worker`, `apps/editor/src/agent`,
`docs/specs/agent-api.md`, `docs/specs/web-agent-session.md`

## Context

ADR 0018 proposed completing Project lifecycle, artifacts, and editor
collaboration by expanding the Circuit operation set to include `artifact` and
`collaborate`. Early AP1 work also introduced additive v3 Snapshot targets.
Before AP2 landed, external-Agent testing showed that operation count was not
the limiting reliability problem. A new Agent instead lacked one complete
copied lifecycle, received inconsistent schema failures from relay and service,
and could legally author migration-only legacy shapes because Agent `transact`
reused the persisted compatibility schema directly.

The product requirement is not that an unfamiliar Agent never makes a first
mistake. It is that there is one correct route, every mistake is mechanically
repairable, invalid input has zero canvas effect, and the public OpenAPI plus
claim/capabilities/Snapshot contain everything needed without source, SDK, MCP,
or another protocol.

## Decision

The Circuit API has exactly four operations:

```text
capabilities -> snapshot -> transact -> render
```

Do not add `validate`, `plan`, `compile`, `artifact`, `collaborate`, or another
Circuit operation. Structural validation uses the one published request
schema. Semantic validation uses `transact.dryRun`. Mutation uses the same
atomic `transact` only after a successful dry run at the unchanged revision.
Visual review uses `render`; final facts use a fresh `snapshot`.

Project lifecycle work may later extend the typed targets/intents carried by
these four operations or add an explicitly browser-owned file resource after a
separate decision, but it cannot add a fifth Circuit operation. AP2 Project
transaction work is paused until this contract is closed and the strict current
authoring schema no longer exposes migration-only alternatives.

### One copied lifecycle

The Connect Agent panel copies ten numbered steps: redeem once, keep the claim
response in memory, never expose the bearer, use only returned IDs, call
capabilities, read one complete Snapshot, validate against online OpenAPI,
dry-run, commit unchanged edits only at the same revision, render and refresh
Snapshot, and reuse a requestId only for an identical retry.

Closing the panel is presentation-only. It does not revoke or pause a session.
If access credentials are lost, the user may explicitly rotate access: revoke
the old capability and create a new single-use claim for the same Project,
Documents, and scopes. There is no refresh-token family.

### One production request schema

The hosted relay and browser host import the same production request
schema/parser. The production schema admits only API v2 and the four operations;
the hosted OpenAPI does not publish a v1 route or v3 target. The library service
retains an explicitly named compatibility parser solely for frozen local v1/v3
fixtures and the optional loopback migration path. Transport layers may enforce
bytes, authentication, scope,
Document authorization, rate limits, and requestId idempotency, but must not
reinterpret field validity or produce a different schema error.

Persisted Project migration may accept old forms. New Agent authoring may not.
An Agent-specific authoring schema rejects migration-only alternatives such as
annotation string fallback, `routeAttachment`, and writes to `spice.*`
properties. Wider removal of legacy VDD/Port symbols, runtime text parsing,
power inference, and typed-netlist fallbacks requires first establishing their
new model authority and migrating fixtures; this ADR does not authorize an
unsafe deletion.

### One error envelope

Every structurally invalid Circuit request returns:

- `operation: "error"`, `ok: false`;
- `error.code: "INVALID_REQUEST"`;
- stable `SCHEMA_VIOLATION` diagnostics for all detected issues;
- a `path` array of field names and indices when JSON structure permits;
- human-readable messages without rejected values or Zod implementation terms.

Malformed JSON uses the same envelope with no fabricated field path. Schema
failure occurs before forwarding/idempotent execution and cannot change
revision, history, recovery, selection, or canvas state.

### OpenAPI and tests

The deployed OpenAPI is the sole request contract. The session Circuit endpoint
declares 200, 400, 401, 403, 409, 413, 429, and 503 responses and includes
minimal claim, capabilities, Snapshot, dry-run transaction, and render
examples. Examples are executed against production schemas. Contract tests
prove precise error paths, no forwarding/no revision change, close semantics,
exact-payload idempotency, and declared response shapes.

## Consequences

- The uncommitted AP2 Project-transaction prototype is not delivered as part of
  this decision.
- ADR 0018 remains historical evidence, but its six-operation v3 surface and
  AP2--AP9 sequencing are superseded.
- Already implemented additive Snapshot/catalog code must be reconciled in a
  later compatibility target; it remains migration-only and is not published
  by the hosted OpenAPI or v2 capabilities.
- Agent reliability improves through deterministic evidence and repair rather
  than more endpoints, prompts, or SDK logic.

## Validation

- copied-instruction contract test;
- production-schema validation of all OpenAPI examples;
- exact `symbolVariantId` violation path;
- invalid request rejected before browser forwarding and revision mutation;
- same requestId/same payload exactly-once tests;
- Connect Agent close and rotate behavior tests;
- generated OpenAPI/schema artifact check.
