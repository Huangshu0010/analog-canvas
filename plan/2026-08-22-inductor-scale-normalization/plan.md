---
status: completed
experience: none
---

# Reconcile the Inductor scale with the other passives

## Goal

The Inductor renders 1.5x the size of every other passive (60-unit pin span
against 40), so a schematic mixing R, C, and L reads at two scales. Offer a
scale-reconciled Inductor as the everyday symbol while keeping the calibrated
textbook proportions available.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .claude/
?? node_modules
```

Clean apart from untracked local build scaffolding. Branch
`claude/inductor-scale-normalization` from `main` at d170de7c.

Owned paths:

- `scripts/generate-razavi-inductor-asset.mjs`
- `packages/symbols/assets/razavi-v1/**` (inductor assets, catalog, README)
- `packages/symbols/src/razavi-catalog.ts` and its generated adapter
- `packages/devices/src/descriptors/**`, `packages/derived/src/instance-label-placement.ts`
- `packages/spice/src/importer.ts`
- `apps/editor/src/features/{component-insert,editor-shell}/**`
- affected tests and `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-22-inductor-scale-normalization/plan.md`, `plan/log.md`

Read-only: `fixtures/visual-reference/razavi-reference-v1/**`. The reference
manifest is the sole visual authority (ADR 0011); this target deliberately
leaves every evidence file, measurement, and manifest hash untouched.

## Work

Root cause: the two symbols were calibrated from independent evidence with
independent scale factors and nothing reconciled them. The Inductor comes from
manifest-pinned PDF vector evidence of textbook figure 15-21
(`pinAnchorsLogical` at y = ±30, `logicalUnitsPerPdfPoint` 2.23152); the
Resistor and Capacitor come from `passive-geometry.json` (raster-calibrated,
±20).

Rather than rescale the calibrated Symbol — which would invalidate its
fidelity target, require editing the authority manifest's pinned hash, and
move the pins of existing `inductor` Instances — keep `inductor` exactly as
calibrated and derive a second Symbol from the same evidence:

1. Extend the inductor generator to emit `inductor-compact` beside `inductor`,
   scaling the evidence path by `PASSIVE_PIN_SPAN_LOGICAL / evidencePinSpan`
   (2/3) and recording that factor as `pinSpanScale` in the catalog
   `generation` block.
2. Give `inductor` the display name "Large Inductor" and a manual-only reason;
   move the `spice:L` automatic mapping and the SPICE importer's symbol choice
   to `inductor-compact` so imported schematics read at one scale.
3. Rebuild `variable-inductor` on the compact base with the same adjustment
   arrow its siblings use.
4. Register `inductorCompactDevice` (L prefix, builtin) and wire the palette,
   compact labels, and side-label placement.

## Validation

- `git diff --check`, `git status --short --branch`
- repository typecheck; full Vitest suite; full Playwright suite
- generator, catalog, agent-kit, MCP, visual-golden, references, and
  markdown-link drift checks
- placed R, C, compact L, large L, and variable L together in the running
  editor and measured their rendered bounds

## Gate Review

- Decision: affected — symbol assets, generated catalogs, device contracts,
  and one importer mapping.
- Early gates: generator `--check`, prettier, focused unit tests.
- Affected gates: symbol/device/spice unit tests, component-insert browser
  spec.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: generated catalogs must be regenerated in the documented
  order or their drift gates fail.

## Test Impact

- Decision: tests-updated
- Contracts: reviewed product-symbol list and count; catalog identity;
  SPICE `L` import symbol; device registry prefixes; Library palette
  composition.
- Primary checks: `packages/symbols/src/{builtins,razavi-catalog}.test.ts`,
  `packages/spice/src/compiler.test.ts`,
  `apps/editor/src/features/editor-shell/shapes-panel.test.ts`,
  `apps/editor/e2e/component-insert.spec.ts`

## Commit Intent

```text
feat(symbols): add a scale-reconciled Inductor beside the calibrated one
```

## Outcome

`inductor-compact` ("Inductor") now matches the Resistor and Capacitor at a
40-unit pin span and is the palette default and SPICE import target;
`inductor` ("Large Inductor") keeps the evidence-exact 60-unit geometry, its
fidelity target, and every existing Instance unchanged. `variable-inductor`
was rebuilt on the compact base so all three adjustable passives share one
frame. Measured in the running editor: R, C, compact L, and variable L all
render 40 units tall; large L stays 60.

No evidence file, measurement, or manifest hash was modified. Validation:
typecheck, 174 unit files / 1074 tests, 179 Playwright tests, and every
generated-artifact drift check listed above.
