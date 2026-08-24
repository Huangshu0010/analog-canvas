# 0004 - Adopt the ngspice 46 Core Structural Baseline

Status: `accepted`

Date: `2026-08-07`

Owners: `packages/spice`, `fixtures/spice-baseline`

## Context

“Full SPICE” is not one grammar. Berkeley SPICE3, ngspice, XSPICE,
Verilog-A/OSDI, CIDER, and vendor compatibility modes expose different syntax
and execution semantics. Claiming unqualified full support would make parser
coverage unverifiable and would invite the schematic importer to guess at
unknown connectivity.

The official [ngspice documentation page](https://ngspice.sourceforge.io/docs.html)
identifies version 46 as the current stable release. The
[ngspice 46 user manual](https://ngspice.sourceforge.io/docs/ngspice-46-manual.pdf)
provides the device-letter table, dot-command list, numeric suffixes,
subcircuits, parameters, conditionals, library sections, analyses, and control
language used by this decision.

## Decision

The Phase 4 compatibility identity is `ngspice-46-core`. It means structural,
lossless import of the conventional circuit-netlist surface described by
ngspice 46:

- typed connectivity for B through Z conventional device families where node
  boundaries are defined by the core grammar;
- typed structural preservation for mutual inductors;
- typed dot commands, parameters, functions, conditionals, `.include`,
  `.lib` section selection, models, subcircuits, and control boundaries;
- exact decoded-source printing and source spans;
- deterministic recognition of official numeric scale suffixes;
- explicit dialect override or evidence-based detection;
- conservative conditional evaluation for numeric parameter expressions;
- recoverable opaque statements plus compatibility diagnostics for unknown or
  excluded syntax.

The `spice3f5-core` identity is emitted when no ngspice-specific evidence is
present. It is a compatibility classification, not a second parser.

The following remain outside the Phase 4 typed-connectivity baseline:

- XSPICE A devices and XSPICE-specific U syntax;
- N Verilog-A/OSDI compact-device instance semantics;
- CIDER device semantics;
- execution of analyses or `.control` commands;
- vendor compatibility translation and automatic repair.

These forms remain exact and recoverable. Their presence does not corrupt
recognized circuit structure.

## Alternatives considered

### Claim all syntax accepted because unknown lines are preserved

- Benefit: broad marketing label.
- Cost: preservation would be confused with understood connectivity.
- Reason not selected: the product must expose honest compatibility evidence.

### Embed ngspice as the parser

- Benefit: simulator-identical preprocessing.
- Cost: native runtime dependency, simulator execution surface, licensing and
  browser packaging complexity, and a second model boundary.
- Reason not selected: the product needs a lightweight TypeScript structural
  frontend, not a simulator runtime.

### Keep only the Phase 2 fixture profile

- Benefit: minimal implementation.
- Cost: common JFET, MESFET, transmission-line, behavioral, conditional,
  library, analysis, and control syntax would remain unclassified.
- Reason not selected: it does not meet the requested SPICE expansion.

## Consequences

### Positive

- Compatibility is named, versioned, and machine-testable.
- Unknown vendor text is never silently discarded.
- The editor gains broad structural connectivity without executing untrusted
  simulator or control code.

### Negative or limiting

- Some syntactically valid ngspice extensions remain opaque.
- Conditional expressions outside the deterministic numeric subset are
  preserved but not elaborated into guessed connectivity.
- Future dialects require new matrix entries and adapters, not a silent change
  to `ngspice-46-core`.

## Compatibility and migration

Phase 2's `spice-current-profile` Project source label migrates at re-import to
either `spice3f5-core` or `ngspice-46-core`. Project schema remains unchanged;
the dialect field is already an open string.

## Validation

- machine-readable device and dot-command matrix;
- exact source parse/print tests;
- every conventional device-letter projection in one minimized fixture;
- `.lib` section, conditional, control, and vendor-extension tests;
- deterministic fuzz termination and preservation tests;
- all pre-existing current-corpus connectivity tests.

## Related documents

- [`spice-frontend.md`](../specs/spice-frontend.md)
- [`circuit-ir.md`](../specs/circuit-ir.md)
