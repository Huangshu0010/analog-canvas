---
status: completed
experience: none
---

# Use PMOS-Style PNP Arrow Support

## Goal

Change only the PNP emitter support topology: preserve the native triangle's
shape, orientation, and proportions, rigidly translate its true tip to the base
bar, emit no centerline toward or under that tip, and start the support at the
translated rear base-edge midpoint before continuing to the emitter pin.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the PNP derivation and its generated
evidence/catalog outputs:

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/pnp-*`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `packages/symbols/assets/razavi-v1/{pnp,catalog}.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/2026-08-11-use-pmos-style-pnp-arrow/plan.md`
- `plan/log.md`

Read-only comparison: `packages/symbols/assets/razavi-v1/pmos.symbol.json` and
its MOS generator/geometry contract. NPN remains unchanged.

## Work

1. Preserve all three source PNP arrow points relative to each other and apply
   translation only, placing the true left-pointing tip at the base-bar joint.
2. Emit only the rear support polyline from the arrow base center through the
   emitter elbow to its pin, matching PMOS support ordering.
3. Regenerate evidence and runtime assets, then validate at enlarged GUI scale.

## Validation

- PNP topology regression asserting no tip-side support line
- `node scripts/razavi-fidelity-diff.mjs pnp`
- common/catalog generator stale checks
- focused symbols and authority tests
- symbols build and Python compile check
- GUI-equivalent 8x raster inspection
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): use PMOS-style PNP arrow support
```

## Outcome

Corrected the rejected branch-aligned implementation before push. The PNP
triangle now preserves every source vertex relationship and receives one rigid
translation that places its true tip on the base bar. The tip-side centerline
is absent and the emitter support starts at the opposite edge midpoint. The
runtime catalog was regenerated, the NPN asset was unchanged, and the enlarged
GUI-equivalent raster confirms that the original arrow style is preserved.
