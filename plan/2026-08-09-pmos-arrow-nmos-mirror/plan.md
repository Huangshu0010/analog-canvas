# PMOS Arrow NMOS Mirror

## Goal

Make the PMOS three-terminal source arrow a horizontal mirror of the accepted
NMOS arrow geometry, retaining only its PMOS placement and left-facing
direction.

## Dirty-State Decision

The worktree contains unrelated untracked RLC artifacts, older plans, and
`probe-conflicts.mjs`. They do not overlap this MOS-geometry target and remain
untouched.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/mos-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- generated PMOS assets and catalog metadata
- `packages/symbols/src/razavi-catalog.generated.ts`
- this plan and `plan/log.md`

## Expected Work

1. Reuse the NMOS 16 px arrow length and 14 px base width for PMOS.
2. Start PMOS support at its arrow tip and end it at the channel-side lead,
   so it never extends past the tip.
3. Regenerate, build Symbols, and report the PMOS diff score.

## Validation

- MOS and catalog generation checks
- Symbols build
- one PMOS fidelity-diff run
- `git diff --check`

## Commit Intent

`fix(razavi): mirror PMOS arrow from NMOS`

## Result

Completed. PMOS now uses the horizontal mirror of NMOS's 16 px source-arrow
length and 14 px base width. Its support starts exactly at the left-facing tip
and ends at the channel-side lead, avoiding any segment beyond the tip.

The resulting PMOS binary/soft IoU is `0.6493`/`0.6052`, lower than the prior
reference-shaped PMOS. The user explicitly selected the NMOS-mirrored visual
construction as authoritative, so the score is recorded as a harness
limitation rather than used to restore the visually rejected shape.
