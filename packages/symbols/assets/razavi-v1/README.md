# Razavi v1 Symbol Assets

This directory is the runtime catalog for the user-approved Razavi style.

`fixtures/visual-reference/razavi-reference-v1/manifest.json` is the only
visual authority. A catalog entry may appear in the Razavi palette only when
it is both `reviewed` and has:

```json
"visualAuthority": { "kind": "razavi-reference-v1", "...": "..." }
```

The product set is exactly the reviewed, Reference-calibrated entries:

- `nmos`, `pmos`, `ground`, `vdd`;
- `voltage-source`, `current-source`;
- `resistor`, `capacitor`, `port`, and `port-filled`.

`nmos3` and `pmos3` use the same visual authority but remain provisional and
are deliberately excluded from the product set. There is no legacy symbol
catalog and no generic fallback. A device without a reviewed Razavi symbol is
an unsupported import error until its Reference calibration is approved and
added here.

The catalog records only runtime electrical pin order and visual authority.
It does not read or cite VSS/Visio. Historic VSS material is archival evidence
outside this runtime contract and cannot determine geometry, typography, or
palette eligibility.

`catalog.json` is the source. `packages/symbols/src/razavi-catalog.generated.ts`
is generated from it; do not edit that adapter manually.

Update and verify it with:

```powershell
pnpm symbols:razavi
pnpm symbols:razavi:check
```
