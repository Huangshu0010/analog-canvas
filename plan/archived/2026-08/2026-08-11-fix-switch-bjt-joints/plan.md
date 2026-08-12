---
status: completed
experience: none
---

# Fix Switch and BJT Joint Geometry

## Goal

Prevent ideal-switch leads from protruding inside hollow contacts and rebuild
NPN/PNP branch and arrow geometry so the BJT proportions follow the textbook
while all branch-to-lead joints are continuous and no branch crosses an arrow
tip.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the shared common-device extraction and
generation boundary because all requested defects are produced there:

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{ideal-switch,npn,pnp}-*`
- `fixtures/visual-reference/razavi-reference-v1/common-symbol-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `packages/symbols/assets/razavi-v1/{ideal-switch,npn,pnp}.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/2026-08-11-fix-switch-bjt-joints/plan.md`
- `plan/log.md`

Read-only source and shared contracts:

- `C:/Users/90590/Desktop/[Razavi] Design of Analog CMOS Integrated Circuits 2nd Edition.pdf`
- `docs/adr/0012-pdf-vector-evidence-for-razavi-assets.md`
- Razavi style-profile stroke roles and Symbol DSL schema

## Work

1. Measure the NPN and PNP source objects and compare their arrow/branch ratios
   with the current normalized definitions.
2. Stop switch leads at hollow-contact outer boundaries without raster seams or
   interior protrusions.
3. Join BJT diagonal branches to vertical leads with controlled overlap, clip
   emitter branches at the arrow base, and draw the arrow last so its tip stays
   unobstructed.
4. Regenerate evidence, witnesses, Symbol assets, catalogs, and authority
   hashes; add focused geometry regressions.

## Validation

- source-object and generated-geometry assertions
- registered fidelity comparisons for `ideal-switch`, `npn`, and `pnp`
- `corepack pnpm symbols:razavi-common:check`
- `corepack pnpm symbols:razavi:check`
- focused symbols and authority tests
- symbols build and Python compile check
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): repair switch and BJT joints
```

## Outcome

The switch leads now stop exactly at each contact's outer centerline boundary,
so their butt caps do not enter the hollow interior. NPN Figure 12.6 Q1 and PNP
Figure 12.11 Q1 are normalized with one uniform 0.717 pt-to-1.6 unit scale,
restoring the native arrow/body ratio and correcting the former PNP selection
coordinates. Non-arrow branches and vertical leads are joined polylines. Each
emitter centerline is clipped at its arrow polygon, and the arrow is emitted
last, preventing any line from crossing or flattening the tip. Generated
evidence, witnesses, catalog assets, and runtime registration were refreshed.
Focused generators and 23 tests passed; fidelity IoU reached 0.9814 for the
switch, 0.9846 for NPN, and 0.9901 for PNP, with anti-alias-only residuals.
