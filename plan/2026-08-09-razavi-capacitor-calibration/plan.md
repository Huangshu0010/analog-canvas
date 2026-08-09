# Razavi Capacitor Calibration

## Goal

Calibrate the runtime capacitor against the archived C1 vertical and C2
horizontal evidence within the sole Razavi reference authority.

## Dirty-State Decision

`apps/editor/src/App.tsx`, `packages/model/src/schema.ts`, and the Render-SVG
rich-text files plus their untracked editor/plan artifacts belong to a
concurrent target. This target owns only capacitor asset/catalog, visual
reference, fidelity-harness, documentation, and plan paths, and will not
touch those concurrent files.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/capacitor-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `packages/symbols/assets/razavi-v1/capacitor.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `scripts/razavi-fidelity-diff.mjs`
- `docs/specs/razavi-textbook-style.md`
- this plan and `plan/log.md`

## Read-only Dependencies

- `fixtures/visual-reference/razavi-reference-v1/capacitor-reference.png`
- `packages/derived/src/style-profile.ts`

## Expected Work

1. Register C1 and C2 as separate fidelity targets that share the capacitor
   asset but use each target's own raster and rotation.
2. Measure both baseline scores and change only capacitor plate span, gap,
   lead joins, and role/cap/join properties supported by both samples.
3. Regenerate the catalog and record before/after evidence. Do not touch
   editor, model, or text-system work.

## Validation

Build Symbols/Derived/Render-SVG, run focused catalog/profile tests, run both
capacitor targets, catalog stale check, `git diff --check`, and final status.

## Commit Intent

`test(razavi): add capacitor reference calibration`

## Result

Registered C1 vertical and C2 horizontal as independent targets that share the
runtime capacitor symbol, each reading the archived supplemental PNG. The
first measurement exposed origin registration error; adjusting only the
evidence anchors improved C1 from `0.3037/0.2116` to `0.5860/0.6240` and C2
from `0.4732/0.3510` to `0.6982/0.6085` (binary/soft IoU).

A candidate shorter, normal-stroke plate asset was tested against both
orientations. It reduced C1 soft-IoU to `0.6010` and C2 binary/soft-IoU to
`0.6603/0.5744`, so it was reverted. The current capacitor asset is retained;
the durable calibration result is dual-orientation reference registration and
comparison, not an unsupported geometry edit.

Validation: Symbols, Derived, and Render-SVG builds; catalog generator and
stale check; focused catalog/profile tests 17/17; both capacitor raster
targets; `git diff --check`.
