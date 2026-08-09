# PMOS Gate-Bar Width

## Goal

Make the PMOS outer gate bar use the same raster-derived width as the NMOS
outer gate bar, while preserving the PMOS gate-lead attachment coordinate and
all electrical pin anchors.

## Dirty-State Decision

The target starts on `codex/optimize-iteration` with a clean worktree. The
unrelated abandoned CI repair is safely preserved in a stash and is outside
this target.

## Owned Paths

- `scripts/generate-razavi-mos-assets.mjs`
- generated MOS assets and catalog artifacts directly produced from it
- directly related symbol tests, if required
- `plan/2026-08-09-pmos-gate-bar-width/**`
- `plan/log.md`

## Read-Only Paths

- `lib/circuit.vss`
- all unrelated symbols, UI code, and prior CI repair stash

## Shared Dependencies

- raster-to-logical MOS generator
- MOS pin/lead attachment contract
- generated Razavi catalog integrity hashes

## Expected Work

1. Preserve the immutable raster measurement and change only the MOS generator:
   make the PMOS outer gate-bar output match NMOS width while retaining the
   PMOS right edge where the gate lead attaches.
2. Regenerate the four-/three-terminal MOS assets and the catalog artifact.
3. Add or update a focused regression assertion for equal logical gate-bar
   widths, then run relevant symbol checks.

## Validation

- `pnpm symbols:razavi-mos`
- `pnpm symbols:razavi:check`
- focused Razavi catalog tests
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(symbols): align PMOS gate-bar width with NMOS
```

## Result (2026-08-09)

- Kept `mos-geometry.json` unchanged as the raster measurement record.
- The MOS generator now gives PMOS's outer gate bar the NMOS outer-bar width
  while holding the PMOS right edge fixed at its existing gate-lead attachment.
- Regenerated `pmos` and `pmos3`, plus the catalog hash/runtime artifact.
- Added a focused catalog regression asserting the generated outer-bar widths
  agree to the generator's six-decimal logical-coordinate precision.

## Validation Result

- Passed: `pnpm exec vitest run packages/symbols/src/razavi-catalog.test.ts`
  (17 tests), `pnpm symbols:razavi-mos --check`,
  `pnpm symbols:razavi:check`, focused Prettier, and `git diff --check`.
- `pnpm format:check` remains red on seven pre-existing `main` files outside
  this target; their state is intentionally untouched to avoid mixing the
  abandoned CI-repair scope into this symbol-only iteration.
