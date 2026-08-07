# Razavi RV-6B Reviewed Catalog Migration

## Goal

Promote the nine RV-6A reviewed canonical Visio-derived symbols into the
Razavi catalog, make the runtime built-in registry consume those catalog
assets without changing symbol behavior, and document the remaining catalog,
connectivity, visual, and routing gaps.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
?? netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-ota-5t-live.icproj.json
?? netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-ota-5t-live.pdf
?? netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-ota-5t-live.png
?? netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-ota-5t-live.svg
```

The four untracked OTA outputs are user/earlier-target generated artifacts.
They do not overlap this target's owned paths and will remain untouched and
unstaged.

## Owned Files

- `packages/symbols/assets/razavi-v1/`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/builtins.ts`
- `packages/symbols/src/*.test.ts` when directly covering catalog/runtime integration
- `scripts/generate-razavi-symbol-catalog.mjs`
- `scripts/seed-rv6b-reviewed-assets.mjs` as a temporary migration helper only
- `docs/specs/` documents directly describing the Razavi catalog boundary
- `plan/2026-08-07-razavi-rv6b-reviewed-catalog-migration/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- `fixtures/symbols/vss-ir/razavi-rv1-master-ir.json`
- `fixtures/symbols/vss-ir/razavi-rv6-core-analog-master-ir.json`
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/`
- SPICE parser and connectivity implementation outside `packages/symbols/`
- existing visual/export goldens unless a verified intentional rendering change occurs

## Shared Dependencies

- Symbol DSL and built-in symbol IDs/pin contracts
- Razavi VSS decoder provenance and reviewed-master evidence
- generated catalog adapter consumed by the editor and import pipeline
- existing visual and export golden contracts

## Expected Work

1. Materialize semantic-role catalog assets for PMOS4, C, L, GND, I/O Port,
   DC-I, Diode1, npn, and pnp from the currently accepted runtime geometry.
2. Add reviewed catalog metadata and mappings while retaining the provisional
   status of Pmos3.a and avoiding any new automatic three-terminal MOS policy.
3. Extend generation checks to accept reviewed evidence from both RV-1 and
   RV-6A decoder fixtures.
4. Regenerate the typed adapter and switch matching built-ins to catalog assets.
5. Update focused tests and catalog documentation, then run risk-proportional
   catalog, symbol, type, build, test, visual, and export validation.
6. Record factual completion and an explicit post-migration gap inventory.

## Validation

- `pnpm symbols:razavi`
- `pnpm symbols:razavi:check`
- `pnpm symbols:review:check`
- focused `packages/symbols` tests
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

The catalog and review checks prove provenance, asset normalization, and
generated-adapter freshness. Full workspace tests/typecheck/build and the
visual/export gates are justified because the built-in registry is a shared
runtime contract consumed across editor, importer, renderer, and exporter.

## Experience Signal (for human review)

None identified at target start.

## Outcome

- Added nine normalized catalog assets for PMOS4, C, L, GND, I/O, DC-I,
  Diode1, npn, and pnp. Together with the existing reviewed NMOS4, R, and DC-V
  assets, the catalog now contains 12 reviewed canonical assets and the one
  existing provisional `pmos3` asset.
- Replaced exposed hand-maintained built-in definitions with the corresponding
  catalog object references. A focused identity test prevents those runtime
  entries from silently returning to a duplicate source.
- Extended catalog generation to validate both RV-1 and RV-6A decoder evidence,
  stencil identity, and the reviewed/provisional Master and pin order in the
  human review manifest.
- Preserved canonical NMOS/PMOS D/G/S/B electrical pins. Their
  `textbook-3terminal` variants hide B presentation only; `nmos3` was not
  promoted and `pmos3` remains provisional with no automatic mapping.
- Validation passed: catalog generation/check, 12 reviewed plus 13 candidate
  preview check, 14 focused tests, 152 full tests in 36 files, typecheck,
  build, formatting, Phase 1/5 visual goldens, Phase 7 export goldens, and
  `git diff --check`.

## Remaining Gap Inventory

- Catalog coverage: there is no authoritative 101-Master disposition manifest.
  `nmos3` is not cataloged; `pmos3` is provisional; VDD, waveform sources,
  diode variants/LED, op-amps, switches, crystal, transformer, Batch C, and
  other in-scope stencil Masters remain migration/review work.
- Mapping integration: `automaticMappings` is validated metadata but is not
  yet consumed by the SPICE importer or PDK resolver, and there is no generated
  palette/import reachability or unexplained-fallback report.
- MOS policy: Net classification, safe automatic four-terminal versus
  implicit-bulk presentation selection, and the
  `HIDDEN_BULK_NON_GLOBAL_NET` diagnostic remain absent. A body-bias Net must
  therefore fail safe through explicit four-terminal display rather than an
  automatic policy.
- Fidelity evidence: runtime previews and existing visual/export goldens pass,
  but no deterministic VSS-IR-to-Symbol-DSL geometry equivalence or per-master
  overlay gate proves exact Visio reproduction. The RV-7 fixed-scale
  six-topology acceptance board and signed visual comparison are also absent.
- Routing/editor: this catalog target intentionally changed no routing.
  Diagonal/any-angle wire drawing and whole-Net selection remain explicitly
  deferred by the interaction contract.

## Commit Intent

Commit as:

```text
feat(symbols): migrate reviewed analog assets to Razavi catalog
```
