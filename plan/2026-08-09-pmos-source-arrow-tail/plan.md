# PMOS Source-Arrow Tail

## Goal

Remove the PMOS three-terminal source-arrow support segment that runs past the
filled arrow tip, leaving a clean tail-to-channel support line matching the
NMOS arrow semantic convention.

## Dirty-State Decision

The worktree contains unrelated untracked RLC artifacts, older plans, and
`probe-conflicts.mjs`. They do not overlap this narrowly scoped MOS geometry
target and remain untouched.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/mos-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- generated PMOS assets and catalog metadata
- `packages/symbols/src/razavi-catalog.generated.ts`
- this plan and `plan/log.md`

## Expected Work

1. Move only the PMOS source-arrow support start to its existing arrow-base
   coordinate.
2. Regenerate the MOS catalog and build the Symbols package.

## Validation

Per the requested rapid iteration, generation checks, Symbols build, and
`git diff --check` only; no visual inspection.

## Commit Intent

`fix(razavi): trim PMOS source arrow support`

## Result

Completed. The PMOS three-terminal source-arrow support now starts at the
existing arrow-base coordinate (`x=534`) instead of extending left past the
tip (`x=520.5`). The filled triangle, channel-side endpoint, and all
electrical pins remain unchanged. Generation checks, Symbols build, and
`git diff --check` passed; no visual inspection was performed.
