# Razavi Symbol Proportion and Stroke Calibration

## Goal

Calibrate the fixed Razavi symbol assets so MOS bodies are slightly narrower
along the gate axis, ground symbols extend further along their lead axis, VDD
bars are shorter, palette ports render as solid dots, and ordinary component
strokes match schematic wires without moving electrical pin anchors off-grid.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
 M apps/editor/src/App.tsx
 M apps/editor/src/styles.css
 M packages/edit-engine/src/presentation.test.ts
 M packages/edit-engine/src/transaction.ts
 M packages/model/src/factories.ts
 M packages/model/src/schema.test.ts
 M packages/render-svg/src/render.test.ts
 M packages/render-svg/src/schematic-text.ts
 M plan/log.md
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-precise-hit-targets-and-text-markup/
?? plan/2026-08-08-razavi-default-and-style-switch/
```

The dirty editor, model, edit-engine, renderer-text, and earlier plan paths
belong to the active UI/style implementation stream. This target will not
alter their semantics except for additive renderer tests where necessary.
The architecture-audit plan is unrelated and remains read-only. No current
dirty path overlaps the symbol source generators or generated catalog assets.

## Owned Files

- `scripts/generate-visio-mos-assets.mjs`
- `scripts/generate-visio-core-analog-assets.mjs`
- `packages/symbols/src/schema.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/symbols/assets/razavi-v1/*.symbol.json`
- `packages/symbols/src/generated/razavi-catalog.generated.ts`
- `fixtures/visual-golden/visio-mos-fidelity.svg`
- `fixtures/visual-golden/visio-core-analog-fidelity.svg`
- `fixtures/visual-golden/phase-1-manual.svg`
- `fixtures/visual-golden/phase-5-dense-analog.svg`
- `packages/render-svg/src/style-profile.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `plan/2026-08-08-razavi-symbol-proportion-and-stroke-calibration/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss` (binary Visio source; do not inspect or modify as text)
- `apps/editor/src/**`
- `packages/model/src/**`
- `packages/edit-engine/src/**`
- `plan/2026-08-08-flat-cdac-new-architecture-audit/**`

## Shared Dependencies

- Symbol DSL schema and renderer must agree on circle presentation.
- Generated Razavi symbol assets and catalog must remain generated from their
  source scripts; do not hand-edit output.
- Electrical pin coordinates remain authoritative and must stay on the
  existing 10-unit grid.
- The Razavi style profile is shared by canvas rendering and formal SVG export.

## Expected Work

1. Add a generator-level geometry calibration that narrows MOS internal
   geometry along its gate axis while retaining all external pin anchors.
2. Add a source-level calibration that lengthens the ground artwork down its
   extension axis and make the palette port circle explicitly solid.
3. Extend the DSL/rendering only as needed for an explicitly filled,
   stroke-free circle, regenerate affected catalog assets, and assert the
   generated contract.
4. Align normal component strokes to wires and shorten the VDD supply bar in
   the Razavi style profile; add focused renderer checks.

## Validation

- `pnpm symbols:visio-mos`
- `pnpm symbols:visio-core-analog`
- `pnpm symbols:razavi`
- focused `packages/symbols` and `packages/render-svg` tests
- `pnpm --filter @interactive-circuit/editor build`
- `git diff --check`
- `git status --short --branch`

Generator runs prove output is derived rather than manually patched. Focused
tests cover the shared DSL/render contracts; the editor build covers its SVG
consumer without unnecessarily running the known unrelated workspace typecheck
failure.

## Experience Signal (for human review)

None.

## Commit Intent

Commit as:

```text
style: calibrate Razavi symbol proportions and strokes
```
