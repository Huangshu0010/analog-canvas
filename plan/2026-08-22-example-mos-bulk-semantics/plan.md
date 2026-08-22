---
status: completed
experience: none
---

# Repair bundled Example MOS bulk semantics

## Goal

Remove `ERC_BULK_UNRESOLVED` from every bundled Example by recording the
already-visible VDD/0 body intent in the Example Project data, without changing
diagnostic rules, topology, artwork, Net names, or unrelated Example content.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-transform-power-bulk...origin/main [ahead 6]
```

The worktree is clean. The preceding six commits belong to the completed
transform/Ground/bulk-default targets on this same review branch. This target
owns only:

- `apps/editor/src/examples/current-mirror-loaded-differential-pair.icproj.json`
- `apps/editor/src/examples/fully-differential-two-stage-op-amp.icproj.json`
- `apps/editor/src/examples/library-examples.test.ts`
- `plan/2026-08-22-example-mos-bulk-semantics/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only dependencies are the existing `mosBulkDefaults` Document contract,
`resolveMosBulkConnection()`, ERC, built-in Symbol resolver, and connectivity
index. No schema or migration behavior is owned.

## Work

1. Audit every bundled Example for MOS B terminals, binding origin, and cell
   defaults.
2. Materialize PMOS B on the Example's existing VDD Net and NMOS B on its
   existing canonical `0` Net, recording `cell-default` bindings and stable Net
   IDs.
3. Add a per-Example regression that rejects `ERC_BULK_UNRESOLVED` while
   retaining the existing schema/openability checks.

## Validation

- `pnpm test:local apps/editor/src/examples/library-examples.test.ts packages/derived/src/mos-bulk.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "opens named full-width Project examples"`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Early gates: schema-current Example unit check, static contracts, and test
  impact.
- Affected gates: Example unit plus the selected component-insert browser
  contract; JSON fixture paths may conservatively select broader editor checks.
- Final gates: `pnpm ci:check` and required remote checks before mainline
  delivery.
- Platform risks: JSON fixture drift and browser Example loading; no generated
  artifact or platform-specific behavior.

## Test Impact

- Decision: tests-updated
- Contracts: every bundled Example with MOS instances has a resolvable body
  connection and emits no `ERC_BULK_UNRESOLVED`.
- Primary checks: `library-examples.test.ts` runs ERC over every Example, with
  the component-insert browser workflow covering user-visible loading.

## Commit Intent

Commit as:

```text
fix(examples): record mos bulk defaults
```

## Outcome

Audited every bundled Example. The two affected differential fixtures now
persist their existing supply intent as stable NMOS/PMOS defaults, materialized
B terminals, and `cell-default` instance bindings; all other Example topology
and presentation remain unchanged. Both affected Examples show `Issues (0)` in
the live editor. Focused unit/browser checks, static contracts, preflight,
test-impact, and the full affected branch gate passed.
