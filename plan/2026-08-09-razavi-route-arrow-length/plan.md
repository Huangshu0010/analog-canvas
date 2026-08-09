# Razavi Route-Arrow Length

## Goal

Lengthen the route-attached current arrow to match the user's visual judgment
that the reference arrow is longer, without changing its triangle head.

## Dirty-State Decision

The worktree contains unrelated untracked RLC artifacts, older plans, and
`probe-conflicts.mjs`; none overlap this peripheral-token target.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/peripheral-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `packages/derived/src/razavi-peripheral-geometry.generated.ts`
- `packages/render-svg/src/style-profile.test.ts`
- `docs/specs/visual-language.md`
- `docs/specs/razavi-textbook-style.md`
- this plan and `plan/log.md`

## Expected Work

Increase the measured route-arrow total length from 80 px to 92 px. Retain
the 26 px head length, 15 px head width, and label gap.

## Validation

Peripheral generation check, affected build, `git diff --check`, and status.
No visual comparison: the route-marker is not yet covered by the harness.

## Commit Intent

`fix(razavi): lengthen route current arrow`

## Result

Implemented the user-approved 92 px full arrow extent while retaining the
26 px head length, 15 px head width, and 12 px label gap. Regenerated the
profile token and updated the profile contract assertion and normative values.

No visual diff was run: route-attached current markers are not yet a target of
the raster-diff harness. The numeric change follows the user's comparison of
the sole reference rather than treating the prior 80 px map as conclusive.

Validation: peripheral generation and `--check`; focused Vitest profile test
(2/2); `@icm/render-svg` TypeScript build; `git diff --check`.
