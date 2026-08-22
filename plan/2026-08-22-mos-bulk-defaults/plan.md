---
status: completed
experience: none
---

# Initialize and expose MOS bulk defaults

## Goal

Keep explicit MOS B terminals authoritative while initializing the existing
cell-level NMOS/PMOS default once from an explicit Ground or VDD-domain power
projection, and make that existing configuration editable in Properties.

## State and Ownership

This worktree contains one committed copy-transform target and one active
Ground-placement target. Their changed paths do not overlap this target.

- `apps/editor/src/features/component-insert/placement-connectivity.ts`
- `apps/editor/src/features/component-insert/placement-connectivity.test.ts`
- `apps/editor/src/features/component-insert/mos-bulk-defaults.ts`
- `apps/editor/src/features/component-insert/mos-bulk-defaults.test.ts`
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/component-insert/vdd-rail.ts`
- `apps/editor/src/features/component-insert/vdd-rail.test.ts`
- `apps/editor/src/app/App.tsx`

Read-only shared dependencies:

- `packages/derived/src/mos-bulk.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/edit-schema.ts`
- ADR 0036 and the existing `mosBulkDefaults` schema.

## Work

1. Plan one-time default initialization only after explicit successful Ground,
   VDD Port, or named Power Rail creation.
2. Reuse `set_mos_bulk_defaults` and `reconcile_mos_bulk`; do not infer from
   a Net name, polarity, or arbitrary vdd-domain Net discovery.
3. Add Properties controls for existing NMOS/PMOS default IDs.
4. Preserve imported/existing explicit B connection and No Connect priority.

## Validation

- `pnpm test:local apps/editor/src/features/component-insert/mos-bulk-defaults.test.ts apps/editor/src/features/component-insert/placement-connectivity.test.ts apps/editor/src/features/component-insert/vdd-rail.test.ts packages/derived/src/mos-bulk.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: gate review, static contracts, test impact.
- Affected gates: workspace unit plus component insertion, hierarchy, and
  editor browser checks selected by the actual diff.
- Final gates: `pnpm ci:check` and required remote checks before mainline
  delivery.
- Platform risks: browser Properties wiring and Power Rail insertion.

## Test Impact

- Decision: tests-updated
- Contracts: first explicit ground/vdd projection sets only an unset stable-ID
  default; later rails do not overwrite it; explicit B remains dominant.
- Primary checks: placement, rail, App, and derived bulk tests.

## Commit Intent

Commit as:

```text
feat(connectivity): initialize configurable mos bulk defaults
```

## Outcome

Implemented stable-ID defaults with no automatic name scan: the first explicit
Ground sets an unset NMOS default; the first explicit VDD Port or named Power
Rail (including AVDD) sets an unset PMOS default. Properties now exposes both
existing default IDs. Later placements cannot overwrite a choice, and explicit
or no-connect B decisions remain authoritative. Focused tests, static
contracts, preflight, test-impact, and the affected gate passed.
