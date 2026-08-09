# Razavi fidelity measurement hardening — superseded

## Status

Superseded before implementation. The user clarified that component fidelity
is reference material for the text work, not an active target. No source or
reference asset was changed by this plan.

## Original goal

Make the Razavi raster comparison a stable, reference-owned regression signal
before using it to tune the remaining peripheral symbols.  In particular, a
candidate symbol must not be able to change the reference crop that is used to
score it.

## Dirty-state decision

`git status --short --branch` reports a clean tracked worktree on
`feat/razavi-fidelity-diff-harness`.  The following untracked paths predate
this target and are not owned here: generated bandpass artifacts under
`netlists/rlc-rf-bandpass-100mhz/`, three existing plan directories, and
`probe-conflicts.mjs`.  They do not overlap this target, so this work proceeds
without staging, modifying, or deleting them.

## Ownership

Owned paths:

- `plan/2026-08-09-razavi-fidelity-measurement-hardening/`
- `scripts/lib/razavi-fidelity.mjs`
- `scripts/lib/razavi-fidelity.test.mjs`
- `scripts/razavi-fidelity-diff.mjs`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `fixtures/visual-reference/razavi-reference-v1/fidelity-windows.json`
- focused tests or reports required to verify the measurement contract
- `plan/log.md`

Read-only dependencies:

- `fixtures/visual-reference/razavi-reference-v1/razavi-six-panel.png`
- `mos-geometry.json`, `peripheral-geometry.json`, and the generated Razavi
  symbol catalog
- symbol rasterizer and render-svg style profile

No symbol geometry or typography source is changed until the fixed-window
baseline and its diagnostic evidence agree on a concrete mismatch.

## Expected work

1. Move device evaluation windows and origins into a reference-owned,
   manifest-validated measurement contract.
2. Keep the existing candidate-derived crop only as an explicit diagnostic,
   never as the baseline score.
3. Report fixed-anchor score, optional registration diagnostic, and the
   reference window used, so geometry changes cannot hide behind recropping.
4. Run a focused voltage-source comparison and perform at most one visual
   inspection of its diff for a geometry decision.

## Validation

- Run the focused fidelity command for `voltage-source`.
- Run any focused test added for fixed-window behavior.
- Run `git diff --check` and inspect `git status --short --branch`.

## Commit intent

One focused commit for the measurement-contract hardening and factual plan log.
Symbol geometry remains a separate target if the fixed measurement proves a
real mismatch.

## Paused before implementation

While this audit was running, another uncommitted target changed the same
fidelity integration path: `scripts/razavi-fidelity-diff.mjs`,
`scripts/lib/razavi-fidelity.mjs`, `scripts/lib/symbol-rasterize.mjs`, and the
reference manifest.  Its additions include resistor cropping and rotated
symbol rasterization.  The new fixed-window contract must be integrated with
that work rather than overwritten beside it.

No candidate symbol geometry, manifest, CLI, or runtime source is left changed
by this target.  The next owner should first establish ownership or commit the
overlapping target, then implement the fixed reference windows as a separate
reference-owned fixture and wire it into the final CLI shape.
