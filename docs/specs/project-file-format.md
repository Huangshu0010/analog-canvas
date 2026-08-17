# Project File Format

Status: `accepted`

Current Project schema: `11`

Primary owners: `packages/model` (current shape) and
`packages/project-protocol` (file boundary)

An `.icproj.json` file is canonical JSON for one complete `CircuitProject`.
`@icm/project-protocol` exposes `parseProject` and accepts Project schema 11
and schema 10. Schema 10 advances
directly to 11 without rewriting content, then passes the full strict current
validation. Every reader returns the sole schema-11 in-memory Project shape;
schema 9 and older and all future versions are rejected. There is no sequential
migration registry or second in-memory Project shape.

## Current authorities

- `Document.netlist.terminals` privately maps ordered formal cell-terminal
  names to existing Net IDs for structural netlist export.
- Canvas `port` and `port-filled` objects are ordinary Instances with terminal
  `P`; their connectivity is stored only in `Net.terminals` and ordinary
  terminal Route endpoints.
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
read text -> parse JSON -> require Project schema 10 or 11
-> direct v10-to-v11 upgrade when needed -> strict schema-11 validation -> open
save -> strict validation -> canonical key ordering -> atomic write
```

An invalid candidate never replaces the current browser Project. File Resource
staging is non-mutating; a staged Project can replace the live Project only
after explicit human approval in the editor.

A migrated formal file is marked as needing save. The editor does not silently
overwrite the source selected through the browser file input. Browser recovery
records may be canonicalized to v11 only after a successful validated write.

Canonical serialization ends with one newline and is byte-stable across
save/load/save. The current corpus is listed in
`fixtures/projects/compatibility-corpus.json`; its accepted entries must all be
already canonical Project schema 11. The rejected corpus names expected
validation failures.

Viewport, selection, undo history, canvas overlays, Agent credentials,
recovery envelopes, generated renders, and derived diagnostics are not part of
the Project file.
