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

For fidelity audits, individual Masters may also be exported from a read-only
Visio session and compared visually with normalized SVG. Such exports are
temporary evidence and must not be committed as runtime assets. Geometry may
enter the migration-candidate catalog before pin review, but its manifest
status must remain `geometry-migrated-pin-review-required` until a human
confirms the electrical mapping.
