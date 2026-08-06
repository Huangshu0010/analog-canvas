# SPICE Frontend

Status: `accepted`

Version: `1.0-current-corpus`

Owning phase: `Phase 2/4`

Primary owner: `packages/spice`

## Purpose

Define the source-preserving boundary that turns selected SPICE-family files
into typed statements, diagnostics, and transient Circuit IR without making
the parser or filesystem part of the persistent Project model.

## Consumers

- browser and Node source adapters
- SPICE elaborator
- Schematic importer
- current-corpus and later dialect-conformance tests

## SourceBundle contract

A `SourceBundle` has one normalized relative entry path, the reachable source
files, include dependencies, syntax files, and diagnostics. Each source file
retains its original bytes' SHA-256 digest, detected UTF encoding, exact decoded
text, stable file ID, and normalized relative path.

The pure adapter accepts an explicit set of virtual files. The Node adapter may
collect files below the entry directory before invoking the same pure adapter.
The browser editor supplies all user-selected files to the pure adapter. Source
selection is therefore separate from parsing and does not expose a parser API
to the persistent model.

## Lossless and source-location rules

- Exact decoded source text is retained and can be returned byte-for-text,
  including LF/CRLF choice, blank lines, comments, and continuation spelling.
- Every non-comment logical statement retains its exact physical slice,
  physical line numbers, and a half-open offset span with one-based line and
  column positions.
- A leading `+` joins a SPICE continuation to the preceding logical statement.
- Top-level whitespace splitting respects quotes, parentheses, and braces.
- Inline `$` and `;` comments are ignored for typed projection only; source
  text and raw statement text remain unchanged.
- Unrecognized or malformed non-comment statements become opaque statements
  and emit a source-located diagnostic. They are never silently discarded.

## Include policy

Phase 2 supports quoted or unquoted local relative `.include` targets.

- paths are resolved relative to the including file;
- absolute, URL, drive-qualified, and root-escaping paths are denied;
- missing targets and include cycles are errors;
- repeated includes are recorded and suppressed deterministically;
- files not reachable from the entry remain outside the resulting bundle;
- parsing never performs network access.

Library-section selection and configured search paths enter the Phase 4
compatibility matrix; they are not guessed in Phase 2.

## Current compatibility profile

The Phase 2 typed surface is deliberately the syntax present in `netlists/`:

| Form | Phase 2 projection |
|---|---|
| `.include` | dependency request |
| `.subckt` / `.ends` | ordered cell definition |
| `.param` | raw named parameter declarations |
| `.model` | model name, type, and raw parameter tail |
| R/C/L | two terminals and raw value |
| V/I | two terminals and raw source value |
| E/G | four terminals and raw gain |
| F/H | two output terminals, controlling source, and raw gain |
| D | two terminals and model |
| Q | ordered transistor terminals and model |
| S | four terminals and model |
| X | ordered terminals and subcircuit/master name |

M is accepted as a conservative four-terminal/model form because it is a
SPICE baseline primitive, but broader device and directive coverage remains a
Phase 4 gate.

## Elaboration rules

- SPICE identifiers are matched case-insensitively while display spelling and
  source order are retained.
- Cell ports and instance terminals are contiguous and zero-based in source
  order.
- Known X masters bind to subcircuit cells. Unknown X masters remain opaque
  targets with positional pins.
- R/C/L/V/I/E/F/G/H are primitive targets. D/Q/S/M retain model targets when
  a model name is present.
- Net identity is scoped to a cell. `0` and explicit `.global` names are global;
  other names are local.
- Root candidates are defined cells not called by another bound subcircuit.
- Parameters and models retain raw expressions; Phase 2 does not simulate or
  require evaluation.

## Diagnostics

Diagnostics have stable code, severity, message, optional source span, and
optional related spans. Source, syntax, bind, and import stages use distinct
code prefixes. An import may recover with warnings, but an include error,
malformed recognized statement, duplicate definition, or invalid hierarchy
prevents a successful result.

## Persistence boundary

Only the Project source manifest, Document source bindings, instance source
references, raw instance properties, and imported connectivity persist.
Source text, syntax files, Circuit IR, dependencies, and diagnostics remain
transient or test-fixture data.

## Deterministic validation

- exact-text and continuation tests;
- offset/line/column tests;
- missing, cycle, duplicate, and escape include tests;
- per-family typed statement tests;
- opaque-preservation assertions;
- hierarchy, terminal-order, parameter, and model tests;
- schema validation and connectivity goldens for every current netlist.

## Phase 4 extension rule

Phase 4 may add typed statements, expressions, `.lib` sections, control blocks,
and wider ngspice/SPICE3 compatibility. It must preserve Phase 2 source and
opaque behavior and update an explicit compatibility matrix rather than
silently changing token interpretation.
