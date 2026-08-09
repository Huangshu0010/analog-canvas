# Canonical MOS Body Geometry

## Goal

Use NMOS as the single canonical source for MOS body geometry so PMOS has the
same gate-bar widths, bar spacing, channel placement, and gate lead. Preserve
PMOS-only arrow polarity and direction.

## Dirty-State Decision

The target starts clean on `codex/optimize-iteration`. The preceding PMOS
outer-bar-width repair is committed on this branch; its generated artifacts
are an intentional dependency of this follow-up target.

## Owned Paths

- `scripts/generate-razavi-mos-assets.mjs`
- generated PMOS MOS assets and catalog artifacts
- directly related Razavi catalog tests
- `plan/2026-08-09-canonical-mos-body-geometry/**`
- `plan/log.md`

## Read-Only Paths

- `lib/circuit.vss`
- source raster measurement JSON; it remains evidence rather than a mutable
  style-normalization input
- unrelated editor, SPICE, and CI work

## Shared Dependencies

- MOS generator and its source/arrow primitive partition
- fixed D/G/S/B pin anchors
- generated symbol catalog integrity hashes

## Expected Work

1. Refactor the generator so both polarities share NMOS body measurement while
   PMOS continues to use its polarity-specific arrow primitives.
2. Regenerate PMOS four-/three-terminal assets and catalog data.
3. Assert all non-arrow PMOS MOS primitives match NMOS, protecting the shared
   geometry contract.

## Validation

- `pnpm symbols:razavi-mos`
- `pnpm symbols:razavi:check`
- focused Razavi catalog tests
- target-file Prettier
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(symbols): canonicalize PMOS body geometry
```

## Result (2026-08-09)

- The generator now passes NMOS measurement to the shared body-primitive
  builder for both polarities. PMOS pin anchors and its source/bulk arrow
  primitives still use the PMOS measurement, preserving arrow polarity.
- Regenerated PMOS and PMOS3 assets now match NMOS in both gate bars, their
  separation, both channel levels, and the gate lead.
- A catalog regression compares the complete non-arrow MOS body geometry,
  ignoring only arrow-specific primitive labels and PMOS's bulk arrow.

## Validation Result

- Passed: `pnpm exec vitest run packages/symbols/src/razavi-catalog.test.ts`
  (17 tests), `pnpm symbols:razavi-mos --check`,
  `pnpm symbols:razavi:check`, target-file Prettier, and `git diff --check`.
