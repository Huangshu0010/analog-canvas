---
status: completed
experience: candidate
---

# Razavi Existing MOS Presentation Migration

## Goal

When Razavi is applied to a Document, migrate eligible existing canonical
NMOS/PMOS instances to its approved three-terminal visual variant. Keep a
four-terminal view for MOS whose bulk is attached to a non-global/body-bias
net, so the migration never hides meaningful electrical topology.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 4]
M fixtures/visual-golden/phase-1-manual.svg
M fixtures/visual-golden/phase-5-dense-analog.svg
M fixtures/visual-golden/route-attached-current-arrow.svg
M fixtures/visual-golden/text-callout-guide.svg
M fixtures/visual-golden/text-rich-text.svg
M fixtures/visual-golden/text-route-marker.svg
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? probe-conflicts.mjs
```

All listed paths are unrelated user/other-worker work and will not be edited.
The previous Razavi default-palette target is committed as `78abbb4`; this
target only covers existing Document migration.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/App.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-08-razavi-existing-mos-migration/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- Symbol geometry and generated catalog assets
- Other workers' golden files, plans, netlists, and markup/model work

## Shared Dependencies

- `set_presentation_style` and `set_instance_symbol` edit-engine transactions
- Document Net / terminal contract and canonical MOS D/G/S/B semantics
- Razavi `textbook-3terminal` symbol variant

## Expected Work

1. Classify canonical MOS bulk connections as eligible when absent or attached
   to a recognized global supply net.
2. Apply the visual variant in the same undoable transaction as the Razavi
   document style, including when the style is already selected.
3. Add focused unit and browser regression coverage for eligible and
   body-bias cases.

## Validation

- Focused App Vitest and manual editor browser E2E tests.
- Editor production build.
- `git diff --check` and `git status --short --branch`.

## Experience Signal (for human review)

Style selection currently changes only profile tokens while visual variants are
persisted instance state. This target makes the boundary explicit; a human may
choose to extract that architectural lesson later.

## Commit Intent

```text
fix(razavi): migrate eligible existing MOS to textbook view
```

## Result

Completed. Applying Razavi now performs an undoable visual migration in the
same transaction: canonical MOS with no bulk connection, or a bulk on one of
the recognized supply nets (`0`, GND, VSS, VDD, VDDA, VSSA, VGND, VPWR), adopt
`textbook-3terminal`. A MOS connected to another net (for example `Vbody`)
remains four-terminal. Reapplying an already-selected Razavi style still runs
the pending eligible migration.

Validation passed:

- `corepack pnpm vitest run apps/editor/src/App.test.tsx` (5 tests)
- `corepack pnpm --filter @icm/editor build`
- `corepack pnpm exec playwright test apps/editor/e2e/manual-editor.spec.ts --grep "faithful symbol previews|authors components|migrates only eligible"` (3 tests)
- `git diff --check`
