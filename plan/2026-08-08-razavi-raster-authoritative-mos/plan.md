# Razavi Raster-Authoritative MOS Assets

## Goal

Make the user-supplied six-panel Razavi screenshot the immutable visual source
for MOS symbols; remove Visio geometry, marker, and transform dependencies
from the MOS asset-generation path while preserving the established D/G/S/B
pin contract.

## Dirty-State Note

The worktree contains unrelated RLC outputs, CDAC/drafting plans, and probe
work. The primary target paths (`docs/overall-product-plan.md`, package scripts,
symbol catalog, MOS assets, and new raster reference fixture) are clean.
`plan/log.md` is concurrently dirty and read-only for this target; the target
plan carries its factual outcome rather than overwriting that shared log.

## Owned Files

- `docs/overall-product-plan.md`
- `package.json`
- `scripts/generate-razavi-mos-assets.mjs`
- `scripts/generate-razavi-symbol-catalog.mjs`
- `packages/symbols/assets/razavi-v1/{catalog,nmos,nmos3,pmos,pmos3}.symbol.json`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `fixtures/visual-reference/razavi-reference-v1/razavi-six-panel.png`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `plan/2026-08-08-razavi-raster-authoritative-mos/plan.md`

## Read-Only Files

- `lib/circuit.vss`
- `scripts/generate-visio-mos-assets.mjs`
- `fixtures/symbols/vss-ir/`
- `plan/log.md`

## Shared Dependencies

- Symbol DSL schema and current four-terminal/three-terminal presentation
  contract.
- Existing mapping manifests retain only pin semantics; they are not visual
  style sources.

## Expected Work

1. Archive the supplied 1204x794 image with a SHA-256 manifest as the only
   Razavi visual reference.
2. Introduce a direct final-coordinate MOS generator that never reads VSS,
   Visio references, markers, or body-scale transforms.
3. Declare raster-reference provenance for MOS catalog entries and validate it
   separately from VSS pin-semantic provenance.
4. Record the visual-authority and rendering rules in the main product plan.

## Validation

- `corepack pnpm symbols:razavi-mos:check`
- `corepack pnpm symbols:razavi:check`
- focused Razavi catalog tests
- `git diff --check`
- `git status --short --branch`

## Result

The sole 1204x794 reference image is archived with SHA-256
`08c89f54345c835324528a63c7519dc3aeda17169febc20134e33056bc85790b`.
`generate-razavi-mos-assets.mjs` verifies that immutable raster and emits all
four MOS assets from direct final coordinates. It does not import VSS data,
Visio SVG, arrow markers, or affine scale helpers. The catalog now labels MOS
assets `razavi-raster-reference`; retained VSS provenance is limited to the
existing pin-semantics review contract. The main product plan now freezes this
visual-authority rule and the fixed rendering/diff acceptance rule. The shared
log became clean before close-out, so the factual outcome is recorded there.

## Commit Intent

```text
feat(razavi): make screenshot the MOS visual authority
```
