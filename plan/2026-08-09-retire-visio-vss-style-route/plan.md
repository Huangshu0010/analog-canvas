# Retire the Visio/VSS Style Route

## Goal

Archive the Visio/VSS route as historical evidence only, remove it from active
developer entry points, and make the raster reference the only authoritative
visual source in durable documentation.

## Dirty-State Note

The active `feat/razavi-fidelity-diff-harness` branch has concurrent dirty
changes to the Razavi style specification, raster manifests, and fidelity
scripts. Those paths are read-only for this target. Generated RLC files and
other plan directories are unrelated. `plan/log.md` is concurrently dirty, so
this target will not edit it; the committed ADR and plan record the decision.

## Owned Files

- `README.md`
- `docs/README.md`
- `docs/overall-product-plan.md`
- `docs/adr/README.md`
- `docs/adr/0011-retire-visio-vss-as-visual-authority.md`
- `package.json`
- `plan/2026-08-09-retire-visio-vss-style-route/plan.md`

## Read-Only Files

- `lib/circuit.vss`
- `tools/vss-import/**`
- `scripts/generate-visio-*.mjs`
- `fixtures/symbols/vss-ir/**`
- `packages/symbols/assets/razavi-v1/**`
- dirty Razavi raster-fidelity files and `plan/log.md`

## Shared Dependencies

- Existing catalog provenance remains readable until each legacy symbol is
  re-authored from the raster reference. This target must not break that
  historical validation path.
- `symbols:razavi` remains the supported catalog generation/check entry point.

## Expected Work

1. Accept an ADR that makes the supplied raster reference the sole visual
   authority and confines VSS to a non-product archive.
2. Update root documentation navigation and repository layout descriptions so
   future contributors cannot mistake `circuit.vss` for an active source.
3. Remove VSS/Visio commands from root package scripts, retaining no supported
   shortcut that can reintroduce generated visual geometry.

## Validation

- `node -e "JSON.parse(require('node:fs').readFileSync('package.json','utf8'))"`
- `corepack pnpm symbols:razavi:check`
- `git diff --check`
- `git status --short --branch`

The package parse proves scripts remain valid; the catalog check proves the
active raster/catalog entry point is still operable without invoking a VSS
generator.

## Result

ADR 0011 accepts the raster reference as sole visual authority and demotes the
VSS files to an immutable archive. Root package commands can no longer invoke
VSS/Visio generation, export, review, or check flows. Existing VSS provenance
continues to be readable only as a temporary catalog-migration record; it is
not visual authority and does not authorize regeneration.

## Commit Intent

```text
docs(architecture): retire Visio/VSS visual route
```
