# VSS Development Import

Status: `accepted`

Version: `1.0`

Owning phase: `Phase 5`

Primary owners: `tools/vss-import`, `tools/symbol-review`

## Purpose

Define the development-only boundary that converts the owned Visio stencil
into review evidence without introducing Visio, VSS, or inferred electrical
semantics into the product runtime.

## Consumers

- symbol maintainers and reviewers
- `packages/symbols`
- visual golden review

## Data model or interface

The source record pins file path, byte length, and SHA-256. The review manifest
maps selected `masterNameU` values to canonical Symbol DSL IDs and ordered
electrical pin names. The extractor records all master names plus ShapeSheet
cells and geometry formulas for reviewed masters. The review tool renders the
normalized Symbol DSL as an SVG contact sheet.

## Invariants

- The extractor opens the stencil read-only through local Visio COM.
- A source hash mismatch stops extraction.
- Geometry never assigns, removes, or reorders electrical pins.
- A master enters the runtime library only after a checked review mapping.
- The product build and application runtime do not require Visio or the VSS.
- Generated inventory is evidence; normalized Symbol DSL is the shipped form.

## Operations and state transitions

```text
owned VSS + pinned hash
→ read-only master/ShapeSheet inventory
→ human pin and canonical-ID review
→ normalized Symbol DSL
→ deterministic contact sheet and tests
```

## Persistence boundary

The source VSS remains in `lib/`. Review and inventory evidence live under
`fixtures/symbols/`. Compiled built-ins live in `packages/symbols`. No Project
file stores Visio identifiers or raw ShapeSheet formulas.

## Valid example

`NMOS4` is reviewed as canonical `nmos` with ordered pins `D/G/S/B`. The
three-terminal visual variant may hide its bulk lead, while the electrical `B`
pin remains present.

## Rejected example

Importing an arbitrary user VSS and guessing pins from connector placement is
rejected. A changed `circuit.vss` cannot reuse the prior review hash silently.

## Compatibility and migration

Changing normalized geometry without changing electrical pins is a visual
golden change. Changing pin order, canonical IDs, or source identity requires
an explicit review-manifest revision and compatibility analysis.

## Deterministic validation

- source hash and master-count checks
- complete 101-master inventory
- reviewed-master ShapeSheet capture
- review manifest versus built-in pin tests
- deterministic 12-family SVG contact-sheet comparison
