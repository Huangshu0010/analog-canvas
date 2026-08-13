---
status: completed
experience: none
---

# Explicit Power-Domain Authority

## Goal

Replace the runtime semantic dependence on hidden `vdd`/`ground` symbol
instances with persisted `Net.powerDomain`, and make newly created VDD rails
first-class electrical objects without an invisible legacy instance. This is
the first prerequisite target from the Agent current-authority audit; it does
not yet delete legacy visual symbol assets or redesign first-class Port
presentation.

## State and Ownership

Start state:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean. No other worktree or fetched remote branch currently
owns VDD rail code. The earlier AP2 prototype remains isolated in
`stash@{0}: wip/ap2-project-transactions-before-four-operation-contract` and
is read-only for this target.

Owned paths:

- `packages/model/src/schema.ts`, `power-domain.ts`, `persistence.ts`, a new
  v4-to-v5 migration and its tests/exports
- `packages/edit-engine/src/transaction.ts` plus focused transaction tests
- `packages/derived` and `packages/render-svg` callers only where they must
  consume the new field
- `apps/editor/src/features/component-insert/vdd-rail.*` and narrow caller
  adjustments
- affected fixture/schema tests, agent schema/snapshot parity when a writable
  Net field must be visible to the Agent
- current model/Agent contract docs, this plan, and `plan/log.md`

Shared read-only dependencies:

- the persisted Project compatibility corpus and legacy VDD/ground visual
  symbols; assets are not deleted in this target
- current Port dual representation and typed-netlist migration; both require
  separate authority targets

## Work

1. Add a persisted explicit power-domain state to `Net` and bump the Project
   schema with an idempotent v4-to-v5 migration. Migration may infer a domain
   from old VDD/ground terminals exactly once; runtime consumers must not use
   that inference afterward.
2. Refactor power-domain consumers (normalization, ERC, MOS bulk resolution,
   rendering, and power-route validation) to read `Net.powerDomain` only.
   Preserve migrated legacy conflicts as an explicit diagnostic state rather
   than silently choosing a domain.
3. Introduce one typed document edit for a VDD rail that atomically creates its
   explicit global Net, route anchors, editable power Route, and canonical
   RichText label. It must not create a hidden `vdd` instance.
4. Make the editor VDD tool use that edit; protect all generated IDs and
   geometry with transaction-level preconditions.
5. Expose the new Net fact in the production Snapshot and add focused model,
   transaction, Agent, and editor regression coverage.

## Validation

- focused model migration/power-domain, edit-engine transaction, derived/ERC,
  renderer, Agent Snapshot, and VDD tool tests
- `pnpm agent-api:artifacts` and `pnpm agent-api:artifacts:check` if Agent
  schema changes
- `pnpm typecheck`, `pnpm docs:check`, `git diff --check`
- `pnpm verify:branch` before branch delivery

## Commit Intent

```text
feat(model): make Net power-domain explicit
```

## Outcome

Implemented schema v5 with an idempotent v4-to-v5 migration that records each
Net's explicit `powerDomain`. Runtime normalization, ERC, MOS-bulk derivation,
rendering, topology hashing, and Agent Snapshot now consume only that field.
New VDD rails use the atomic `add_power_rail` edit, which creates an explicit
global Net, route anchors, editable rail, and RichText label without a hidden
VDD instance; the Agent may use that edit and may not create a legacy VDD
symbol. Generic placement no longer grants legacy VDD markers electrical
authority, while current ground insertion persists its explicit domain in the
same transaction.

Validation passed: focused model/edit/Agent/editor tests, full local unit
suite (114 files, 708 tests), typecheck, generated Agent artifact write/check,
documentation and reference checks, `git diff --check`, and `pnpm
verify:branch` (including build and production smoke).
