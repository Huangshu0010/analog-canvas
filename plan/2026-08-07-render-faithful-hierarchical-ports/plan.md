---
status: completed
experience: candidate
---

# Render Faithful Hierarchical Ports

## Goal

Preserve the SPICE netlist as the sole hierarchy/interface truth while
rendering bound subcircuit instances with their formal `.subckt` port names,
using those names as electrical terminal identities, and regenerating the CDAC
example without generic `P1..Pn` hierarchy pins.

## Dirty-State Note

Start state from `git status --short --branch` is dirty from the ongoing manual
wire, symbol-fidelity, Agent-architecture, and CDAC targets. Existing changes in
`apps/editor/src/App.tsx`, `packages/symbols/src/schema.ts`, symbol builtins,
goldens, docs, and plans are preserved. This target claims only focused resolver
construction changes in `App.tsx`; it does not alter existing wire-editing
logic. It does not edit the dirty builtins or symbol schema. The untracked CDAC
recipe/artifacts and Agent-layout runner continue as owned inputs of the current
CDAC work.

## Owned Files

- `packages/spice/src/importer.ts`
- focused hierarchy tests under `packages/spice/src/`
- `fixtures/spice/current-corpus-summary.json`
- `packages/symbols/src/hierarchical-block.ts`
- `packages/symbols/src/resolver.ts`
- `packages/symbols/src/resolver.test.ts`
- `packages/symbols/src/index.ts`
- `packages/render-svg/src/render.ts`
- focused render tests under `packages/render-svg/src/`
- `fixtures/visual-golden/phase-3-crossing.svg`
- focused resolver construction lines in `apps/editor/src/App.tsx`
- hierarchy import assertion in `apps/editor/e2e/manual-editor.spec.ts`
- `tools/agent-layout/generate.mjs`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-layout.mjs`
- regenerated `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac*`
- this plan and this target's appended `plan/log.md` entry

## Read-Only Files

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
- unrelated editor behavior and E2E tests
- `packages/symbols/src/builtins.ts`
- `packages/symbols/src/schema.ts`
- other netlists, generated examples, docs, plans, and goldens

## Shared Dependencies

- Lossless SPICE positional binding and `.subckt` interface order.
- Project/Document persistence without derived symbol duplication.
- SymbolResolver used by editing, endpoint resolution, Agent transactions, and
  formal export.
- Symbol pin-name rendering in both editor and exported SVG.

## Expected Work

1. Import bound subcircuit terminals under their formal port names and assign a
   stable hierarchy-specific symbol ID without changing the source netlist.
2. Derive hierarchy symbols transiently from Project Documents and compose them
   with built-in symbol resolution.
3. Render visible symbol pin names and make editor/Agent/export callers use the
   project-aware resolver.
4. Update the CDAC recipe from generic `P1..P5` endpoint names to the formal
   `bit/nbit/bot/vss/vdd` interface and regenerate both drawings.
5. Add deterministic tests for ordering, endpoint identity, symbol resolution,
   and formal pin-name rendering.

## Validation

- Focused `@icm/spice`, `@icm/symbols`, `@icm/render-svg`, derived endpoint, and
  editor type checks/tests affected by the shared resolver contract.
- Build required packages and run the CDAC Agent recipe through import,
  dry-run/commit, model validation, and formal export.
- Inspect main and child PNGs and verify no hierarchy instance uses
  `generic-block-*` or `P1..Pn` terminals.
- Confirm `circuit.spi` has no diff.
- Run Prettier, `git diff --check`, and `git status --short --branch`.

These checks cover the shared hierarchy/symbol/endpoint/rendering boundary;
unrelated product suites remain out of scope unless a focused failure indicates
broader coupling.

## Experience Signal (for human review)

The CDAC review exposed that preserving formal port names only in instance
properties is insufficient: electrical endpoint identity, symbol derivation,
and rendering must all consume the same hierarchy contract.

## Commit Intent

Keep this work in the current uncommitted development set unless the user asks
to commit the combined targets.
