# VSS Import

`Export-VssInventory.ps1` is a Windows development tool. It opens the owned
`lib/circuit.vss` stencil read-only through Visio COM, verifies its reviewed
SHA-256 identity, inventories every master, and captures ShapeSheet formulas
only for masters listed in the review manifest.

```powershell
.\tools\vss-import\Export-VssInventory.ps1 `
  -OutputPath .\fixtures\symbols\circuit-vss-inventory.json
```

The generated inventory is evidence, not a runtime asset. Electrical pin names
come from `fixtures/symbols/circuit-vss-review.json`; they are never inferred
from drawing geometry. Runtime symbols remain product-owned, normalized Symbol
DSL definitions in `packages/symbols`.

## Structured Master IR proof

`Export-VssMasterIr.ps1` is the RV-1 decoder proof for the Razavi style
pipeline. It extracts the five target Masters `NMOS4`, `Pmos3.a`, `R`, `DC-V`,
and `node`. Because none of those Masters contains a non-empty text run, it
also extracts `TEXT` as a clearly marked `coverage-only` Master. That sixth
Master proves character/paragraph capture but cannot enter the runtime symbol
catalog without its own review disposition.

```powershell
.\tools\vss-import\Export-VssMasterIr.ps1 `
  -OutputPath .\fixtures\symbols\vss-ir\razavi-rv1-master-ir.json

.\tools\vss-import\Test-VssMasterIr.ps1
```

The versioned `VssMasterIR` records:

- source hash, Visio version, total Master count, and decoder version;
- nested group/shape order and complete local transforms;
- named geometry-row kinds plus formulas and evaluated internal-unit values;
- line/fill styles including weights and arrowheads;
- connection-point rows without assigning electrical names;
- text block, character, and paragraph evidence;
- blocking diagnostics for unknown geometry row types.

Geometry row numbers and names follow Microsoft's
[VisRowTags enumeration](https://learn.microsoft.com/office/vba/api/visio.visrowtags);
the IR retains both so future decoder versions cannot silently reinterpret
existing evidence.

The test extracts to an isolated temporary file, compares its SHA-256 with the
checked fixture, and verifies target ordering and feature coverage. The tool is
Windows/Visio-only development infrastructure. Product builds and runtime do
not read the VSS or require Visio.

## Core analog migration evidence

RV-6 reuses the same decoder for a separate checked fixture containing the
union of all reviewed mappings, all provisional migration candidates, and the
semantic `node` and `Arrow` Masters. It intentionally does not rewrite or
expand the RV-1 proof fixture.

```powershell
.\tools\vss-import\Test-VssCoreAnalogIr.ps1
```

`razavi-rv6-core-analog-master-ir.json` currently covers 27 Masters, 175
nested Shapes, 504 geometry rows, and 45 connection points. The checker
re-extracts the target set, compares the complete fixture hash, validates
review-manifest coverage, and rejects decoder diagnostics. Connection points
remain evidence only; catalog pin names and order still come from explicit
human review.

For MOS fidelity audits, `Export-VisioMosReferences.ps1` exports `NMOS4`,
`PMOS4`, `Nmos3.a`, and `Pmos3.a` one at a time from a read-only stencil. Each
isolated Visio process is terminated after its export because Visio COM does
not reliably return from `Quit()` for this VSS. The script verifies the stencil
hash before and after, normalizes filename-only SVG metadata, and supports a
byte-for-byte `-Check` mode:

```powershell
pnpm symbols:visio-mos:reference
pnpm symbols:visio-mos:reference:check
```

The checked SVGs under `fixtures/visual-reference/visio-mos/` are independent
comparison evidence, not runtime assets. Runtime MOS JSON is generated from
Master IR; pin names still come only from the human review manifest. The
fidelity board embeds both the independent Visio SVG and runtime rendering so
a self-render cannot masquerade as source comparison.

## Core non-transistor reference exports

`Export-VisioCoreAnalogReferences.ps1` applies the same read-only,
isolated-process export discipline to the reviewed high-frequency Masters
`R`, `C`, `L`, `Diode1`, `GND`, `I/O`, `DC-V`, and `DC-I`.

```powershell
pnpm symbols:visio-core-analog:reference
pnpm symbols:visio-core-analog
```

The runtime assets are derived from the RV-6 Master IR by
`scripts/generate-visio-core-analog-assets.mjs`. The converter preserves
line/circle geometry, stroke roles, Visio Arrow Type 13, and sampled
`EllipticalArcTo` geometry; it rejects unrecognized visual constructs instead
of approximating them silently. The checked source exports live under
`fixtures/visual-reference/visio-core-analog/`, and the source/runtime/overlay
board is `fixtures/visual-golden/visio-core-analog-fidelity.svg`.
`symbols:visio-core-analog` is atomic: it updates the eight runtime assets,
their catalog provenance and hashes, then regenerates the TypeScript runtime
adapter. Its `:check` form rejects a stale asset, catalog, adapter, or fidelity
board; do not run only a partial generation step.

Other ad hoc Master exports remain temporary evidence. Geometry may enter the
migration-candidate catalog before pin review, but its manifest status must
remain `geometry-migrated-pin-review-required` until a human confirms the
electrical mapping.
