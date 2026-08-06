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
