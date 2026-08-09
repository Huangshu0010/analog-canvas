# Razavi palette Port parity

## Goal

Make the GUI palette `port` symbol use the same hollow Razavi Port treatment
as formal document ports, using the already archived current-port reference.

## Dirty-state decision

The tracked worktree contains uncommitted `packages/derived/src/style-profile.ts`
and `plan/log.md` changes owned by the parallel typography target. They do not
overlap this target's catalog asset, generated catalog, renderer test, or plan,
so they will not be modified, staged, or committed here. Existing untracked
layout exports and unrelated plans remain excluded.

## Ownership

- `packages/symbols/assets/razavi-v1/port.symbol.json`
- generated catalog artifacts produced by `generate-razavi-symbol-catalog.mjs`
- focused Port renderer/catalog tests
- `plan/2026-08-09-razavi-palette-port-parity/plan.md`

Read-only evidence: `current-port-reference.png` and
`current-port-geometry.json` from the prior committed calibration.

## Work and validation

1. Replace the palette Port's filled circle with a normal-stroke hollow circle.
2. End its lead at the circle's outer edge so the interior remains empty.
3. Regenerate the Razavi catalog, build Symbols and Render-SVG, run focused
   Port tests, and confirm the existing Vite GUI serves the updated source.

## Commit intent

Commit only the palette-Port parity paths; do not include parallel typography
worktree changes.
