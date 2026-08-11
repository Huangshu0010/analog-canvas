---
status: completed
experience: none
---

# Close BJT Arrow Seams

## Goal

Make the PNP emitter arrow visually continuous with its base-side branch and
make both sides of the NPN emitter arrow continuous at GUI zoom, without
allowing either centerline to protrude beyond the arrow silhouette.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the BJT arrow-clipping seam and its
generated evidence/catalog outputs:

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{npn,pnp}-*`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `packages/symbols/assets/razavi-v1/{npn,pnp}.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/2026-08-11-close-bjt-arrow-seams/plan.md`
- `plan/log.md`

Shared dependency: the Razavi 1.6-unit normal stroke and the existing native
arrow polygons remain unchanged.

## Work

1. Add a bounded centerline overlap inside the arrow polygon on both sides of
   each clipped emitter branch.
2. Regenerate NPN/PNP evidence and registered assets, then protect the overlap
   geometry with focused assertions.
3. Validate source witnesses and GUI-equivalent rendered rasters.

## Validation

- `node scripts/razavi-fidelity-diff.mjs npn pnp`
- common/catalog generator stale checks
- focused symbols and authority tests
- symbols build and Python compile check
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): close BJT arrow seams
```

## Outcome

Both clipped emitter centerlines now overlap the native arrow fill by 1.2
logical units (0.75 normal stroke widths) on each side. This converts fragile
boundary-only contact into real filled-area continuity while keeping the
overlap bounded inside the polygon, so no line can cross or flatten the arrow
tip. NPN and PNP evidence, witnesses, Symbol assets, catalogs, and runtime
registration were regenerated. GUI-equivalent 8x rasters were visually checked
for continuous joins. Focused generators and 23 tests passed; fidelity IoU
improved to 0.9861 for NPN and 0.9909 for PNP with anti-alias-only residuals.
