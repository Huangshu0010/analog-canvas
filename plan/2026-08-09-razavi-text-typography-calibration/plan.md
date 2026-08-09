# Razavi text typography calibration

## Goal

Calibrate the default `razavi-textbook-v1` typography against the user-provided
Razavi OTA reference: the bold-italic math base, upright suffix/polarity text,
base font size, subscript scale, and subscript baseline placement. This is a
text-only target; it must not alter any symbol geometry or routing behavior.

## Dirty-state decision

The tracked `fixtures/visual-reference/razavi-reference-v1/manifest.json` and
the untracked current-port reference files belong to a separate peripheral
reference target. Generated RLC output and earlier plans are also unrelated.
This target does not overlap those paths and will neither edit nor stage them.
`packages/derived/src/style-profile.ts` is also currently dirty for that
separate target, but its port-radius hunk is disjoint from the typography
tokens below. This target may add a separate typography hunk while preserving
and leaving the port-radius hunk unstaged.
The supplied reference image remains a user-owned temporary input at
`C:/Users/90590/AppData/Local/Temp/codex-clipboard-77dde1a9-0faa-4d32-96d0-69cd063fcefa.png`;
the calibration CLI accepts it by path and writes diagnostics outside the
repository, rather than silently adding a binary asset to the visual-authority
manifest.

## Ownership

Owned paths:

- `plan/2026-08-09-razavi-text-typography-calibration/`
- `scripts/razavi-text-fidelity-diff.mjs` and focused script tests/helpers if
  needed
- `packages/derived/src/style-profile.ts` and its focused tests
- `packages/render-svg/src/rich-text.ts`, `schematic-text.ts`, and focused
  tests where typography rendering needs correction
- `docs/specs/razavi-textbook-style.md` and `visual-language.md` for accepted
  calibrated token values
- `plan/log.md`

Read-only dependencies:

- user-provided raster reference, symbol catalog, peripheral geometry, and
  every other visual-reference input
- editor, model schema, export API, and existing Project fixtures

## Method and decisions

1. Build a text-only SVG raster comparator using the established `png-io` and
   Chrome rasterizer; it compares hand-measured crops for `V_DD`, `R_D`,
   `V_out`, `M_1`, and `M_2` against a candidate profile. `V_out` is a
   diagnostic-only crop because the source raster overlaps it with a node and
   polarity marker.
2. Search only bounded typography candidates: installed/system font families,
   math weight/style, base size, subscript scale, and baseline shift. Treat
   absolute IoU as a relative signal because the book raster and resvg have
   different anti-aliasing.
3. Make one justified profile adjustment only when several independent labels
   improve. Preserve the rule that base variables are bold italic and signs
   remain upright; do not force all subscripts upright unless the reference
   consistently establishes that result.
4. Record the result as the default Razavi profile. Do not claim a durable
   pixel gate until the user elects to archive this raster into the approved
   visual-reference manifest.

## Validation

- Run the text comparator against the supplied image and retain its console
  metrics in this plan/log.
- Focused Derived and Render-SVG tests; workspace typecheck and relevant
  package builds.
- `git diff --check` and targeted Prettier check. Existing whole-render golden
  failures from committed component calibration are recorded separately and
  are not modified here.

## Commit intent

One focused commit: `fix(razavi): calibrate default schematic typography`.

## Implementation result

- Added a text-only calibration CLI that renders candidates through the same
  Chrome family of rasterizer as the editor. It accepts an explicit font so a
  fallback font cannot select a product token accidentally.
- Its clean-crop Arial search retained bold-italic mathematical bases and
  subscripts. It selected `18` scene units, `0.76` subscript scale, and
  `0.34em` downward baseline shift over the prior `16` / `0.68` / `0.30em`
  default.
- `V_out` remains in the report but does not select tokens: its screenshot
  crop contains both the output node and a polarity marker.
- Updated the profile, renderer regression tests, and derived rich-text bounds
  to use the calibrated baseline token rather than a duplicated `0.30` value.

## Validation result

- Chrome/Arial comparator: clean-crop mean binary IoU improved `0.3654` to
  `0.5822`. Per-label final scores were `V_DD 0.5362`, `R_D 0.6866`,
  `M_1 0.6256`, and `M_2 0.4806`; `V_out 0.3197` is diagnostic-only.
- Focused Derived/Render-SVG tests: `23/23` passed.
- Derived and Render-SVG package builds, workspace typecheck, and editor
  production build passed.
- Owned-file Prettier check and `git diff --check` passed. The existing
  peripheral Port worktree hunks were preserved and are not part of this
  target.
