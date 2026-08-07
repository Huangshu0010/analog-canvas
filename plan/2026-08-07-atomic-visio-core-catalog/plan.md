# Atomic Visio Core-Analog Catalog Generation

## Goal

Eliminate the split state in which Batch A Visio-derived asset JSON is newer
than the runtime Razavi catalog. One public Batch A command must make the
assets, catalog metadata, generated TypeScript adapter, and comparison board
consistent; its check mode must reject any partial state.

## Dirty-State Decision

The worktree contains concurrent editor, model, renderer, API, fixture, and
symbol work. The user explicitly requested this repair after the runtime
catalog was observed stale. The affected core-analog generator, catalog,
adapter, assets, package scripts, and related documentation are the earlier
Batch A migration's owned outputs. This target may update those files only and
will preserve unrelated changes, including `plan/log.md`.

## Owned Files

- `plan/2026-08-07-atomic-visio-core-catalog/plan.md`
- `scripts/generate-visio-core-analog-assets.mjs`
- `scripts/generate-razavi-symbol-catalog.mjs` only if needed for a reusable
  no-write generation interface
- `package.json` focused generator/check commands
- Batch A assets, catalog metadata, and generated catalog adapter
- Batch A comparison board and focused generator/catalog tests/docs if needed
- `tools/vss-import/README.md` and the Razavi asset README

## Expected Work

1. Make the core-analog generator update and validate Batch A provenance and
   asset hashes in `catalog.json`.
2. Have the same public command deterministically invoke catalog adapter
   generation after asset generation; check mode must perform both checks.
3. Add a regression assertion that `builtInSymbols` resolves the newly derived
   resistor/capacitor geometry rather than stale generated definitions.
4. Rebuild the editor and verify the generated runtime symbol definitions.

## Validation

- `pnpm symbols:visio-core-analog` followed by its check mode
- `pnpm symbols:razavi:check`
- focused symbol/runtime resolver test, `pnpm typecheck`, and `pnpm build`
- inspect the runtime-resolved Batch A geometry and `git diff --check`

## Commit Intent

Committed independently on 2026-08-08 as part of a worktree-split sequence.
The earlier "do not commit separately while concurrent work is uncommitted"
hold was lifted by the user's explicit instruction to split the dirty
worktree into self-contained groups; this target (the self-contained
core-analog catalog migration) landed first because it has no cross-package
source coupling to the editor/model/renderer changes held in other groups.

## Outcome

- The core-analog generator now computes its eight asset hashes, records
  source/reference/converter provenance in `catalog.json`, and invokes the
  catalog generator itself. This applies to direct Node invocation as well as
  the package command.
- Its check mode now rejects stale asset JSON, Batch A catalog metadata,
  generated TypeScript adapter, or comparison board. A stale catalog can no
  longer pass the Batch A check while the editor resolves an old runtime symbol.
- Regenerated the catalog and adapter. The built runtime resolver now returns a
  source-derived vertical resistor/capacitor/inductor and circular port, rather
  than the old horizontal handwritten definitions.
- Added a regression assertion that the editor-facing `builtInSymbols`
  resistor is the source-derived catalog object with north/south grid pins.
- Passed: core-analog generation/check, catalog check, focused catalog tests,
  typecheck, workspace build, formatting, and `git diff --check`.
- `plan/log.md` remained untouched because it was concurrently dirty; the target
  remained uncommitted with the wider worktree until the 2026-08-08 worktree-split
  sequence (see Commit Intent above), where it landed as group 1.
