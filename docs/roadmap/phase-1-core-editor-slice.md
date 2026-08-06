# Phase 1 - Core Editor Slice

Status: `proposed`

## Objective

Prove the manual GUI-to-Edit-Engine-to-SVG path with a small hand-authored
Document before introducing SPICE import or full routing complexity.

## User-visible outcome

A user can open a built-in fixture, place unplaced devices, select, move,
rotate, undo, redo, save, reopen, and export a textbook-monochrome SVG.

## In scope

- React editor shell and native SVG canvas;
- pan, zoom, selection, hit targets, and grid preview;
- 5–8 minimal hand-authored Symbol DSL definitions;
- `textbook-monochrome-v1` base tokens;
- Unplaced Instances panel;
- Place, Move, Rotate, Mirror, Undo, and Redo;
- Schematic Edit Engine implementations for the included edits;
- deterministic symbol and instance rendering;
- canonical Project save/reopen through the GUI.

## Out of scope

- SPICE import;
- Wire, Junction, crossing, Stretch, and flightlines;
- VSS extraction of the complete symbol set;
- Agent API;
- full annotation and layout-constraint editing;
- PNG/PDF export.

## Dependencies

- Phase 0 exit gate;
- accepted `project-file-format.md`, `schematic-model.md`, `edit-engine.md`,
  minimal `symbol-dsl.md`, and initial `visual-language.md`;
- one hand-authored Project fixture.

## Work packages

### WP-1.1 - Minimal symbols and renderer

- Goal: render a resistor, capacitor, inductor, NMOS, PMOS, ground, port, and
  generic block from Symbol DSL.
- Main modules: `packages/symbols`, `packages/render-svg`.
- Required specs: `symbol-dsl.md`, `visual-language.md`.
- Validation surface: symbol transform and SVG golden tests.

### WP-1.2 - Canvas and session state

- Goal: implement viewport, selection, hover, grid, and hit testing without
  writing Session State into the Project.
- Main modules: `apps/editor/src/canvas`, `apps/editor/src/session`.
- Required specs: `schematic-model.md` persistence boundary.
- Validation surface: UI interaction tests and saved-file inspection.

### WP-1.3 - Placement edit flow

- Goal: translate GUI gestures into typed place/move/rotate/mirror edits.
- Main modules: GUI tools and `core/edit`.
- Required specs: `edit-engine.md`.
- Validation surface: identical direct-engine and GUI-triggered results.

### WP-1.4 - History and persistence

- Goal: connect undo/redo, revisions, save, reopen, and recovery-safe errors.
- Main modules: `core/history`, `core/storage`, editor project lifecycle.
- Required specs: `persistence-and-recovery.md`.
- Validation surface: history state transitions and save/reopen scenarios.

## Deliverables

- Runnable editor shell;
- minimal built-in Symbol Library;
- manual placement and transform tools;
- first working Schematic Edit Engine edits;
- textbook-monochrome SVG renderer baseline;
- hand-authored Project and SVG golden fixtures;
- focused Playwright interaction tests.

## Acceptance scenarios

```text
Open a fixture with M1, M2, R1 unplaced
→ drag M1 and M2 onto the canvas
→ rotate R1
→ move M1
→ undo and redo
→ save and reopen
→ all placements and revisions remain valid
```

```text
Export the current Document as SVG
→ formal layers contain symbols and labels
→ selection and hit-target overlays are absent
```

## Deterministic validation

- Edit Engine unit tests for each supported edit;
- symbol rotation/mirror property tests;
- Project save/reopen semantic equality;
- SVG golden snapshots;
- Playwright placement, selection, move, undo, and redo tests;
- check that Session State is absent from saved JSON.

## Risks and decisions

| Risk or decision | Handling |
|---|---|
| UI mutates model directly | All committed gestures must produce typed edits |
| Renderer becomes stateful | Renderer remains a deterministic read-only function |
| Early symbols lock poor proportions | Mark initial symbols as provisional and calibrate in Phase 5 |
| React state duplicates Document | Store only session and presentation state outside the model |

## Exit gate

- A complete manual place/move/save/reopen/SVG demonstration passes;
- GUI and direct Edit Engine paths produce identical committed Documents;
- no SPICE, Agent, React, DOM, or SVG implementation detail leaks into the
  persistent model.
