# Agent Layout Recipes

`generate.mjs` turns a SPICE import plus a deterministic layout recipe into a
validated editable Project and matching SVG, PNG, and PDF exports.

```powershell
node tools/agent-layout/generate.mjs netlists/<case>/razavi-layout.mjs
```

A recipe selects the top-level hierarchical Document, may select additional
Documents, normalizes known symbol mappings, and returns ordered edit phases
for each selected Document. The runner:

1. imports SPICE through the product importer;
2. validates any import-time symbol/port normalization;
3. dry-runs and commits typed Agent API transactions in Document and phase
   order;
4. automatically chunks phases to the advertised transaction limit;
5. validates the final Project and emits all formal export formats.

Keep topology recognition in the recipe and transport, validation, batching,
and export behavior in the runner. This makes layout intent reviewable without
duplicating Agent plumbing for every circuit.
