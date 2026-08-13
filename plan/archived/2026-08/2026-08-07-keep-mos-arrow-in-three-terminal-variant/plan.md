---
status: completed
experience: none
---

# Keep MOS Arrow in Three-Terminal Variant

## Goal

Correct the textbook three-terminal visual variant so hiding the electrical
bulk lead does not also hide the NMOS/PMOS direction arrow, then regenerate the
flattened CDAC drawing without changing its SPICE connectivity.

## Dirty-State Note

The worktree contains the ongoing symbol-grid, editor, Agent API, hierarchy,
and CDAC targets. `packages/symbols/src/builtins.ts` and its test already contain
intentional uncommitted connection-grid work from the symbol target. This fix
preserves those changes and claims only the MOS primitive-part classification,
its focused regression assertion, the flattened CDAC regeneration, this plan,
and this target's factual log update. Other dirty paths remain untouched.

## Owned Files

- focused MOS definitions in `packages/symbols/src/builtins.ts`
- focused MOS assertions in `packages/symbols/src/builtins.test.ts`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac-flat.*`
- this plan and this target's `plan/log.md` entry

## Read-Only Files

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/circuit.spi`
- the flattened layout recipe and all unrelated dirty paths

## Shared Dependencies

- Symbol variants hide presentation primitives without removing electrical
  pins.
- The four-terminal default MOS and dedicated `nmos3`/`pmos3` symbols must not
  gain duplicate arrows.

## Expected Work

1. Classify the MOS arrow separately from the hideable bulk lead.
2. Keep the arrow visible in `textbook-3terminal`, while the `B` pin and lead
   remain hidden and electrically addressable.
3. Prevent the dedicated three-terminal symbol constructors from inheriting a
   duplicate arrow.
4. Regenerate and visually inspect the flattened CDAC output.

## User Style Clarification

The retained arrow must not float at the channel center. In the textbook
three-terminal presentation it sits directly on the source-side horizontal
branch: a top PMOS appears with a left-pointing arrow, while a bottom NMOS
appears with a right-pointing arrow. The regenerated CDAC must be checked
against this placement and direction, not merely for arrow presence.

## Validation

- Run focused symbol tests and build the symbol/render/export dependencies.
- Regenerate the flattened CDAC through import, transactions, validation, and
  export.
- Confirm the three-terminal variant has a visible arrow, hidden `B` pin, and
  unchanged bulk-Net terminal mappings.
- Confirm arrow vertices lie on the source branch and the rendered PMOS/NMOS
  pair points left/right respectively.
- Run visual diagnostics, `git diff --check`, and final status review.

## Commit Intent

Keep the correction uncommitted with the current user-reviewed prototype.
