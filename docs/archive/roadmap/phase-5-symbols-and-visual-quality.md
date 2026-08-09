# Phase 5 - Symbols and Visual Quality

Status: `complete`

> Historical completion record. Its VSS extraction/review and Visio-derived
> visual-source claims were superseded on 2026-08-09 by
> [ADR 0011](../adr/0011-retire-visio-vss-as-visual-authority.md). Current
> symbol appearance is authored and accepted only from the raster reference.

## Objective

Turn the functional editor into a consistent textbook-style schematic tool by
building the VSS-derived symbol pipeline, formal annotation model, layout
intent, visual diagnostics, and stable export-quality SVG goldens.

## User-visible outcome

Users can build compact black-and-white schematics with consistent device
symbols, rails, trunks, junction dots, rich instance/net labels, electrical
annotations, alignment constraints, and predictable SVG output.

## In scope

- local Windows/Visio VSS extraction tool;
- Symbol Review Tool and reviewed Symbol DSL output;
- first production symbol families needed by current fixtures;
- electrical pin versus visual pin and symbol variants;
- generic block fallback refinement;
- InstanceLabel, NetLabel, PowerLabel, PlainText, Current/Voltage Annotation,
  and FigureCaption;
- `textbook-monochrome-v1` tokens and formal/overlay layer separation;
- LayoutGroup and LayoutConstraint data and manual editing support;
- label, spacing, overlap, symmetry, short-segment, and page diagnostics;
- original visual golden Projects and SVGs.

## Out of scope

- pixel reproduction of copyrighted textbook images;
- multiple user-selectable themes;
- fully automatic analog layout;
- AI API transport;
- arbitrary end-user VSS import without pin review.

## Dependencies

- Phase 1 and Phase 3 exit gates;
- accepted `symbol-dsl.md`, `visual-language.md`, and relevant routing rules;
- `lib/circuit.vss` provenance and binary handling rules;
- Visio COM available for the extraction tool.

## Work packages

### WP-5.1 - VSS extraction and review

- Goal: extract master geometry and metadata, normalize it, and capture human
  pin semantics without runtime Visio dependency.
- Main modules: `tools/vss-import`, `tools/symbol-review`.
- Required specs: `symbol-dsl.md` and asset provenance rules.
- Validation surface: master inventory, normalized SVG, and reviewed mappings.

### WP-5.2 - Production Symbol Library

- Goal: compile reviewed symbols, variants, implicit pins, aliases, and generic
  fallbacks into a versioned built-in library.
- Main modules: `packages/symbols` and symbol assets.
- Required specs: Symbol DSL and library lock contracts.
- Validation surface: schema, transform, pin, and visual golden tests.

### WP-5.3 - Annotation and presentation

- Goal: implement semantic labels, rich text, attachments, manual placement,
  locks, and presentation intent.
- Main modules: core model/edit, renderer, GUI panels/tools.
- Required specs: `schematic-model.md`, `visual-language.md`.
- Validation surface: attachment and SVG typography goldens.

### WP-5.4 - Layout intent and visual diagnostics

- Goal: support groups/constraints and report measurable visual defects without
  silently rearranging user work.
- Main modules: core model/derived/edit, diagnostics UI.
- Required specs: layout sections of visual and edit specs.
- Validation surface: original analog schematic fixtures and diagnostics.

## Deliverables

- VSS extractor and Symbol Review Tool;
- versioned production Symbol Library;
- semantic annotation model and editing tools;
- layout groups, constraints, and locks;
- visual diagnostics;
- accepted `textbook-monochrome-v1` spec;
- original visual-golden Projects and SVGs.

## Acceptance scenarios

```text
Extract a selected VSS master
→ normalize geometry
→ review D/G/S/B pins
→ compile Symbol DSL
→ render all rotations and mirrors
→ verify electrical connectivity is unchanged by visual variant
```

```text
Open an original dense analog fixture
→ align matched devices
→ create VDD and bias trunks
→ place instance and net labels
→ export monochrome SVG
→ obtain no junction ambiguity or label-overlap diagnostic
```

## Deterministic validation

- Symbol DSL schema and pin uniqueness tests;
- rotation/mirror and implicit-pin property tests;
- VSS master-to-symbol review manifest;
- annotation attachment and lock tests;
- original SVG golden comparisons;
- formal-layer versus overlay export inspection;
- visual diagnostics fixtures.

## Risks and decisions

| Risk or decision                        | Handling                                                            |
| --------------------------------------- | ------------------------------------------------------------------- |
| VSS artwork conflicts with target style | Normalize through Symbol DSL rather than shipping raw masters       |
| Hidden bulk loses electrical meaning    | Keep every electrical terminal and validate implicit presentation   |
| Golden tests copy a publication         | Use original circuits and screenshots only as qualitative reference |
| Style rules override user placement     | Diagnostics advise; only hard electrical invariants block edits     |

## Exit gate

- Required current-fixture symbol families are production-ready;
- visual variants preserve electrical terminals;
- original textbook-monochrome golden schematics render deterministically;
- formal export is free of editor overlays and blocking visual diagnostics.

## Completion evidence

- Visio COM 16.0 read the owned, hash-pinned `circuit.vss` in read-only mode;
  the checked inventory contains all 101 masters and ShapeSheet evidence for
  12 human-reviewed production mappings. Neither builds nor runtime load VSS
  or Visio.
- The normalized library adds voltage/current sources, diode, NPN, and PNP;
  VSS review pins match every built-in definition, generic blocks remain
  deterministic, and MOS visual variants preserve `D/G/S/B` while hiding the
  tagged bulk lead.
- Semantic annotations, layout groups/constraints, locks, attached-label
  movement, and group alignment use the same Edit Engine transaction union as
  all other edits.
- Deterministic diagnostics cover placement, resolution, symbol/label overlap,
  route length, ambiguous Junction dots, constraint satisfaction, and page
  bounds without moving user geometry.
- The original dense differential-stage Project and SVG golden have zero
  crossings, label-overlap findings, or blocking diagnostics. Browser visual
  review corrected label placement and kept current text upright.
- Typecheck, 73 tests in 20 files, workspace build, reviewed-symbol and dense
  SVG checks, and five Playwright flows passed before the final repository
  gates.
