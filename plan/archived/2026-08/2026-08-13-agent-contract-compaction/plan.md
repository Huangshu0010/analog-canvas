---
status: completed
experience: none
---

# Agent Contract Single Source and Artifact Compaction

## Goal

Make the live Agent capability advertisement agree with the edits actually
accepted by the Agent transaction boundary, including annotation operations,
and compact the generated JSON Schema/OpenAPI representation without changing
the external request/response payload protocol or existing editing behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean at `0ff4eb0`; the target was then placed on
`codex/agent-contract-compaction`. No user or other-worker changes overlap this
target.

Owned paths:

- `packages/agent-adapter/src/schema.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/openapi.ts`
- focused Agent adapter tests
- `worker/agent-session.ts` and its focused relay test, because the relay maps
  the same canonical edit category to granted transport scopes
- `fixtures/agent-api/agent-circuit-*.json`
- current Agent API specification when the capability contract needs wording
- this plan and `plan/log.md`

Shared dependencies and contracts:

- `SchematicEditSchema` in `@icm/edit-engine` remains the mutation authority
  and is read-only unless a demonstrated single-source requirement cannot be
  met from the exported schema.
- Existing API v1/v2 payloads, permissions, transaction semantics, RichText,
  annotation persistence, and legacy annotation rendering are compatibility
  boundaries and must not change.
- Generated artifacts must remain deterministic and resolvable as Draft
  2020-12/OpenAPI 3.1 schemas.

## Work

1. Characterize current edit-kind drift and artifact size/reference baselines.
2. Derive advertised Agent edit kinds from the canonical Edit Engine schema,
   retaining only an explicit, tested high-level `wire` intent exception and
   excluding unsupported history operations.
3. Add parity tests proving supported annotation/drafting/NoConnect edits are
   advertised and that advertised typed edits are accepted by the Agent
   boundary.
   Make the web relay consume the same edit-kind classifier for scope checks.
4. Generate request/response schemas with reusable definitions and publish one
   copy of each through OpenAPI components with valid rebased references.
5. Regenerate artifacts, add deterministic reference/size/behavior gates, and
   update the current API specification without rewriting historical logs.

## Validation

- focused Agent adapter schema/service/OpenAPI tests
- request fixture parsing and capability/edit parity tests
- generated local-reference resolution checks
- `pnpm agent-api:artifacts:check`
- Agent adapter typecheck/build and affected workspace tests
- `pnpm install --frozen-lockfile` and `pnpm ci:check` before delivery because
  this changes a public generated contract
- required GitHub checks on the review branch
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
refactor(agent): compact and unify generated contracts
```

## Outcome

The Agent capability response now derives every supported typed edit from the
canonical Edit Engine discriminated union. Annotation, drafting, NoConnect,
and presentation edits are advertised; `undo`/`redo` remain excluded; `wire`
is retained as the sole explicit high-level intent capability. The web relay
uses the same edit-kind classifier for transport scopes.

Generated request/response schemas now reuse Draft 2020-12 `$defs/$ref`, and
OpenAPI publishes one request and one response component with rebased,
deterministically validated local references. The three artifacts fell from
3,620,359 bytes to 420,352 bytes (88.4%) without changing payload semantics.
Reference-resolution, capability parity, and size-regression tests were added.

Validation passed: 69 focused Agent/session tests, workspace typecheck, Agent
artifact regeneration/check, frozen install, and full `pnpm ci:check` with 671
unit/integration tests and 99 Playwright tests plus build, performance, export,
PWA, production-preview, packaging, and release-smoke gates.
