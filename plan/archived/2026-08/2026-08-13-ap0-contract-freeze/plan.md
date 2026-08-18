---
status: completed
experience: none
---

# AP0 — Agent v3 Contract Freeze

Work package WP-AP0 of the
[Agent Project lifecycle and artifact completion roadmap](../../docs/roadmap/agent-project-lifecycle-and-artifacts-plan.md).

## Goal

Freeze the Agent v3 contract before any runtime change: the three-authority
split, the additive v3 operation set, runtime Project revision, the Project edit
inventory, Agent-safe history, artifact and import-candidate envelopes, the
import state machine, new permission scopes, new error codes and limits, relay
no-persistence assertions, and threat-model additions. Add characterization
tests that lock the current v2 boundary so the v3 delta is later visible.

This target changes documentation and one focused test file only. It introduces
no runtime behavior change and does not modify any Zod schema or regenerate
`fixtures/agent-api/`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle
```

The worktree is clean after Commit 1 (`docs: plan complete Agent project
lifecycle interfaces`, 41df4cb) on `codex/agent-project-lifecycle` off `main`
(74c9e27). No other worker overlaps this branch.

Owned paths:

- `docs/adr/0018-agent-project-lifecycle-and-v3-api.md`
- `docs/adr/README.md`
- `docs/specs/agent-api.md`
- `docs/specs/web-agent-session.md`
- `docs/specs/persistence-and-recovery.md`
- `docs/specs/project-file-format.md`
- `docs/specs/export.md`
- `docs/specs/editor-interaction.md`
- `packages/agent-adapter/src/contract-characterization.test.ts`
- `plan/2026-08-13-ap0-contract-freeze/plan.md`
- `plan/log.md`

Read-only and shared dependencies (credible overlap only):

- Read-only: `packages/agent-adapter/src/{schema,service,snapshot,envelope,diagnostics,openapi}.ts`
  and `apps/editor/src/agent/browser-agent-host.ts` — inspected to author
  characterization assertions, not edited.
- Shared: the generated wire contract under `fixtures/agent-api/` is NOT
  regenerated here. Per roadmap, generated artifacts change only in the work
  package that changes source schemas (AP1/AP8). AP0 freezes decisions in prose;
  the schema enum-closure of error codes is deferred to that package.

## Work

1. Author ADR 0018 (accepted, links to and extends ADR 0016 without rewriting
   it): three-authority split; v3 as additive (v1/v2 unchanged) with operation
   set `capabilities | snapshot | transact | artifact | render | collaborate`;
   runtime `projectRevision` (session-only, not persisted) and composite
   expected revisions; the Project edit inventory with dangling-hierarchy,
   last/top-Document, and port-removal rules; Agent history semantics
   (`undo_own_head`/`redo_own_head`, `HISTORY_DIVERGED`, no skipping human or
   other-Agent items); artifact and import-candidate envelopes; the import state
   machine; new scopes, error codes, and limits; relay no-persistence
   assertions; threat-model additions.
2. Update `docs/adr/README.md` to list ADR 0018.
3. Additive v3 sections to the six specs (v1/v2 prose untouched):
   `agent-api.md` (v3 operations/targets, exact Cell/Instance facts, domain
   error-code freeze), `web-agent-session.md` (new scopes, import state machine,
   transport/import codes, no-store assertions), `persistence-and-recovery.md`
   (commit/recovery/artifact/download as distinct states),
   `project-file-format.md` (runtime revision is not persisted; canonical export
   is `serializeProject()`), `export.md` (Agent `artifact` surface and envelope),
   `editor-interaction.md` (`collaborate` contract, zero persisted side
   effects).
4. Add `contract-characterization.test.ts` asserting today's frozen v2 boundary:
   exact v1/v2 operation sets; `apiVersion` is exactly `["1.0","2.0"]`;
   `AGENT_EDIT_KINDS` excludes `undo`/`redo` and has no project/catalog ops;
   `transact` with `{kind:"undo"|"redo"}` returns `UNSUPPORTED_EDIT`; the
   Snapshot is `snapshotVersion "1.0"`, Document-scoped, and carries no
   `projectRevision`; the session scopes are exactly the six `circuit.*`; the
   capabilities `limits` and error-envelope shape.
5. Add a short generated-contract delta review note below: what the v3
   schema/artifact delta will be when AP1/AP8 land (no regeneration in AP0).
6. Record a factual `plan/log.md` entry.

## Validation

- `corepack pnpm test:local packages/agent-adapter/src/contract-characterization.test.ts`
- `corepack pnpm docs:check`
- `corepack pnpm references:check`
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

No runtime behavior change, no e2e/build/full-suite gate is justified for AP0.

## Commit Intent

Commit as:

```text
docs(agent): freeze v3 contract surface and ADR 0018
```

## Generated-contract delta review (for AP1/AP8, not this target)

When AP1 changes Snapshot source schemas and AP8 publishes the public contract,
the generated `fixtures/agent-api/` delta is expected to include: a new
`apiVersion` value `"3.0"` and `/v3/circuit` path; new request/response
discriminants for `artifact` and `collaborate`; new scopes in the session
schema; the v3 error codes added to the (currently open-string) `error.code`
and transport-code enums; and `projectRevision`/`expectedProjectRevision` fields
on Project-targeted requests/responses. None of these are produced in AP0.

## Outcome

Froze the Agent v3 contract in ADR 0018 (accepted, extending ADR 0016 without
modifying it): the three-authority split, the additive v3 operation set
(`capabilities | snapshot | transact | artifact | render | collaborate`),
runtime `projectRevision`, the Project edit inventory and removal rules,
Agent-safe history, artifact and import-candidate envelopes, the import state
machine, the new permission scopes, the new error codes, the new limits, and the
relay no-persistence and threat-model additions. Added additive "Agent v3
extension (ADR 0018)" sections to the six referenced specs and listed the ADR in
the index. Added `contract-characterization.test.ts` locking the current v1/v2
boundary so the v3 delta is visible later. No Zod schema or generated
`fixtures/agent-api/` artifact changed.

Validation completed: the 7-test characterization suite, `pnpm docs:check` (104
files), `pnpm references:check`, `pnpm typecheck`, and `git diff --check` passed;
final status review shows only the intended AP0 files.
