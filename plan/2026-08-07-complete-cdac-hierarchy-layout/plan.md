# Complete CDAC Hierarchy Layout

## Goal

Complete the Razavi-style CDAC example by laying out the imported
`scdac_unit` Document and remove the visible RESET label/wire overlap in the
already accepted top-level drawing.

## Dirty-State Decision

The worktree is dirty from the ongoing editor, symbol, Agent-layout, and
generated-example targets. This target continues the untracked CDAC recipe and
artifacts and may extend the untracked Agent-layout runner needed to apply
edits to more than one imported Document. Existing tracked editor, symbol,
golden-fixture, documentation, and unrelated plan changes remain user-owned or
owned by earlier targets and will not be edited. `plan/log.md` is shared and
will receive only this target's factual close-out entry.

## Owner and Scope

- Owner: Codex, for the current CDAC hierarchy/layout request.
- Owned paths:
  - `tools/agent-layout/generate.mjs`
  - `tools/agent-layout/README.md`
  - `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-layout.mjs`
  - `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac.*`
  - `plan/2026-08-07-complete-cdac-hierarchy-layout/plan.md`
  - this target's appended entry in `plan/log.md`
- Read-only paths:
  - `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
  - `apps/`, `packages/`, other `netlists/`, other plans and documentation

## Shared Dependencies

- Imported Project/Document hierarchy and pin-order contracts.
- Agent transaction limits, typed edits, revision checks, and formal exporters.
- Built-in NMOS/PMOS symbol pin names.

## Expected Work

1. Generalize the layout runner so one recipe can apply independent phased
   edits to multiple imported Documents while retaining one top-level export.
2. Add a transistor-level `scdac_unit` layout with ports, complementary
   inverter/control stage, transmission switch, rails, routes, and labels.
3. Move the top-level RESET port/label and its route into a clear right-side
   channel without disturbing the main capacitor array.
4. Regenerate the editable Project plus SVG, PNG, and PDF artifacts and inspect
   both Documents visually.

## Correction After Visual Review

The first hierarchical draft preserved net membership but not clear schematic
semantics: rotating the upper PMOS devices by 180 degrees moved their gates to
the right, control routes crossed symbol bodies, and bulk ties became long rail
branches. The corrected layout uses rotation 180 plus x-mirroring for each
upper PMOS, renders both stages as conventional stacked CMOS inverters, ties
each bulk locally to its source, and uses one output spine per inverter. The
top-level reset NMOS follows the same local bulk-to-source rule instead of a
far-right VSS loop.

## Validation

- Build the package dependencies required by the runner if necessary.
- Run the CDAC recipe successfully and confirm both Documents have no unplaced
  instances and no remaining generic MOS symbols.
- Inspect the exported top-level PNG and a rendered `scdac_unit` view.
- Confirm the generated Project validates through the existing model and Agent
  transaction boundaries.
- Run `git diff --check` and `git status --short --branch`.

## Commit Intent

Keep the result in the current ongoing working set unless the user explicitly
asks to commit or the surrounding target is ready to close as one coherent
change.
