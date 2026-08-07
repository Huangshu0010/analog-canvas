# Symbol DSL

Status: `accepted`

Version: `1.9`

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

| Term           | Meaning                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| Electrical pin | Named logical terminal that always remains in the definition                 |
| Visual variant | Presentation choice that may hide a lead but never delete its electrical pin |
| Alias          | Alternate symbol ID resolved to one canonical definition                     |

## Data model or interface

Version 1 defines ID, name, integer-grid view box, electrical pins, vector
primitives, visual variants, and aliases. A pin has name, role, anchor,
direction, and visibility metadata. Primitives are line, polyline, polygon,
circle, and path. Primitive geometry accepts finite decimal coordinates so a
decoded source asset does not lose sub-unit geometry. A primitive may carry a stable `part`; a variant may hide
parts and add reviewed presentation primitives as well as hide pin presentation
without changing electrical pins. Polygon fill is explicitly `none` or
`foreground`. A primitive may select semantic `strokeRole` (`normal`,
`emphasis`, `supply`, or `annotation`) plus an optional reviewed line cap/join.
The renderer resolves that role through the Document's style profile. Numeric
`strokeWidth` remains a mutually exclusive legacy compatibility field for
assets not yet migrated to a catalog role.

The reviewed production set contains resistor, capacitor, inductor, NMOS,
PMOS, ground, port, independent voltage/current source, diode, NPN, and PNP.
The runtime library additionally contains explicitly marked VSS migration
candidates such as three-terminal MOS devices, diode variants, source variants,
op-amp, switches, crystal, transformer, and VDD. Procedural `generic-block-N`
definitions preserve unsupported terminal counts.

`SymbolResolver.resolve(symbolId, variantId?)` returns one validated definition
and optional variant, or `undefined`. Resolution never silently substitutes a
different electrical pin order.

The PDK registry is a separate reviewed mapping from source model name and
terminal count to `symbolId` plus an explicit ordered pin list. Exact overrides
take priority over PDK-scoped namespace rules. The initial reviewed rules map
four-terminal SKY130 `sky130_fd_pr__nfet_*` and `pfet_*` models to NMOS/PMOS
with D/G/S/B order. A namespace or terminal-count mismatch returns no mapping;
the importer preserves the source model/parameters and uses `generic-block-N`.
Successful mappings persist their registry ID in instance properties so a
Snapshot and later audit can explain the choice.

## Invariants

- Pin names are unique within a definition.
- Symbol and alias IDs are unique within a library.
- Every variant-hidden pin names an existing electrical pin.
- Every variant-hidden primitive part names presentation geometry only.
- Variant-added primitives carry no electrical-pin or Net semantics.
- Hiding a pin changes presentation only; the pin remains addressable.
- Variant-hidden and base `implicit` pins are absent from visible connectivity,
  flightlines, snap targets, and formal pin presentation while retaining their
  electrical Net membership.
- A base `conditional` pin is treated as visible unless a separate
  context-aware Net policy authorizes implicit presentation. Unknown or normal
  signal Nets therefore fail safe toward visibility.
- Pin anchors use the canonical 10-unit electrical connection grid. Symbol
  artwork may use arbitrary finite decimal coordinates, but every pin anchor must be
  divisible by 10 on both axes. With grid-aligned instance placement, this
  keeps every terminal on-grid after rotation or mirroring, including
  multi-port devices whose pins cannot be aligned by translating the instance.
- Symbol geometry contains no instance placement or net identity.
- A primitive style cannot contain both `strokeRole` and `strokeWidth`.
- Razavi catalog assets use semantic stroke roles; raw source weights remain
  provenance evidence rather than final rendered widths.
- PDK mapping never infers pin order from a symbol name alone; a rule includes
  terminal count and the complete ordered pin list.

## Operations and state transitions

```text
reviewed Symbol DSL → validate → compile library → resolve at runtime
```

Raw VSS extraction must pass through the pinned source inventory and human pin
review before its electrical semantics become reviewed. Candidate geometry may
ship with a provisional mapping only when the manifest and contact sheet label
that status unambiguously. See
[`vss-development-import.md`](vss-development-import.md).

## Persistence boundary

The application ships compiled built-ins. A Project persists only the selected
symbol IDs/variants and a library lock. Project-specific symbol files are
external inputs referenced by the Project directory.

## Valid example

A four-pin MOS symbol may provide a textbook variant whose bulk pin is
implicit and whose visible source arrow reuses reviewed three-terminal artwork.
The definition still contains D, G, S, and B.

Selecting that variant never means `B=S`. For example, an NMOS may show three
terminals while its persisted `B` belongs to VSS and its distinct `S` belongs
to a tail-current Net.

## Rejected example

A variant that hides pin `B` when the definition contains no `B` is rejected.
Duplicate pin names and duplicate aliases are rejected.

## Compatibility and migration

Phase 5 calibrated geometry against reviewed VSS masters without changing
canonical IDs or the electrical-pin rule. Four-terminal NMOS and PMOS use
distinct bulk-arrow direction rather than an invented PMOS gate bubble.
Three-terminal MOS devices remain separate migration-candidate definitions.
Their reviewed geometry may also be reused by a presentation variant of the
canonical four-pin definition when SPICE connectivity must retain the hidden
fourth pin.

Symbol DSL 1.7 adds `strokeRole` compatibly. Existing numeric widths continue
to render byte-identically under `textbook-monochrome-v1`. Under a semantic
profile, remaining legacy widths are deterministically clustered into normal
or emphasis roles until their assets receive explicit reviewed roles.

Symbol DSL 1.8 clarifies the existing visibility contract without changing
the JSON shape: `hiddenPinNames` is interpreted as implicit presentation by
visible-connectivity consumers. Net-class-driven automatic selection remains
a separate compatibility feature; Agents must not force this variant across
all MOS instances without checking bulk connectivity.

Symbol DSL 1.9 separates visual geometry precision from electrical grid
precision. Primitive points may retain finite decimals decoded from VSS, while
pin anchors and instance placement remain integer grid coordinates.

## Deterministic validation

- schema and generated JSON Schema inspection
- pin and alias uniqueness tests
- rotation/mirror property tests in the renderer
- canonical connection-grid checks across every built-in pin
- implicit-pin connectivity tests

## Open decisions

- Rich text beyond semantic annotation kinds remains a later compatible
  extension.
