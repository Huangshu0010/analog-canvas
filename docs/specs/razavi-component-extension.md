# Extending the Razavi Component Set

Status: `accepted`

This is the only procedure for adding a component to the Razavi textbook
palette. The visual authority is
[`razavi-reference-v1`](../../fixtures/visual-reference/razavi-reference-v1/manifest.json),
not VSS, Visio, an SVG export, or visual approximation.

## Eligibility

An item appears in the Razavi palette only if all are true:

1. its `SymbolDefinition` is electrically reviewed and its pins lie on the
   10-unit connection grid;
2. its `catalog.json` entry has `reviewStatus: "reviewed"`;
3. its entry has `palette: true` and
   `visualAuthority.kind: "razavi-reference-v1"`;
4. its Reference manifest, crop(s), and measurement file are present and
   hash-checked by `pnpm symbols:razavi:check`;
5. it is registered in `builtInSymbols` so normal project and SPICE resolution
   can find it.

The runtime selector `razaviReferencePaletteSymbols` enforces these rules.
The editor uses it only while `document.presentation.styleProfileId` is
`"razavi-textbook-v1"`. Compatibility style may still expose legacy symbols;
that does not make them Razavi assets.

## Addition workflow

1. **Accept evidence.** Add an approved raster crop to
   `fixtures/visual-reference/razavi-reference-v1/`; update its manifest hash
   and scope. If the accepted reference does not contain the component, stop:
   do not infer its geometry from VSS or a generic symbol.
2. **Measure it.** Add `<family>-geometry.json` beside the raster. Record the
   crop coordinate system, pixels-per-logical-unit, origin, measured body and
   terminal geometry, and the intended Symbol DSL mapping.
3. **Author Symbol DSL.** Create
   `packages/symbols/assets/razavi-v1/<id>.symbol.json` from those
   measurements. Use semantic stroke roles (`normal`, `emphasis`, `ground`),
   not numeric source line widths. Keep electrical anchors on-grid even where
   measured visual primitives use fractional coordinates.
4. **Review electrical meaning.** Set explicit pin names, order, role,
   direction, variants, and SPICE/PDK mappings. A hidden visual pin must stay
   electrically present. Add a model/schema test if the family introduces a
   new pin or variant rule.
5. **Register authority.** Add the catalog entry with the exact manifest,
   raster path(s), and measurement path under `visualAuthority`. Then add the
   catalog object to `packages/symbols/src/builtins.ts` if it is a new runtime
   symbol.
6. **Protect the result.** Add focused geometry/authority assertions to
   `packages/symbols/src/razavi-catalog.test.ts`; add a raster-diff case to
   `scripts/razavi-fidelity-diff.mjs` when the crop is suitable; update the
   editor E2E expectation if this changes the active palette.
7. **Generate and validate.** Run:

   ```powershell
   pnpm symbols:razavi
   pnpm symbols:razavi:check
   pnpm exec vitest run packages/symbols/src/razavi-catalog.test.ts
   pnpm typecheck
   ```

## Legacy compatibility

An existing resolver symbol without approved Reference evidence must be marked:

```json
"visualAuthority": {
  "kind": "legacy-compatibility",
  "reason": "No approved Razavi Reference calibration exists for this symbol."
}
```

It may keep SPICE compatibility, but cannot enter
`razaviReferencePaletteSymbols`. Do not change that status merely to enlarge
the palette.

## Current active set

The current Reference-calibrated palette is NMOS, PMOS, resistor, capacitor,
Port, ground, independent voltage source, and independent current source.
`nmos3` and `pmos3` are visually calibrated but remain provisional; they are
not palette items.
