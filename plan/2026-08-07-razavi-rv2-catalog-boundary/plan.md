# Razavi RV-2 Catalog Boundary

## Goal

Create the product-owned `razavi-symbols@1` JSON catalog boundary and make the
existing built-in library consume its first VSS-provenanced assets. Preserve
current editor/import behavior while moving asset ownership out of
`builtins.ts` and making catalog reachability, review state, source Master, and
asset hash observable and deterministic.

## Dirty-State Note

Start state: `main` at pushed RV-1 commit `f0cd9bb`. Only the five untracked
OTA `razavi-*` files from the user-confirmed parallel workflow remain. They are
outside this target and do not overlap the symbol catalog, generator, tests,
or documentation owned here.

## Owned Files

- `plan/2026-08-07-razavi-rv2-catalog-boundary/plan.md`
- `packages/symbols/assets/razavi-v1/**`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `packages/symbols/src/builtins.ts`
- `packages/symbols/src/builtins.test.ts`
- `packages/symbols/src/index.ts`
- `scripts/generate-razavi-symbol-catalog.mjs`
- `package.json`
- `docs/specs/razavi-textbook-style.md`
- `plan/log.md`
- generated symbol/visual review artifacts only if behavior intentionally
  changes (not expected in this boundary target)

## Read-Only Files

- `lib/circuit.vss`
- `fixtures/symbols/vss-ir/razavi-rv1-master-ir.json`
- `fixtures/symbols/circuit-vss-review.json`
- editor, renderer, SPICE importer, and project fixtures
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`

## Shared Dependencies

- Symbol DSL schema and 10-unit pin grid
- existing built-in symbol IDs, aliases, variants, and ordering
- review-manifest pin order and provisional status
- VSS source/decoder provenance from RV-1
- editor palette and SPICE resolver behavior

## Expected Work

1. Define catalog metadata and source-of-truth JSON assets for `nmos`,
   `pmos3`, `resistor`, and `voltage-source` without changing their current
   normalized Symbol DSL behavior.
2. Record `node` as a semantic primitive rather than inventing a component or
   electrical pin for it.
3. Add a deterministic generator/checker that verifies asset hashes, pin-grid
   invariants, unique IDs/aliases/Master mappings, reachability, and emits the
   runtime TypeScript adapter.
4. Replace the four corresponding `builtins.ts` definitions with catalog
   lookups while retaining the public `builtInSymbols` compatibility surface.
5. Add tests proving JSON/schema validity, catalog provenance/review state,
   runtime equality, and unchanged built-in ordering.
6. Document the JSON source-of-truth versus generated-runtime boundary.

## Validation

- `node scripts/generate-razavi-symbol-catalog.mjs --check`
- focused `packages/symbols` tests
- `pnpm symbols:review:check`
- `pnpm visual:phase5:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `git diff --check`
- `git status --short --branch`

The target changes the runtime source of four existing symbols but is intended
to be behavior-preserving, so symbol/visual goldens and full contracts must
remain unchanged.

## Experience Signal (for human review)


## Outcome

- Added the `razavi-symbols@1` source-of-truth directory with cataloged JSON
  assets for reviewed `NMOS4`, `R`, and `DC-V`, plus provisional `Pmos3.a`.
  Each entry carries the RV-1 stencil/decoder identity, review status, pin
  order, reachability, canonical LF-normalized asset hash, and asset path.
- Classified VSS `node` as the `junction-dot` semantic primitive owned by
  `presentation.nodes.junction`; it has no invented component or electrical
  pin definition.
- Added a deterministic catalog generator/checker and generated TypeScript
  runtime adapter. The checker rejects stale hashes/adapters, path escape,
  duplicate IDs/aliases/assets/Masters, missing RV-1 evidence, off-grid pins,
  invalid provenance, and unreachable entries.
- Replaced the four matching definitions in `builtInSymbols` with the catalog
  objects while preserving public IDs, aliases, variants, ordering, resolver
  behavior, and formal geometry.
- Validation passed: catalog check, 12 focused tests, 132 full tests in 34
  files, typecheck, build, formatting, 25 symbol previews, and Phase 1/5
  visual goldens. No generated visual artifact changed.
- The concurrent OTA `razavi-*` files remained untracked and untouched.

## Commit Intent

Commit as:

```text
feat(symbols): establish Razavi asset catalog
```
