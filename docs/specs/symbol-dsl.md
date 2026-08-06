# Symbol DSL

Status: `accepted`

Version: `1.0-boundary`

Owning phase: `Phase 0/1`

Primary owner: `packages/symbols`

## Purpose

Define versioned, runtime-independent electrical pins and vector geometry for
built-in and project symbols. Raw VSS masters are development inputs, not
runtime symbols.

## Consumers

- symbol compiler and resolver
- SVG renderer
- SPICE importer fallback mapping
- VSS extraction and review tools

## Terminology

| Term | Meaning |
|---|---|
| Electrical pin | Named logical terminal that always remains in the definition |
| Visual variant | Presentation choice that may hide a lead but never delete its electrical pin |
| Alias | Alternate symbol ID resolved to one canonical definition |

## Data model or interface

Version 1 defines ID, name, integer-grid view box, electrical pins, vector
primitives, visual variants, and aliases. A pin has name, role, anchor,
direction, and visibility metadata. Phase 0 primitives are line, polyline,
circle, and path.

`SymbolResolver.resolve(symbolId, variantId?)` returns one validated definition
and optional variant, or `undefined`. Resolution never silently substitutes a
different electrical pin order.

## Invariants

- Pin names are unique within a definition.
- Symbol and alias IDs are unique within a library.
- Every variant-hidden pin names an existing electrical pin.
- Hiding a pin changes presentation only; the pin remains addressable.
- Pin anchors use the same integer coordinate convention as the model.
- Symbol geometry contains no instance placement or net identity.

## Operations and state transitions

```text
reviewed Symbol DSL → validate → compile library → resolve at runtime
```

Raw VSS extraction must pass through review before it becomes Symbol DSL.

## Persistence boundary

The application ships compiled built-ins. A Project persists only the selected
symbol IDs/variants and a library lock. Project-specific symbol files are
external inputs referenced by the Project directory.

## Valid example

A four-pin MOS symbol may provide a textbook variant whose bulk pin is
implicit. The definition still contains D, G, S, and B.

## Rejected example

A variant that hides pin `B` when the definition contains no `B` is rejected.
Duplicate pin names and duplicate aliases are rejected.

## Compatibility and migration

Phase 1 adds production primitives and initial symbols. Phase 5 adds reviewed
VSS-derived families without changing the electrical-pin rule.

## Deterministic validation

- schema and generated JSON Schema inspection
- pin and alias uniqueness tests
- rotation/mirror property tests in the renderer
- implicit-pin connectivity tests

## Open decisions

- Exact path normalization and rich text primitives are finalized with Phase 1
  and Phase 5 rendering evidence.
