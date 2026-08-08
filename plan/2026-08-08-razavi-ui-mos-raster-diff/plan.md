# Razavi UI MOS Raster Diff

## Goal

Capture the actual editor-rendered Razavi MOS at a fixed browser scale, compare
it against the accepted raster reference, and correct an identified visual
arrow mismatch rather than relying only on generator coordinates.

## Dirty-State Note

The worktree has unrelated concurrent editing, drafting, model, render, and
agent-API changes. This target will not edit those shared paths. The previous
canonical-arrow generator commit is clean. Browser capture is read-only unless
the diff identifies a symbol-asset or style-profile correction.

## Owned Files

- `scripts/measure-razavi-reference.py` (only if a deterministic comparison
  helper is needed)
- `scripts/generate-visio-mos-assets.mjs` (only if the raster diff identifies
  a source-arrow geometry correction)
- `packages/symbols/assets/razavi-v1/*.symbol.json` (generated only)
- `fixtures/visual-golden/visio-mos-fidelity.svg` (generated only)
- `packages/symbols/src/razavi-catalog.test.ts` (only for a regression)
- `plan/log.md`

## Read-Only Files

- `apps/editor/src/App.tsx` and `apps/editor/src/visual-demo.ts` (concurrent)
- `fixtures/visual-reference/visio-mos/`
- supplied Razavi PNG under the Codex temp directory
- `lib/circuit.vss`

## Shared Dependencies

- Browser SVG rendering, DPR, and active editor style profile.
- Symbol DSL’s variant presentation contract.

## Expected Work

1. Use the fixed UI view to capture the actual rendered three-terminal NMOS
   and PMOS, with actual scale and computed SVG geometry recorded.
2. Crop the accepted raster to the same semantic arrows, overlay/diff it with
   the UI result, and distinguish rendering differences from symbol geometry.
3. Apply the smallest asset/style correction that reduces an evidenced mismatch
   and add a deterministic check when a source change is required.

## Validation

- fixed browser screenshot inspection
- `corepack pnpm symbols:visio-mos:check` if generator changes
- focused Razavi catalog tests if symbols change
- `git diff --check`
- `git status --short --branch`

## Result

The browser SVG used the current three-terminal NMOS asset and rendered its
source triangle at the expected 8.28 by 7.5735 logical dimensions, with a
0.69 logical overlap under the head. The accepted reference PNG has no
matching canvas viewport, DPR, or isolated symbol crop, while the inspected
empty-document UI is fitted to the whole 960 by 640 canvas. Its 30-pixel MOS
therefore cannot produce a meaningful absolute-pixel diff against the roughly
70-pixel reference MOS. No asset or style correction is evidenced by this
comparison; a source edit would be guesswork. The temporary UI placement was
undone before closing the inspection.

The next valid diff target is a checked-in reference crop plus a fixed 100%
editor viewport/DPR screenshot fixture. It can compare the same rendered
pixel footprint rather than different presentation scales.

## Commit Intent

Record the completed diagnostic target as:

```text
docs(plan): record Razavi UI raster-diff baseline
```
