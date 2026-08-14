# Project File Format

Status: `accepted`

Current schema: `9`

Primary owner: `packages/model`

An `.icproj.json` file is canonical JSON for one complete `CircuitProject`.
`parseProject` accepts exactly schema 9, validates the full strict schema, and
rejects every older or newer version. There is no migration registry,
compatibility reader, or second in-memory Project shape.

## Current authorities

- `Document.netlist.terminals` privately maps ordered formal cell-terminal
  names to existing Net IDs for structural netlist export.
- Canvas `port` and `port-filled` objects are ordinary Instances with terminal
  `P`; there is no `Document.ports`, `Net.ports`, or Port route endpoint.
- `Net.terminals` is the electrical membership authority.
- Route endpoints are terminal or Junction references only.
- `Net.powerDomain` explicitly records `none`, `vdd`, `ground`, or diagnostic
  `conflict`; it is never inferred from a name, symbol, or fixed ID.
- VDD uses an explicit global Net, Route/Junction rail geometry, and RichText
  annotation. There is no VDD symbol Instance.
- Every visible editable label is a RichText annotation. Renderers do not
  synthesize instance labels from IDs.
- MOS assets are canonical `nmos`/`pmos`; visual variant selection does not
  change persisted terminal connectivity.

## Read and write

```text
read text -> parse JSON -> require schema 9 -> strict validation -> open
save -> strict validation -> canonical key ordering -> atomic write
```

An invalid candidate never replaces the current browser Project. File Resource
staging is non-mutating; a staged Project can replace the live Project only
after explicit human approval in the editor.

Canonical serialization ends with one newline and is byte-stable across
save/load/save. The current corpus is listed in
`fixtures/projects/compatibility-corpus.json`; its accepted entries must all be
already canonical schema 9. The rejected corpus names expected validation
failures.

Viewport, selection, undo history, canvas overlays, Agent credentials,
recovery envelopes, generated renders, and derived diagnostics are not part of
the Project file.
