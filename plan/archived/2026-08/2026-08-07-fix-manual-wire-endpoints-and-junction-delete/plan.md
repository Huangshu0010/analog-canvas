# Fix Manual Wire Endpoints and Junction Deletion

## Goal

Make terminal-originated wires leave each symbol in the pin's transformed
cardinal direction, and make an explicitly selected junction removable with
its attached route geometry through both Delete/Backspace and a visible UI
action. Follow up on the reproduced root cause by making every symbol pin
anchor obey the editor's canonical 10-unit electrical connection grid,
including multi-pin devices.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
 M docs/agent/README.md
 M plan/log.md
?? docs/agent/rule-guided-layout-architecture.md
?? netlists/rlc-rf-bandpass-100mhz/razavi-100mhz-bandpass.{icproj.json,pdf,png,svg}
?? netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac.{icproj.json,pdf,png,svg}
?? netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-layout.mjs
?? plan/2026-08-07-record-rule-guided-agent-layout/
?? tools/agent-layout/
```

Those paths belong to a separate Agent-layout/export target. They do not
overlap the editor implementation or E2E test owned here. The existing dirty
`plan/log.md` is shared and will not be edited until close-out; if it remains
owned by the other target, this target will record its outcome in this plan
instead of overwriting or co-mingling that change.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/symbols/src/schema.ts`
- `packages/symbols/src/builtins.ts`
- `packages/symbols/src/builtins.test.ts`
- `docs/specs/symbol-dsl.md`
- deterministic reviewed-symbol/visual golden artifacts produced by the
  repository scripts if their content changes
- `plan/2026-08-07-fix-manual-wire-endpoints-and-junction-delete/plan.md`
- `plan/log.md` only if its pre-existing owner has completed and the diff can
  be extended without conflict

## Read-Only Files

- `packages/model/**`
- `packages/symbols/**`
- `packages/edit-engine/**`
- all pre-existing dirty paths listed above

## Shared Dependencies

- Symbol pin `direction` and instance orientation semantics
- Symbol DSL compatibility and the canonical 10-unit connection grid
- Edit Engine `make_flightline` and `remove_junction` preconditions
- Existing editor pointer/wire tool state and undo history

## Expected Work

1. Reproduce and encode pin-direction routing for rotated and unrotated pins.
2. Route the first wire leg along the source pin axis and approach terminal
   targets along their pin axis.
3. Add explicit junction selection and reversible deletion of the junction
   plus route geometry attached to it.
4. Run focused editor E2E, type checking, and formatting checks.
5. Enforce grid-aligned anchors in the Symbol DSL, align every built-in symbol
   (including MOS/BJT, supply, op-amp, and transformer families), and refresh
   only the deterministic visual baselines affected by those changes.
6. Reproduce the reported copied-MOS endpoint failure with an explicit wire
   bend. Distinguish pointer-event hit testing, Net merge, and zero-length
   route normalization failures; fix the smallest confirmed cause and retain a
   screenshot-equivalent E2E regression.

## Validation

- `pnpm exec prettier --check apps/editor/src/App.tsx apps/editor/src/styles.css apps/editor/e2e/manual-editor.spec.ts`
- `pnpm typecheck`
- focused Playwright tests for pin-direction routing and junction deletion
- focused Symbol DSL/built-in tests proving all multi-pin anchors are on-grid
- reviewed symbol and visual golden checks when generated output changes
- `git diff --check`
- `git status --short --branch`

The change is confined to UI interaction and route proposal construction, so
focused E2E tests cover the regression at the user-visible boundary while the
workspace typecheck protects the shared TypeScript contracts.

## Experience Signal (for human review)


## Outcome

- Terminal wire proposals now use the pin axis after instance rotation for the
  first segment and use the destination pin axis for the final segment.
- Pointer mode can select an explicit Junction. Delete/Backspace and the
  Junction context action remove its attached route geometry and then the
  Junction in one undoable transaction.
- Added an E2E regression covering NMOS drain exit orientation, terminal
  approach orientation, Junction selection/deletion, and single-step undo.
- Added a Symbol DSL 1.4 invariant requiring every electrical pin anchor to
  use the canonical 10-unit connection grid. Aligned all affected built-ins
  and their actual lead artwork: MOS/BJT, ground, VDD/VSS, op-amp, and
  transformer families.
- Added deterministic checks for every built-in pin, explicit rejection of an
  off-grid symbol, every rotation/mirror of multi-port symbols, and an actual
  editor-created route whose complete polyline remains on-grid.
- Reproduced the later copied-MOS connection failure after page reload and
  recovery. The wire preview was valid, but the transient counter restarted at
  zero and reused `net-ui-1`. Routing ID allocation now synchronizes against
  all persisted `net-ui`, `route-ui`, and `junction-ui` IDs (including copied
  IDs) before allocating. The screenshot-equivalent copy, reload, restore,
  manual bend, and endpoint commit flow is covered by E2E.
- Regenerated and visually reviewed the four affected symbol/Phase 1/5 SVG
  goldens. MOS/BJT, supply, op-amp, and transformer geometry remains coherent
  without compensating endpoint doglegs.
- Validation passed: Prettier check, workspace TypeScript check, 108 tests in
  31 files, symbol-review goldens, Phase 1/5 visual goldens, all 14 manual
  editor Playwright tests, and `git diff --check`.
- `plan/log.md` and the worktree contain a still-uncommitted Agent-layout
  target owned outside this change. Per the dirty-state decision, this target
  was not appended to that shared log, staged, committed, or pushed to avoid
  mixing unrelated targets. Its intended code/test/plan paths remain isolated.

## Commit Intent

Commit as:

```text
fix(editor): honor pin exits and delete junctions
```
