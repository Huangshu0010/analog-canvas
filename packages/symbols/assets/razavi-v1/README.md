# Razavi v1 Symbol Assets

This directory is the source of truth for the `razavi-symbols@1` component
catalog.

The catalog currently contains 12 reviewed canonical assets (`capacitor`,
`current-source`, `diode`, `ground`, `inductor`, `nmos`, `npn`, `pmos`, `pnp`,
`port`, `resistor`, and `voltage-source`) plus the provisional `pmos3` asset.
Canonical MOS assets remain electrically four-terminal; their
`textbook-3terminal` variant hides bulk presentation only.

- `catalog.json` records source VSS Master, decoder version, review state, pin
  order, palette/mapping reachability, asset path, and canonical asset hash.
- `*.symbol.json` files are normalized Symbol DSL assets. Geometry may change
  only through a reviewed migration; pin order follows the electrical review
  manifest rather than visual inference.
- `node` is intentionally absent as a component. Its VSS evidence is cataloged
  under `semanticPrimitives` and is consumed later by Junction presentation.
- `nmos3` and automatic MOS bulk/variant selection remain outside this catalog
  release until their pin semantics and Net classification policy are reviewed.
- `packages/symbols/src/razavi-catalog.generated.ts` is a deterministic runtime
  adapter generated from these JSON files. Do not edit it directly.

Canonical hashes use UTF-8 JSON with LF line endings and one final newline, so
Windows checkout policy does not change asset identity.

Update and verify the adapter with:

```powershell
pnpm symbols:razavi
pnpm symbols:razavi:check
```
