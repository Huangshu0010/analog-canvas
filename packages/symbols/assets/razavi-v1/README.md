# Razavi v1 Symbol Assets

This directory is the runtime catalog for the user-approved Razavi style.

`fixtures/visual-reference/razavi-reference-v1/manifest.json` is the only
visual authority. A catalog entry may appear in the Razavi palette only when
it is both `reviewed` and has:

```json
"visualAuthority": { "kind": "razavi-reference-v1", "...": "..." }
```

The active Reference-calibrated set is:

- `nmos`, `pmos`, `ground`, `voltage-source`, `current-source`;
- `resistor`, `capacitor`, and `port`.

`nmos3` and `pmos3` use the same visual authority but remain provisional and
are deliberately excluded from the palette. `inductor`, `diode`, `npn`, and
`pnp` are `legacy-compatibility` symbols: they remain resolvable so existing
documents and SPICE imports retain electrical identity, but must never be
offered under Razavi style until a Reference calibration is added.

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
