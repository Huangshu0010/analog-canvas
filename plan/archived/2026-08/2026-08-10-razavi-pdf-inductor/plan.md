---
status: completed
experience: none
---

# Add a Razavi PDF-derived inductor

## Goal

Add only the Razavi inductor, extracting its vector geometry from Figure 15.21
of the textbook while keeping PDF extraction, Symbol generation, and the
existing raster fidelity comparison as separate tools. Extend the reference
manifest compatibly so the vector evidence and its raster witness are
hash-pinned without changing existing raster authority entries.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns only the inductor asset, its evidence,
the compatible manifest/contract extension, registration, focused tests, and
the target records:

- `tools/pdf-vector-extract/`
- `scripts/generate-razavi-inductor-asset.mjs`
- `scripts/lib/razavi-reference-authority.mjs`
- `scripts/lib/razavi-reference-authority.test.mjs`
- `packages/symbols/assets/razavi-v1/inductor.symbol.json`
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/symbols/src/builtins.test.ts`
- `packages/spice/src/importer.ts`
- `packages/spice/src/compiler.test.ts`
- `apps/editor/src/features/component-insert/symbol-catalog.ts`
- `apps/editor/src/features/component-insert/symbol-catalog.test.ts`
- `fixtures/visual-reference/razavi-reference-v1/inductor-*`
- `fixtures/visual-reference/razavi-reference-v1/fidelity-targets.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `docs/adr/0012-pdf-vector-evidence-for-razavi-assets.md`
- `docs/adr/0011-retire-visio-vss-as-visual-authority.md`
- `docs/specs/razavi-visual-contract.md`
- `README.md`
- `package.json`
- `vitest.config.ts`
- `plan/2026-08-10-razavi-pdf-inductor/plan.md`
- `plan/log.md`

Read-only inputs and shared dependencies:

- `C:/Users/90590/Desktop/[Razavi] Design of Analog CMOS Integrated Circuits 2nd Edition.pdf`
- Existing Razavi raster references and non-inductor symbols remain unchanged.
- The Symbol DSL, catalog contract, and SPICE mapping are shared contracts;
  changes are limited to registering the new passive symbol and optional
  manifest evidence fields.

## Work

1. Add a standalone PDF-vector extractor that records the exact source path,
   source identity, page/figure provenance, and a reproducible raster witness.
2. Extend manifest loading with an optional, hash-pinned `vectorEvidence`
   collection while retaining schema-version-1 compatibility.
3. Generate a continuous two-pin inductor Symbol from the committed vector
   evidence, register it in the catalog/editor/SPICE mapping, and add a raster
   fidelity target.
4. Document the evidence hierarchy and compatibility decision.

## Validation

- Run the extractor against the named textbook and verify committed evidence.
- Run the inductor generator in write and `--check` modes.
- Run focused manifest, symbol catalog, editor catalog, and SPICE import tests.
- Run `node scripts/razavi-fidelity-diff.mjs inductor`.
- Build the symbols package and run repository type checking where affected.
- `git diff --check`
- `git status --short --branch`

The focused checks cover the new evidence contract and every registration
surface; a full suite is unnecessary because no existing symbol geometry or
runtime editing behavior changes.

## Commit Intent

Commit as:

```text
feat(symbols): add PDF-derived Razavi inductor
```

## Outcome

Added one Razavi inductor from the native Bézier path in textbook Figure 15.21.
PDF extraction is isolated under `tools/pdf-vector-extract`, the Symbol family
generator consumes only manifest-pinned vector evidence, and the existing
raster diff consumes only the pinned PNG witness. The schema-version-1
manifest now accepts an optional hash-checked `vectorEvidence` collection;
legacy manifests remain compatible. The reviewed inductor is registered in the
catalog, editor palette, and SPICE `L` importer with two on-grid pins.

Validation passed for the extractor fingerprint/source hash, Python syntax,
authority compatibility and tamper tests, generator stale checks, affected
package builds, repository typecheck, 34 focused tests, and changed-file
formatting. The inductor fidelity run reported IoU `0.7849`, zero registration
lift, and a 90% edge-shell ratio (`anti-alias` verdict); the spatial diff showed
only thin contour disagreement. `git diff --check` passed. The broad formatter
continues to report the pre-existing untouched
`packages/derived/src/connectivity.ts`; no unrelated formatting change was
made.
