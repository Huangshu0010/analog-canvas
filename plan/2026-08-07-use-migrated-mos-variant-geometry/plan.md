# Use Migrated MOS Variant Geometry

## Goal

Remove the guessed MOS-arrow edits and make the four-terminal SPICE NMOS/PMOS
definitions render their three-terminal presentation from the already migrated
`nmos3`/`pmos3` geometry, while preserving the electrical `B` pin and the
reviewed four-terminal default artwork.

## Dirty-State Note

The shared worktree contains ongoing editor, connection-grid, Agent API,
hierarchy, Phase 9, and CDAC work. The symbol schema, builtins, renderer, tests,
spec, goldens, and log are already dirty from those targets. This correction
claims only focused variant-geometry fields/rendering, MOS definitions/tests,
the flattened CDAC recipe/artifacts, this plan, and its factual log entry. It
preserves all unrelated edits in the same files. The prior hand-edited-arrow
target remains visible as a failed review step rather than being deleted.

## Owned Files

- focused variant fields in `packages/symbols/src/schema.ts`
- focused MOS geometry in `packages/symbols/src/builtins.ts`
- focused symbol tests in `packages/symbols/src/builtins.test.ts`
- focused variant rendering in `packages/render-svg/src/render.ts`
- focused renderer tests in `packages/render-svg/src/render.test.ts`
- focused contract text in `docs/specs/symbol-dsl.md`
- regenerated variant-consumer goldens
  `fixtures/visual-golden/phase-1-manual.svg` and
  `fixtures/visual-golden/phase-5-dense-analog.svg`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-flat-layout.mjs`
- regenerated `razavi-6bit-cdac-flat.*`
- this plan and this target's `plan/log.md` entry

## Read-Only Files

- `lib/circuit.vss`
- `fixtures/symbols/circuit-vss-review.json`
- reviewed and migration-candidate contact-sheet goldens
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
- all unrelated dirty paths

## Shared Dependencies

- Reviewed `nmos`/`pmos` four-terminal defaults must continue matching their
  VSS-backed golden.
- `nmos3`/`pmos3` source-arrow geometry remains the migration evidence.
- Variant presentation may add geometry but must never add, remove, or reorder
  electrical pins.
- Endpoint routing continues to use the canonical four-terminal definition.

## Expected Work

1. Restore the reviewed four-terminal bulk-arrow geometry exactly.
2. Extend visual variants with bounded additional primitives and render them
   after filtering hidden default parts.
3. Build the textbook three-terminal MOS variant from the migrated source-arrow
   coordinates; normalize the PMOS candidate for the canonical electrical
   orientation used by the editor.
4. Keep CDAC instances on canonical `nmos`/`pmos` plus the visual variant, so
   every `B` terminal remains valid.
5. Regenerate and inspect the flattened CDAC.

## Validation

- Run focused symbol schema/builtin/resolver and SVG renderer tests.
- Build symbol, derived, renderer, exporter, and Agent-layout dependencies.
- Require `pnpm symbols:review:check` to pass without changing its goldens.
- Regenerate the flattened CDAC and confirm all 25 MOS devices resolve the
  three-terminal visual variant while retaining 25 `B` Net terminals.
- Require zero visual diagnostics and inspect the PNG.
- Confirm `circuit.spi` has no diff, then run Prettier, `git diff --check`, and
  final status review.

## Commit Intent

Keep the correction uncommitted with the current user-reviewed prototype.
