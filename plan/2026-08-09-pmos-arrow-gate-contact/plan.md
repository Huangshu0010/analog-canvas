# PMOS Arrow Gate Contact

## Goal

Make the three-terminal PMOS arrow tip contact the Gate bar and keep its
support entirely on the arrow-tail-to-channel side.

## Dirty-State Decision

The worktree contains unrelated untracked RLC artifacts, older plans, and
`probe-conflicts.mjs`; none overlap this target.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/mos-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- generated PMOS assets and catalog metadata
- `packages/symbols/src/razavi-catalog.generated.ts`
- this plan and `plan/log.md`

## Expected Work

1. Put the PMOS tip at the Gate bar right edge.
2. Keep NMOS-matched 16 px arrow length and 14 px base width.
3. Start support at the arrow base and end it at the channel-side lead.

## Validation

Generation checks, Symbols build, and `git diff --check`; no visual check.

## Commit Intent

`fix(razavi): join PMOS arrow to gate bar`

## Result

Completed. The PMOS arrow tip now equals the Gate bar right edge (`x=520.5`).
Its tail remains 16 px away at `x=536.5` with a 14 px base; the only support
segment is `x=536.5 → 545`, so no line can pass through the arrowhead.
Generation checks, Symbols build, and `git diff --check` passed without a
visual inspection.
