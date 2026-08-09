# Razavi resistor proportion audit

## Goal

Compare the resistor's rendered geometry with the sole Razavi raster authority
at point, segment, angle, and envelope level. Correct only measured resistor
proportion errors, if any.

## Dirty-State Decision

The branch is `codex/optimize-iteration`, ahead by two commits. `App.tsx` and
the untracked wire-path and terminal-escape-routing plan files belong to
concurrent editor work and do not overlap this asset or its fidelity tooling.
They are read-only and will remain unstaged.
During the audit, the concurrent terminal-escape work also modified
`packages/render-svg/src/render.ts` and `render.test.ts`. This target's
separate miter-override reversion will be staged by exact hunk only; the
terminal-overlap implementation and its tests remain unstaged.

## Owned Files

- `packages/symbols/assets/razavi-v1/resistor.symbol.json`, only if a measured
  mismatch is found
- matching resistor catalog/generated/test hunks, only if the asset changes
- this plan and `plan/log.md`

## Read-Only Dependencies

- `fixtures/visual-reference/razavi-reference-v1/passive-geometry.json`
- sole Razavi source raster and fidelity scripts
- all editor work, MOS/peripheral assets, netlists, and `lib/circuit.vss`

## Work

Reverse the reference rotation and scale to local symbol coordinates; compare
every body point, segment length, turn angle, body envelope, and lead lengths
against the registered asset. Rasterize at the reference scale to determine
whether any remaining difference is geometric or raster/stroke related.

The point audit proves the centerline is exact. A miter-limit sweep instead
finds that the previous per-resistor value of 12 enlarges the outer footprint:
it produces 471 ink pixels and 0.6033 IoU, versus 421 and 0.6613 at the
profile default of four. Remove the unsupported override and its dormant DSL
plumbing; do not alter the measured vertices, segments, angles, or pins.

## Result

- All eight reference-local vertices agree with the asset within
  `5.01e-7` logical units.
- The seven body segment lengths, six turn angles, and `15.6977 × 17.4419`
  logical-unit envelope agree exactly after inverse rotation/scale.
- The profile's miter limit of four is the evidence-backed value; the raster
  residual is a 100% contour shell, not a ratio or registration mismatch.

## Validation

- deterministic point/segment/angle audit
- focused resistor fidelity comparison
- if changed: catalog generation, focused catalog/render test, Symbols build,
  `git diff --check`

## Commit Intent

Only if measured geometry changes: `fix(razavi): calibrate resistor proportions`.
