---
status: active
experience: none
---

# Editor UI declutter and variable-device fixes

## Goal

Work through a batch of user-reported editor UX defects from a live review
session, delivered together because they share one ownership boundary (the
editor shell + component palette) and one validation surface:

1. Library palette calls the power rail "VDD"; it should read "Power Rail"
   (ADR 0036 already made VDD/AVDD/DVDD ordinary named Nets, so the item is
   a generic rail whose Net name is editable).
2. The Library's "Recent" fold is unnecessary; remove it.
3. The Insert dialog's Component field re-echoes the selected item's name as
   its placeholder. The list already highlights the selection, so the echo is
   redundant.
4. A floating startup banner ("Recent unsaved work … safety copy") covers the
   canvas on every load; it should not exist.
5. The Draw menu should be a horizontal toolbar of the basic tools instead of
   a dropdown, and the left rail's Arrow / Line / Rect belong in that toolbar
   rather than the rail.
6. The Inverter and NOR gate bodies spike into their negation bubbles.
7. Placing a Variable Resistor does not behave like a device: it creates a
   child Cell Document named "Variable Resistor" and takes reference X1.
8. Add variable capacitor and variable inductor on the variable-resistor
   pattern (diagonal adjustment arrow).
9. Inserting a Port opens a "Place Net Port" modal; placement should happen
   immediately with sensible defaults and be renameable on the canvas.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? node_modules
```

Clean apart from untracked local build scaffolding (`node_modules` symlinks
and per-package `dist/`), which this target creates deliberately because pnpm
is not installed on this machine. Branch `claude/editor-ui-declutter` from
`main` at d8a813a8 + PR #145 + PR #149.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/editor-shell/**`
- `apps/editor/src/features/component-insert/**`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/**` (specs covering the changed flows)
- `packages/symbols/assets/razavi-v1/**` and the generated Razavi catalog
- `packages/devices/src/descriptors/**`
- `fixtures/visual-golden/**`, `fixtures/exports/**` if regeneration follows
- `plan/2026-08-21-editor-ui-declutter/plan.md`, `plan/log.md`

Shared contracts touched: the Razavi visual authority manifest (ADR 0011),
device descriptors and reference-designator policy, and the generated
catalogs consumed by the Agent kit and MCP resources. Each generated artifact
has a paired `:check` drift gate that must be regenerated in the documented
order rather than hand-edited.

## Work

Grouped into reviewable commits:

1. Palette and dialog declutter (items 1–4).
2. Draw toolbar (item 5).
3. Negation-bubble geometry (item 6).
4. Variable-device placement fix and new variable capacitor/inductor
   (items 7–8), pending the recorded rationale for `targetPolicy:
   "child-cell"`.
5. Immediate port placement (item 9).

## Validation

- `git diff --check`, `git status --short --branch`
- focused Vitest files for each changed module (shapes panel, insert dialog,
  symbol catalog, devices registry, render-svg)
- affected Playwright specs (`component-insert`, `manual-editor`,
  `hierarchy`, `editor-interaction`) run locally with the workaround dev
  server
- generated-artifact drift checks for any regenerated catalog or golden
- live verification of every changed interaction in the running editor

## Gate Review

- Decision: full — this crosses the editor shell, symbol assets, generated
  catalogs, and device contracts.
- Early gates: prettier, focused unit tests, golden/catalog drift checks.
- Affected gates: the Playwright specs owning the changed flows.
- Final gates: `pnpm install --frozen-lockfile && pnpm ci:check` cannot run
  locally (pnpm absent); delivery relies on the remote GitHub Actions
  required checks on the PR.
- Platform risks: generated catalogs and goldens must be regenerated in the
  documented order or their drift gates fail in CI.

## Test Impact

- Decision: tests-updated
- Contracts: Library palette composition and labels; Insert dialog picker
  presentation; startup recovery presentation; drawing-tool affordances;
  negation-bubble symbol geometry; variable-device placement policy and
  reference prefix; port placement defaults.
- Primary checks: the focused Vitest files and Playwright specs listed above.

## Commit Intent

Multiple conventional commits on `claude/editor-ui-declutter`, one per group
above, delivered as a single PR.

## Outcome

Pending.
