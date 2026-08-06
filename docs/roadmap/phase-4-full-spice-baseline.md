# Phase 4 - Full SPICE Baseline

Status: `proposed`

## Objective

Advance the Phase 2 importer from current-fixture coverage to a documented,
lossless SPICE3/ngspice structural-compatibility baseline without implementing
simulation.

## User-visible outcome

A user can import broad SPICE3/ngspice netlists, retain unsupported vendor text,
receive precise compatibility diagnostics, and round-trip source without losing
comments, control blocks, formatting-critical tokens, or unknown statements.

## In scope

- explicit baseline version and compatibility matrix;
- complete baseline device and directive structural parsing;
- expressions, functions, numeric suffixes, and parameter scope;
- include, lib, conditional, global-node, model, and subcircuit elaboration;
- behavioral and controlled-source structure;
- `.control/.endc` recognition and lossless preservation, not execution;
- dialect detection with evidence and user override;
- lossless printer and normalized diagnostic representation;
- official/minimal syntax corpus and parser fuzz/property testing.

## Out of scope

- numerical simulation or model evaluation;
- guaranteed semantic execution compatibility with every vendor simulator;
- complete HSPICE/PSpice/LTspice/Xyce extensions;
- automatic repair of invalid source;
- re-import merge UI and editable netlist export.

## Dependencies

- Phase 2 exit gate;
- accepted expanded `spice-frontend.md` and `circuit-ir.md`;
- selected official SPICE3/ngspice documentation baseline;
- license-safe minimized syntax corpus.

## Work packages

### WP-4.1 - Compatibility contract

- Goal: name the baseline versions, supported constructs, preservation policy,
  and diagnostic severity rules.
- Main modules: docs/specs and dialect registry.
- Required specs: accepted `spice-frontend.md`; baseline ADR.
- Validation surface: machine-readable compatibility matrix.

### WP-4.2 - Expressions and preprocessing

- Goal: complete parameter expressions, scope, functions, lib, conditionals,
  global nodes, and include behavior.
- Main modules: `spice/expressions`, `spice/source`, `spice/elaborate`.
- Required specs: expression and preprocessing contracts.
- Validation surface: valid/rejected examples and scope goldens.

### WP-4.3 - Devices and directives

- Goal: cover all structural device/directive chapters in the chosen baseline.
- Main modules: dialect statement projections and IR mapping.
- Required specs: compatibility matrix.
- Validation surface: one or more minimized fixtures per syntax production.

### WP-4.4 - Round-trip and robustness

- Goal: demonstrate no silent loss across valid, unknown, and partially invalid
  sources.
- Main modules: lossless printer, diagnostics, fuzz harness.
- Required specs: lossless preservation rules.
- Validation surface: byte/semantic round-trip, property tests, corpus runs.

## Deliverables

- accepted baseline ADR and compatibility matrix;
- expanded lossless frontend and elaborator;
- complete baseline Circuit IR mapping;
- lossless printer;
- minimized official syntax corpus;
- fuzz/property harness and compatibility report.

## Acceptance scenarios

```text
Import a valid baseline netlist using nested subcircuits, parameters, models,
global nodes, behavioral sources, and control blocks
→ extract structural connectivity
→ preserve non-schematic statements
→ print without silent loss
```

```text
Import a vendor extension not understood by the selected dialect
→ retain the original statement and source span
→ continue importing recognized circuit structure
→ report a compatibility diagnostic
```

## Deterministic validation

- syntax-production coverage matrix;
- parse/print round-trip corpus;
- expression and parameter-scope goldens;
- device-terminal mapping goldens;
- fuzz/property tests for termination and preservation;
- no-silent-loss assertion for every logical source statement.

## Risks and decisions

| Risk or decision | Handling |
|---|---|
| “Full SPICE” has no single grammar | Pin an explicit SPICE3/ngspice baseline and expose dialect identity |
| Parser work blocks product progress | Keep Phase 4 parallelizable with Phase 5 after Phase 2 |
| Control language becomes a simulator project | Preserve structurally; do not execute |
| Corpus licensing is unclear | Use minimized original fixtures derived from documented grammar |

## Exit gate

- The accepted compatibility matrix is fully represented by deterministic
  tests;
- the corpus round-trips without silent loss;
- structural Circuit IR is correct for every baseline device family;
- unsupported extensions remain recoverable and diagnostic rather than fatal.
