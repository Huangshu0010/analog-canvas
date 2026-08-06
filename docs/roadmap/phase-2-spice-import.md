# Phase 2 - SPICE Import

Status: `complete`

## Objective

Import the current repository netlists into transient Circuit IR and persistent
SchematicDocuments without losing hierarchy, terminal order, parameters, or
unrecognized source text.

## User-visible outcome

A user selects a current `circuit.spi`; the application follows local includes,
creates one Document per subcircuit, places instances in Unplaced Instances,
and reports unresolved symbols or syntax with source locations.

## In scope

- SourceBundle and source manifest;
- comment, whitespace, continuation, and source-span preservation;
- local relative `.include` resolution;
- `.subckt/.ends`, `.param`, and `.model` needed by current fixtures;
- current R/C/L/D/E/F/G/H/I/Q/S/V/X instance families;
- hierarchy, positional terminals, values, models, and parameters;
- transient Circuit IR;
- Circuit IR to Project/Document importer;
- generic block fallback for unresolved symbols;
- connectivity golden fixtures for the current `netlists/` corpus.

## Out of scope

- complete SPICE3/ngspice syntax coverage;
- simulation or model evaluation;
- HSPICE/PSpice/LTspice/Xyce completeness;
- re-import merge and SPICE patch printing;
- automatic placement and routing.

## Dependencies

- Phase 0 exit gate;
- accepted `circuit-ir.md`, minimal `spice-frontend.md`,
  `project-file-format.md`, and `symbol-dsl.md`;
- current `netlists/` and colocated include files.

## Work packages

### WP-2.1 - Source and lossless syntax foundation

- Goal: retain source files, spans, trivia, continuation, and unknown lines.
- Main modules: `spice/source`, `spice/syntax`.
- Required specs: `spice-frontend.md`.
- Validation surface: lossless source fixtures and diagnostics positions.

### WP-2.2 - Current-fixture statement parsers

- Goal: parse the directives and element families present today.
- Main modules: syntax projections and initial dialect rules.
- Required specs: current compatibility matrix in `spice-frontend.md`.
- Validation surface: per-statement valid/rejected fixtures.

### WP-2.3 - Elaboration and Circuit IR

- Goal: resolve subcircuit scopes, terminal order, includes, and net identity.
- Main modules: `spice/elaborate`, `spice/ir`.
- Required specs: `circuit-ir.md`.
- Validation surface: hierarchy and connectivity golden JSON.

### WP-2.4 - Schematic importer

- Goal: create Documents, source bindings, unplaced instances, nets, ports,
  symbol mappings, and generic fallbacks.
- Main modules: `spice/importer`, `symbols/fallback`, core model.
- Required specs: `schematic-model.md`, `symbol-dsl.md`.
- Validation surface: imported Project golden fixtures and unresolved reports.

## Deliverables

- SourceBundle implementation;
- first lossless syntax tree and typed projections;
- transient Circuit IR;
- importer into Project/Document;
- symbol mapping and generic fallback;
- import diagnostics with file/line spans;
- connectivity goldens for all current fixtures.

## Acceptance scenarios

```text
Select netlists/mixed-device-acceptance/circuit.spi
→ resolve models.inc
→ create Documents for every subckt
→ preserve every instance and positional terminal
→ keep all placements null
→ report no silently dropped statement
```

```text
Import an X instance whose symbol is unknown
→ preserve instance, terminals, parameters, and source span
→ use a generated generic block
→ emit an actionable symbol-resolution diagnostic
```

## Deterministic validation

- source preservation and source-span tests;
- include-resolution tests, including missing and cyclic includes;
- current-fixture statement parser tests;
- Circuit IR connectivity golden comparisons;
- imported Project schema validation;
- assertion that every non-comment source statement is parsed or preserved as
  opaque with a diagnostic.

## Risks and decisions

| Risk or decision | Handling |
|---|---|
| Parser overfits examples | Separate current acceptance coverage from Phase 4 corpus |
| Pin order is guessed | Require explicit device/subcircuit terminal schemas |
| Unknown devices are dropped | Generic fallback and opaque preservation are mandatory |
| Includes escape project scope | Make copy/reference policy and allowed roots explicit |

## Exit gate

- Every current netlist imports without silent loss;
- hierarchy and connectivity goldens pass;
- all instances are mapped or represented by generic fallbacks;
- Phase 3 can consume imported Documents without accessing syntax-tree data.

## Completion evidence

Completed on `2026-08-07`.

- The pure virtual-file adapter and isolated Node adapter retain source hashes,
  encoding, exact decoded text, logical continuations, physical lines, and
  offset/line/column spans. Local includes are deterministic and diagnose
  duplicates, missing files, cycles, and selected-root escapes.
- The current profile projects `.include`, `.subckt/.ends`, `.param`, `.model`,
  and every element family present in the corpus. Unknown statements remain
  opaque with diagnostics; no non-comment logical statement is unaccounted for.
- All seven `circuit.spi` entries imported successfully: 24 cells, 127
  instances, ordered ports/terminals, hierarchy, raw parameters, four included
  models, and connectivity hashes match the committed corpus golden.
- The importer creates schema-valid unplaced Documents, source bindings and
  manifests, logical nets, raw SPICE properties, and pin-count-matched
  `generic-block-N` fallbacks. A canonical imported RLC Project matches its
  committed golden byte-for-byte.
- The editor imported the real mixed-device `circuit.spi` plus `models.inc`
  into 8 Documents and 32 unplaced instances through the browser file control.
  Saved JSON excludes source text, syntax, IR, and diagnostics.
- Fifteen test files with 49 tests passed; both the manual-editor and SPICE-file
  Playwright flows passed. Browser review confirmed the import control, no
  horizontal overflow, accessible DOM structure, and an empty warning/error
  console.
- Frozen install, formatting, Reference isolation, TypeScript typecheck,
  workspace build, Markdown link/fence checks, product/reference coupling
  inspection, `git diff --check`, and repository status review passed.
