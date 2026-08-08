# Razavi MOS Arrow Family Unification

## Goal

Give PMOS and NMOS source-arrow heads one calibrated Razavi proportion family:
opposite direction by transistor type, but identical visible length, width,
fill, line treatment, and seam behavior. Retain the canonical four-terminal
definitions and apply the same head metrics there.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 1]
M apps/editor/src/App.tsx
M apps/editor/src/styles.css
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? probe-conflicts.mjs
```

Those files are unrelated user/other-worker work and will not be modified.

## Owned Files

- `scripts/generate-visio-mos-assets.mjs`
- generated MOS assets/catalog/fidelity board
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/2026-08-08-razavi-mos-arrow-family-unification/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- supplied Razavi reference image
- editor styling/runtime work owned by others

## Shared Dependencies

- canonical MOS pin and four-terminal semantics
- VSS-derived `textbook-3terminal` variants
- generated Razavi catalog

## Expected Work

1. Promote the NMOS-calibrated source-arrow dimensions to the shared Razavi
   MOS arrow family metrics.
2. Regenerate both PMOS three- and four-terminal primitives without moving
   electrical anchors.
3. Assert equal NMOS/PMOS arrow dimensions with intentionally opposite tip
   direction.

## Validation

- focused Razavi catalog tests
- MOS and Razavi generated-asset checks
- `git diff --check` and `git status --short --branch`

## Commit Intent

```text
fix(razavi): unify PMOS and NMOS arrow proportions
```

## Result

Completed. The native PMOS VSS marker is exactly 22/25 of the NMOS marker
after the symbol transforms. The generator applies a 25/22 compensation to
PMOS and PMOS3 arrow metrics only; both polarities now render a triangle of
visible length 8.28 and half-width 3.78675, with opposite directions and the
same seam-free support treatment. Pin anchors and four-terminal topology are
unchanged.

Validation passed:

- `corepack pnpm vitest run packages/symbols/src/razavi-catalog.test.ts` (12 tests)
- `corepack pnpm symbols:visio-mos:check`
- `corepack pnpm symbols:razavi:check`
- `corepack pnpm exec playwright test apps/editor/e2e/manual-editor.spec.ts --grep "faithful symbol previews"`
- `git diff --check`
