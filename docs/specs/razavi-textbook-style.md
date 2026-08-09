# Razavi Textbook Style

Status: `accepted`
Version: `1.0`
Profile ID: `razavi-textbook-v1`

## Authority

The approved raster manifest at
`fixtures/visual-reference/razavi-reference-v1/manifest.json` is the sole
visual authority for the product. It controls component geometry, stroke
treatment, node treatment, arrows, and calibrated text appearance.

Visio/VSS is retired. `lib/circuit.vss`, `tools/vss-import/`, VSS IR fixtures,
and `generate-visio-*` scripts are immutable archive material. They must not
be invoked by the editor, renderer, catalog generator, or a new visual asset
migration. They do not determine Razavi geometry or palette eligibility.

## Catalog contract

Every entry in `packages/symbols/assets/razavi-v1/catalog.json` owns its
electrical pin order and one visual status:

```ts
visualAuthority:
  | {
      kind: "razavi-reference-v1";
      referenceManifestPath: string;
      referencePaths: string[];
      calibrationPath?: string;
    }
  | { kind: "legacy-compatibility"; reason: string };
```

Only an entry that is both `reviewed` and
`visualAuthority.kind === "razavi-reference-v1"` may be shown in the Razavi
component palette. The exported selector
`razaviReferencePaletteSymbols` is the sole source for that palette.

The active Razavi set is NMOS, PMOS, ground, independent voltage/current
sources, resistor, capacitor, and Port. The three-terminal MOS entries remain
provisional visual variants and are not palette items. Unmigrated symbols can
remain in the compatibility resolver for old documents and SPICE mapping, but
they cannot appear as Razavi components.

## Text system

Text is global, not profile-specific. All documents and visual profiles use
the calibrated Razavi typography tokens:

| Token                               | Value                                          |
| ----------------------------------- | ---------------------------------------------- |
| Font family                         | `Arial, Helvetica Neue, Helvetica, sans-serif` |
| Math                                | bold italic (`700`)                            |
| Body                                | regular (`400`)                                |
| Instance / net / power / annotation | `18` scene units                               |
| Polarity / caption                  | `14` scene units                               |
| Subscript scale / shift             | `0.84` / `0.28em` downward                     |
| Label gap / line height             | `6` / `1.0`                                    |

Style selection may change only geometry, stroke, node, and annotation tokens;
it must not change font family, size, math composition, or subscript rules.

## Geometry and rendering

- Electrical connection anchors use the 10-unit grid; visual primitives may
  use measured fractional coordinates.
- MOS remains electrically four-terminal. The textbook three-terminal view
  hides bulk presentation only; it never changes body connectivity.
- A positioned signal Port is a hollow origin; a Junction is a solid dot.
- Formal output is black-on-white, uses the calibrated role-based stroke
  widths, and has no editor hit overlays.
- Routing behavior is a separate interaction contract and is not part of the
  fixed asset style.

## Gates

`pnpm symbols:razavi:check` must verify all active authority paths,
calibration files, asset hashes, pin order, and generated adapter content.
Focused catalog tests must prove that a legacy compatibility entry cannot
enter `razaviReferencePaletteSymbols`.
