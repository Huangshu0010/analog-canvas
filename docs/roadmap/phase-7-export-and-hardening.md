# Phase 7 - Export and Hardening

Status: `complete`

## Objective

Turn the completed editing and Agent workflows into a robust daily-use product
through production export, recovery, performance, compatibility expansion,
packaging, and release-level validation.

## User-visible outcome

Users can safely work on larger projects, recover from interruptions, export
stable SVG/PNG/PDF artifacts, receive actionable import/edit diagnostics, and
install a versioned application with documented compatibility limits.

## In scope

- production SVG, PNG, and PDF export;
- font, page bounds, scale, and formal-layer determinism;
- atomic save, AppData cache/session/recovery, and crash restoration;
- project migrations and compatibility fixtures;
- large-project indexing, rendering, query, and edit performance;
- diagnostics and import-report UI;
- keyboard/accessibility and error-state review;
- selected HSPICE/PSpice/LTspice/Xyce dialect expansion;
- application packaging, versioning, release checks, and user documentation;
- security review of local Agent transport and file roots.

## Out of scope

- circuit simulation;
- real-time multiplayer collaboration;
- cloud storage as a required dependency;
- arbitrary automatic layout guarantees;
- VSDX unless separately approved with a scoped compatibility target.

## Dependencies

- Phase 4, Phase 5, and Phase 6 exit gates;
- accepted persistence, visual, SPICE, and Agent specifications;
- representative performance and migration fixture sets;
- chosen packaging and deployment ADRs.

## Work packages

### WP-7.1 - Production export

- Goal: generate deterministic SVG and derived PNG/PDF with controlled page,
  fonts, scale, and formal layers.
- Main modules: render-svg, exporters, editor export UI.
- Required specs: visual language and export contract.
- Validation surface: vector inspection and cross-format goldens.

### WP-7.2 - Persistence and recovery

- Goal: finish atomic save, recovery snapshots, session restoration, migration,
  and cleanup behavior.
- Main modules: core storage and application lifecycle.
- Required specs: `persistence-and-recovery.md`.
- Validation surface: forced interruption, corrupt recovery, and migration tests.

### WP-7.3 - Performance and diagnostics

- Goal: establish measured limits for large Documents and provide actionable
  progress/error reporting.
- Main modules: derived indexes, renderer, query, importer, diagnostics UI.
- Required specs: performance budgets and diagnostic taxonomy.
- Validation surface: benchmark fixtures and interaction latency measurements.

### WP-7.4 - Compatibility and release

- Goal: expand selected dialects, package the application, document support,
  and run release/security gates.
- Main modules: dialects, app packaging, Agent transport, documentation.
- Required specs: compatibility matrix and release ADRs.
- Validation surface: dialect corpora, installer smoke tests, security checks.

## Deliverables

- production SVG/PNG/PDF exporters;
- recovery and migration system;
- performance budgets and benchmark corpus;
- diagnostics/reporting UI;
- selected vendor dialect plugins and compatibility reports;
- packaged application and release checklist;
- user, troubleshooting, and supported-format documentation.

## Acceptance scenarios

```text
Edit and save a representative large Project
→ terminate during a later unsaved edit
→ reopen the application
→ offer a valid recovery snapshot
→ restore without corrupting the formal Project file
```

```text
Export an original dense analog fixture
→ SVG, PNG, and PDF share bounds and formal content
→ no overlay or hit target is present
→ text and junctions remain legible at declared output scale
```

## Deterministic validation

- cross-format export goldens and SVG structural inspection;
- atomic-save and crash-recovery fault tests;
- schema migration fixtures across released versions;
- measured import, query, edit, render, and save budgets;
- dialect compatibility corpus reports;
- installer/package smoke tests;
- local API permission and path-root security tests.

## Risks and decisions

| Risk or decision                       | Handling                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| Hardening becomes an unlimited backlog | Define explicit release budgets and supported platforms    |
| Raster/PDF diverge from SVG            | Derive them from the same formal SVG scene                 |
| Recovery overwrites valid user data    | Recovery stays in AppData and requires validated promotion |
| Vendor compatibility is overstated     | Publish versioned compatibility matrices and known gaps    |

## Exit gate

- Release acceptance scenarios pass on supported platforms;
- persistence and recovery cannot corrupt a validated Project in fault tests;
- performance remains within accepted budgets on representative fixtures;
- export and dialect support are documented, versioned, and reproducible;
- a release artifact passes the packaging, security, and smoke-test checklist.

## Completion evidence

- The formal SVG scene now drives checked SVG, 3x PNG, and one-page PDF
  artifacts. A bundled DejaVu Serif family prevents missing labels, text-aware
  bounds prevent clipping, and the rendered PDF golden passed visual review.
- Root-bounded Node storage flushes a same-directory temporary file before
  replacement. Fault injection preserves the previous formal Project;
  traversal, corrupt recovery, explicit promotion, cleanup, and replacement
  behavior are tested.
- The editor downloads and opens canonical Projects, stages separate browser
  recovery, offers explicit restore/discard, and shows import diagnostics in a
  live semantic region.
- A 500-instance benchmark covers validation, serialization, rendering,
  bounded Agent query, Edit Engine transaction, SPICE import, and atomic save;
  all measured operations remain far below the accepted CI budgets.
- Explicit LTspice 24 and Xyce 7 structural profiles have lossless fixtures.
  HSPICE and PSpice remain preservation-only with published limitations.
- ADR 0006 selects a Node 24 loopback host plus installable/offline-capable PWA
  for v0.1. The versioned bundle, manifest, generated icons, service worker,
  security headers, path controls, and health endpoint pass release smoke.
- Frozen install, formatting, references, typecheck, 89 tests in 26 files,
  workspace build, export/PWA/release checks, performance budgets, and eight
  Playwright workflows passed on Windows x64 with Node 24.
