# Razavi RV-3 Stroke Profile

## Goal

Introduce versioned formal style profiles and semantic primitive stroke roles
so `razavi-textbook-v1` controls conductor, normal symbol, emphasis, supply,
annotation, node, cap, join, color, and scaling behavior centrally. Preserve
byte-identical `textbook-monochrome-v1` output for existing Projects.

## Dirty-State Note

Start state: `main` at pushed RV-2 commit `50134d0`; only the five untracked,
user-confirmed parallel OTA `razavi-*` files remain. They are outside this
target and do not overlap the model, Symbol DSL/catalog, renderer, tests,
goldens, or documentation owned here.

## Owned Files

- `plan/2026-08-07-razavi-rv3-stroke-profile/plan.md`
- `packages/symbols/src/schema.ts`
- `packages/symbols/assets/razavi-v1/*.symbol.json`
- generated Razavi catalog metadata/runtime adapter
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/render-svg/src/style-profile.ts`
- `packages/render-svg/src/style-profile.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `packages/render-svg/src/index.ts`
- `tools/symbol-review/render-reviewed.mjs`
- `docs/specs/symbol-dsl.md`
- `docs/specs/visual-language.md`
- `docs/specs/razavi-textbook-style.md`
- `plan/log.md`
- visual goldens only if legacy compatibility is intentionally revised (not
  expected)

## Read-Only Files

- `lib/circuit.vss`
- RV-1 VSS IR evidence
- editor interaction/runtime code
- SPICE importer
- Project fixtures except transient in-test mutation
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`

## Shared Dependencies

- persisted `presentation.styleProfileId`
- Symbol DSL backward compatibility for legacy numeric `strokeWidth`
- formal SVG/PNG/PDF scene parity
- catalog asset hashes and generated adapter
- all existing visual/export goldens

## Expected Work

1. Add semantic `strokeRole` to primitive style while retaining legacy numeric
   width as a mutually exclusive compatibility field.
2. Replace raw VSS-derived widths in the first catalog assets with `normal`
   and `emphasis` roles; regenerate hashes/adapter.
3. Add immutable legacy and Razavi profile definitions plus strict profile
   resolution.
4. Route every formal renderer width/color/cap/join/node decision through the
   selected profile; keep legacy SVG byte-identical.
5. For Razavi output, use `#202020`, profile widths/radii, and scaling formal
   strokes with no `vector-effect="non-scaling-stroke"`.
6. Add focused role/profile/unknown-profile/legacy-compatibility tests and
   document the compatibility boundary.

## Validation

- `pnpm symbols:razavi:check`
- focused Symbol DSL and renderer profile tests
- `pnpm symbols:review:check`
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `git diff --check`
- `git status --short --branch`

The renderer is a shared formal-output boundary, so legacy byte goldens and
export parity are required in addition to new-profile assertions.

## Experience Signal (for human review)


## Outcome

- Added Symbol DSL `strokeRole` with `normal`, `emphasis`, `supply`, and
  `annotation` values. A style cannot combine a role with legacy numeric
  `strokeWidth`.
- Migrated the first Razavi MOS assets from raw `1.2`/`2.16` widths to semantic
  roles and regenerated their canonical hashes/runtime adapter.
- Added strict immutable profile definitions for legacy and
  `razavi-textbook-v1`. Unknown persisted IDs now block rendering rather than
  silently substituting a style.
- Routed formal conductor, symbol, role, annotation, Junction, foreground,
  background, cap, join, miter, font-family/size, and scaling decisions through
  the selected profile. Razavi formal output uses only profile widths and no
  non-scaling stroke; remaining numeric legacy assets are clustered at the
  profile boundary until migrated.
- Updated the independent symbol-review renderer after its first check exposed
  that it did not yet understand roles. It now resolves roles with legacy
  tokens and retains byte-identical review goldens.
- Validation passed: 24 focused tests, 137 full tests in 35 files, typecheck,
  build, formatting, catalog check, 25 symbol previews, Phase 1/5 visual
  goldens, Phase 7 SVG/PNG/PDF export goldens, and `git diff --check`. No legacy
  golden changed; concurrent OTA artifacts remained untouched.

## Commit Intent

Commit as:

```text
feat(render): add Razavi semantic stroke profile
```
