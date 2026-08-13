---
status: completed
experience: none
---

# Razavi Current Arrow And Node Alignment

## Goal

Reuse the accepted screenshot-to-logical-coordinate pipeline to align the
route-attached current arrow and solid electrical node size with the sole
Razavi reference.

## Dirty-State Decision

The worktree contains unrelated untracked RLC outputs, other target plans,
and `probe-conflicts.mjs`. They do not overlap this target and remain
untouched.

## Ownership

- `fixtures/visual-reference/razavi-reference-v1/peripheral-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `scripts/generate-razavi-peripheral-assets.mjs`
- `packages/derived/src/razavi-peripheral-geometry.generated.ts`
- `packages/derived/src/style-profile.ts`
- `packages/render-svg/src/style-profile.test.ts`
- `docs/specs/visual-language.md`
- `docs/specs/razavi-textbook-style.md`
- this plan and `plan/log.md`

## Read-Only Dependencies

- The accepted `razavi-six-panel.png` remains the sole visual authority.
- Route attachment, electrical connectivity, annotation semantics, and
  renderer geometry formulas remain unchanged.

## Expected Work

1. Correct the current-arrow pixel map to the full visible arrow extent.
2. Add the measured solid-node radius to the same pixel map.
3. Generate both arrow and node profile tokens from that map.
4. Refresh the normative token documentation.

## Validation

Per the user's rapid-iteration instruction, do not run visual or automated
validation. Close with `git diff --check` and status inspection only, as
required by repository policy.

## Commit Intent

`fix(razavi): align current arrows and solid nodes`

## Result

Completed. The screenshot map now records the full 80 px current-arrow extent,
26 px head length, 15 px head width, and 6.5 px solid-node radius. Generated
Razavi scene tokens now drive both junction and Port dots as well as the
route-attached current arrow. No visual or automated validation was run by
user request; only repository hygiene checks were used.
