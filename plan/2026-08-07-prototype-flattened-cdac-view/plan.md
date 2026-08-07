# Prototype Flattened CDAC View

## Goal

Generate an alternate CDAC presentation that expands all six `scdac_unit`
instances into their 24 transistor instances on the top-level canvas, while
leaving `circuit.spi` unchanged and retaining the imported hierarchical source
Documents in the editable Project.

## Dirty-State Note

The worktree contains the ongoing editor, symbol, hierarchy-port, Agent-layout,
and CDAC changes. This target owns only a new flattened CDAC recipe and its new
generated artifacts, plus the minimum runner/reporting adjustments if required.
Existing hierarchical CDAC artifacts remain read-only comparison inputs.
During validation, unrelated Phase 9 snapshot/API documentation and package
changes appeared in the shared worktree; they remain outside this target and
were not edited or staged here.

## Owned Files

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-flat-layout.mjs`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac-flat.*`
- this plan and this target's appended `plan/log.md` entry

## Read-Only Files

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-layout.mjs`
- existing hierarchical CDAC outputs
- product packages, editor, docs, fixtures, and unrelated plans

## Shared Dependencies

- SPICE positional hierarchy binding and formal port names.
- Current Project/Document schema and built-in NMOS/PMOS symbols.
- Agent-layout typed transaction and formal export pipeline.

## Expected Work

1. Clone the imported hierarchical top Document as a retained source view, then
   convert the selected top Document into a source-derived flattened
   presentation with prefixed child instance IDs and parent Net identities.
2. Lay out six repeated two-inverter driver cells directly beneath the binary
   capacitor array, with shared VOUT/VDD/VSS rails and a separate reset branch.
3. Generate a distinct editable Project and SVG/PNG/PDF set without modifying
   the accepted hierarchical version.
4. Verify every expanded MOS terminal maps to the same parent Net implied by
   the original XU positional binding.

## Visual-Rejection Correction

The first flattened draft was rejected during user review because the repeated
cells were mechanically compressed into the former hierarchy-block pitch.
Deterministic visual diagnostics confirmed six blocking
`VISUAL_AMBIGUOUS_JUNCTION` errors: every capacitor bottom-plate spine passed
through the VDD junction of its second-stage PMOS. This target therefore owns a
full coordinate/routing revision, not a label-only cleanup. Each bit cell will
receive separate input, inter-stage, output, and capacitor-routing channels;
capacitor branches may cross the VDD rail only without a junction. The revised
artifact is not acceptable until blocking visual diagnostics are zero and the
PNG has been inspected again.

## Validation

- Run the flattened recipe through SPICE import, typed dry-run/commit, Project
  validation, and formal export.
- Confirm the flattened top has 32 instances, including 24 prefixed unit MOS,
  no XU hierarchy block instances, no generic symbols, and no unplaced devices.
- Compare flattened connectivity against the original hierarchy expansion.
- Visually inspect the flattened PNG.
- Require zero blocking visual-quality diagnostics, including ambiguous
  junctions and label/device collisions.
- Confirm `circuit.spi` and hierarchical recipe/artifacts have no target diff.
- Run Prettier, `git diff --check`, and `git status --short --branch`.

## Commit Intent

Keep the prototype uncommitted for visual comparison and user review.
