# MOS Terminal Presentation Control

## Goal

Expose the already-preserved canonical four-terminal MOS view in the editor:
when an NMOS/PMOS is selected, let the user switch between the Razavi
three-terminal textbook presentation and a four-terminal Bulk-visible view.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 2]
M apps/editor/e2e/drafting.spec.ts
M apps/editor/src/App.tsx
M apps/editor/src/styles.css
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? probe-conflicts.mjs
```

The existing App and CSS edits are owned by another worker. This target will
stage only its own App hunks plus focused tests and plan/log updates.

## Owned Files

- selected hunks in `apps/editor/src/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/src/App.test.tsx` if useful
- `plan/2026-08-08-mos-terminal-presentation-control/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- Razavi generated asset geometry
- other workers' editor and CSS modifications

## Shared Dependencies

- `set_instance_symbol` edit transaction
- canonical MOS D/G/S/B and `textbook-3terminal` visual variant
- visible endpoint derivation

## Expected Work

1. Add a selected-MOS presentation control in the inspector.
2. Persist the choice through one typed, undoable `set_instance_symbol` edit.
3. Verify switching makes the B endpoint appear/disappear without altering
   symbol ID or electrical terminals.

## Validation

- focused browser editor E2E and editor build
- `git diff --check` and `git status --short --branch`

## Commit Intent

```text
feat(editor): expose MOS three and four terminal views
```

## Result

Completed. A selected canonical NMOS or PMOS now exposes two inspector actions:
`Textbook 3-terminal` and `Show Bulk (4-terminal)`. The latter removes only
the presentation variant so the base Razavi four-terminal symbol and B pin
become visible; the former restores the textbook visual variant. Both use one
typed `set_instance_symbol` transaction and are undoable.

Validation passed:

- `corepack pnpm --filter @icm/editor build`
- `corepack pnpm exec playwright test apps/editor/e2e/manual-editor.spec.ts --grep "switches a selected MOS"`
- `git diff --check`
