---
status: completed
experience: none
---

# Local-Power Textbook CDAC Layout

## Goal

Redraw the flattened CDAC routing in the supplied Razavi textbook style: two
vertical CMOS stacks per bit, short left-to-right signal paths, local VDD and
ground symbols, and no page-spanning VDD/VSS rails, while preserving the source
SPICE and the accepted flattened connectivity.

## Dirty-State Note

The shared worktree contains ongoing editor, symbol, Agent API, hierarchy,
Phase 9, and CDAC changes. This target owns only the flattened CDAC recipe and
its generated artifacts, this plan, and its factual log entry. It consumes the
current reviewed/migrated MOS variant and built-in `vdd`/`ground` symbols
read-only. All unrelated dirty files remain untouched.

## Owned Files

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-flat-layout.mjs`
- regenerated `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac-flat.*`
- this plan and this target's `plan/log.md` entry

## Read-Only Files

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
- symbol definitions, renderer, editor, review manifest, and visual goldens
- hierarchical CDAC recipe and artifacts
- all unrelated dirty paths

## Shared Dependencies

- Canonical `nmos`/`pmos` with the migrated `textbook-3terminal` presentation.
- Project-native `vdd` and `ground` symbols and their `P`/`0` terminals.
- Parent/child formal-port Net mapping remains the source of electrical truth.

## Expected Work

1. Add presentation-only local VDD/ground instances to each two-inverter cell,
   plus local grounds for the dummy capacitor and reset device, and bind them to
   the existing VDD/VSS Nets.
2. Replace horizontal global supply rails with short local supply branches.
3. Stack PMOS over NMOS in each inverter and route input, inter-stage, output,
   and capacitor connections through reserved local channels.
4. Keep only the shared VOUT capacitor-array rail as a page-spanning trunk.
5. Suppress helper instance IDs and label local VDD symbols in textbook style.

## User Review Correction

The first local-power draft placed the second-stage `nbit` branch 10 units
inside the formal gate terminal, so the external route overlaid the symbol's
own gate lead. Move that branch to the outside of both `XSP.G` and `XSN.G`.
After correcting it, reduce the bit pitch from 340 to 300 units and compact the
vertical power/device bands and reset channel without reducing terminal or
label clearance below the visual diagnostic limits.

## Validation

- Regenerate through SPICE import, typed transactions, Project validation, and
  formal SVG/PNG/PDF export.
- Confirm all 25 MOS instances retain the migrated variant and 25 electrical
  `B` terminals; compare all 96 expanded child terminals with the hierarchy.
- Confirm all local power helpers resolve and bind only to VDD/VSS.
- Require zero blocking visual diagnostics and inspect the PNG.
- Confirm `circuit.spi` has no diff, then run Prettier, `git diff --check`, and
  final status review.

## Commit Intent

Keep the revised visual prototype uncommitted for user review.
