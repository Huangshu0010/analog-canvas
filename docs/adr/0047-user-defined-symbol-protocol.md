# 0047 - User-Defined Symbol Protocol

Status: `accepted`

Date: `2026-08-27`

Owners: `packages/model`, `packages/project-protocol`, `packages/symbols`,
`packages/edit-engine`, `apps/editor`

## Context

The product library is exactly the reviewed Razavi catalog (ADR 0026, the
Symbol DSL spec). A Project persists only exact symbol and optional variant
IDs plus its library lock, and the runtime resolves every instance against
`builtInSymbols` plus project-derived hierarchy symbols. There is no way for
a user to author or import a symbol outside that catalog, so circuits that
need a drawing the catalog lacks are blocked at the first placed instance.

The existing extension seams are deliberate: hierarchy blocks and external
subcircuit masters generate symbols at runtime (ADR 0025, ADR 0029), but
their geometry is positional and derived from an electrical interface, not
from reviewed artwork. The Symbol DSL already defines a validated
`SymbolDefinition` shape with pins, primitives, and variants; only its
ownership sits in `@icm/symbols`, which cannot be referenced by the
persistence layer because `@icm/model` is below it in the package graph.

## Decision

Advance the Project format to schema 26 and add an optional
`customSymbolDefinitions` array, following the `externalSubcircuitDefinitions`
precedent: the project file is the authority for every user-defined symbol,
so a saved circuit is portable without any side channel.

A definition is `{ id, symbol }`:

- `id` is the stable definition identity. Editing artwork replaces the
  embedded symbol without changing project references.
- `symbol` is a complete validated `SymbolDefinition` (schema, pins,
  primitives, variants) exactly as the Symbol DSL defines it. To make that
  possible, the `SymbolDefinition` schema moves from `@icm/symbols` into
  `@icm/model`; `@icm/symbols` re-exports it unchanged so the 80+ existing
  import sites keep working.

Resolution is namespaced: a custom definition never competes with built-in,
hierarchy, or external-subcircuit symbol IDs. `@icm/symbols` derives the
runtime symbol ID from the definition ID (`custom-symbol` namespace), so a
custom symbol whose embedded artwork carries a colliding `symbol.id` cannot
shadow a catalog asset. The derived-ID mapping and resolver wiring land in
`@icm/symbols` as the follow-up target of this ADR; schema 26 persists the
raw definition only.

Custom symbols are manual-only devices. They carry no device descriptor, no
reference prefix, and no netlist emission: an instance of a custom symbol
wires, transforms, saves, and renders like an op-amp or logic gate, and the
design-netlist preflight reports it as unsupported until an explicit
subcircuit or PDK mapping exists. Model-level validation in schema 26 covers
definition-ID uniqueness and the embedded `SymbolDefinition` shape; existence
of an instance's `symbolId` remains a resolver-level question, exactly as it
already is for catalog symbols.

## Alternatives considered

### Store custom symbols in browser localStorage

- Benefits: no schema change; symbols shared across projects.
- Costs: symbols separate from the project file, lost on browser change,
  and silently missing when a project is shared.
- Reason not selected: the `.icproj.json` file is the single authoritative
  artifact (ADR 0006); a side channel breaks that guarantee.

### A separate user-library file format

- Benefits: reusable symbol libraries without touching the project schema.
- Costs: a second file IO surface, load-order coupling, and a new
  compatibility surface before the basic need is met.
- Reason not selected: defer until project-embedded symbols prove the
  import/validation flow; the embedded shape does not preclude a later
  packaging format.

### Validate the embedded symbol lazily in `@icm/symbols`

- Benefits: no package-boundary change.
- Costs: `CircuitProjectSchema` would persist unvalidated payload, letting
  malformed artwork reach the resolver only at render time.
- Reason not selected: the persistence boundary is the validation boundary
  for every other persisted fact; custom symbols should not weaken it.

### Give custom symbols device descriptors for netlist export

- Benefits: immediate SPICE emission for imported primitives.
- Costs: the device registry is a compiled, cross-package parity-checked
  contract (ADR 0017); runtime user input cannot join it safely.
- Reason not selected: manual-only matches the accepted op-amp and logic
  gate treatment and keeps export deterministic.

## Consequences

### Positive

- A saved project renders identically on any machine with no external
  state.
- The validated Symbol DSL is reused verbatim; no second artwork format.
- Built-in catalog assets remain untouched; the Razavi-only product
  library contract is unchanged.

### Negative or limiting

- Schema 24 files leave the rolling compatibility window; only 25 and 26
  are accepted (the 24-to-25 Cell Pin migration retires with them).
- Symbol artwork schema now lives in `@icm/model`; `@icm/symbols` keeps a
  re-export seam that must be respected by future edits.
- Projects with many large custom symbols grow the `.icproj.json` file; the
  array is capped at 256 definitions.

## Compatibility and migration

The schema-25 reader is replaced by a schema-26 reader that accepts schema
25 and 26. The 25-to-26 adapter advances `schemaVersion` and defaults
`customSymbolDefinitions` to `[]`; no other fact changes. The schema-24
adapter and its Cell Pin splitting migration are removed with their tests,
consistent with the one-version rolling window policy (ADR 0023). Canonical
fixtures, saved examples, and the compatibility corpus are regenerated at
schema 26.

## Validation

- model schema tests: definition-ID uniqueness, embedded symbol validation,
  default empty array on parse;
- protocol tests: 25-to-26 migration round trip, window rejection for 24
  and 27, canonical serialize/parse equality;
- unchanged re-export surface: `@icm/symbols` type and schema tests pass
  without behavioral edits.

## Related documents

- [`0023-rolling-previous-project-compatibility.md`](0023-rolling-previous-project-compatibility.md)
- [`0026-definition-level-cell-symbol-presentation.md`](0026-definition-level-cell-symbol-presentation.md)
- [`0029-external-subcircuit-definition-protocol.md`](0029-external-subcircuit-definition-protocol.md)
- [`../specs/symbol-dsl.md`](../specs/symbol-dsl.md)
- [`../specs/project-file-format.md`](../specs/project-file-format.md)
