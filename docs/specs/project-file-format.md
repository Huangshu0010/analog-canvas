# Project File Format

Status: `accepted`

Current Project schema: `12`

Primary owners: `packages/model` (current shape) and
`packages/project-protocol` (file boundary)

An `.icproj.json` file is canonical JSON for one complete `CircuitProject`.
`@icm/project-protocol` exposes `parseProject` and accepts Project schema 12
and schema 11. Schema 11 advances directly to 12 by adding the structural
revision and materializing every legacy formal terminal as an ordinary Port
Instance connected to its declared Net. Every reader returns the sole
schema-12 in-memory Project shape; schema 10 and older and all future versions
are rejected. There is no sequential
migration registry or second in-memory Project shape.

## Current authorities

- `Document.netlist.terminals` defines the ordered formal Cell interface with
  stable identity, direction, Net binding, and an ordinary Port Instance.
- Hierarchy is an acyclic graph of ordinary Instances whose typed subcircuit
  bindings resolve to child Documents; orphan Cell definitions are allowed.
- Canvas `port` and `port-filled` objects are ordinary Instances with terminal
  `P`; their connectivity is stored only in `Net.terminals` and ordinary
  terminal Route endpoints.
- `Net.terminals` is the electrical membership authority.
- Route endpoints are terminal or Junction references only.
- `Net.powerDomain` explicitly records `none`, `vdd`, `ground`, or diagnostic
  `conflict`; canonical authoring verifies this persisted role after matching
  an explicit global Net by normalized name, never by symbol or fixed ID.
- VDD uses an explicit global Net, Route/Junction rail geometry, and RichText
  annotation. There is no VDD symbol Instance.
- Every visible editable label is a RichText annotation. Renderers do not
  synthesize instance labels from IDs.
- MOS assets are canonical `nmos`/`pmos`; visual variant selection does not
  change persisted terminal connectivity.

## Read and write

```text
read text -> parse JSON -> require Project schema 11 or 12
-> direct v11-to-v12 upgrade when needed -> strict schema-12 validation -> open
save -> strict validation -> canonical key ordering -> atomic write
```

An invalid candidate never replaces the current browser Project. File Resource
staging is non-mutating; a staged Project can replace the live Project only
after explicit human approval in the editor.

A migrated formal file is marked as needing save. The editor does not silently
overwrite the source selected through the browser file input. Browser recovery
records may be canonicalized to v12 only after a successful validated write.

Project entry does not repair duplicate canonical supply Nets (`0` or `VDD`).
Duplicate folded Net names are invalid input and remain a blocking diagnostic
until the author explicitly renames or merges the Nets.

Canonical serialization ends with one newline and is byte-stable across
save/load/save. The current corpus is listed in
`fixtures/projects/compatibility-corpus.json`; its accepted entries must all be
already canonical Project schema 12. The rejected corpus names expected
validation failures.

Viewport, selection, undo history, canvas overlays, Agent credentials,
recovery envelopes, generated renders, and derived diagnostics are not part of
the Project file.
