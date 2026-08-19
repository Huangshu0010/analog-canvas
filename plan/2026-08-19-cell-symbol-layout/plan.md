---
status: completed
experience: none
---

# Cell symbol layout and hierarchy editing

## Goal

Make child-Cell editing behave like ordinary schematic editing, align parent
hierarchy-pin typography with child Port labels, and add direct,
definition-level Cell Symbol Layout editing for pin placement and body size.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

The untracked `.worktrees/` directory is user-owned and unrelated. This target
owns hierarchy presentation, structural deletion, current schema migration,
editor interaction, focused documentation, tests, and plan/log/audit records.

- `packages/model/`, `packages/project-protocol/`, `packages/edit-engine/`
- `packages/symbols/`, `packages/render-svg/`, `apps/editor/`
- focused `docs/`, tests, and `plan/` records

Read-only shared dependencies include standard selection/deletion planning,
Project transaction atomicity, Route-follow behavior, and the current Razavi
RichText renderer. Their contracts must be reused rather than duplicated.

## Work

1. Replace formal-Port mixed-selection deletion blocking with one structural
   reconciliation path that preserves protected caller-referenced Ports while
   allowing ordinary Cell content deletion.
2. Use the same semantic instance-label RichText conversion for hierarchy pins
   and child formal-Port annotations; reject empty formal-Port labels.
3. Keep the Project protocol at schema 13 for definition-level body and pin
   placement intent, with deterministic automatic pin-name layout.
4. Add compact Cell Symbol Layout controls in Properties: body resize, pin
   side/offset, automatic placement, caller Route follow, and structural
   undo/redo.
5. Update hierarchy documentation and focused unit/browser coverage.
6. Follow-up: correct north/south text-baseline placement; compact each pin's
   Properties controls to one row; remove the redundant tangential label
   parameter; and provide an opt-in canvas drag mode whose grips commit the
   same definition-level planners.
7. Follow-up: remove manual pin-name placement entirely, restore the protocol
   to schema 13 because schema 14 carried only that now-rejected intent, and
   give enabled canvas grips priority over the selected Instance hit target.

## Validation

- focused model/protocol/edit-engine/symbol/render tests
- focused editor hierarchy and Cell Symbol Layout Playwright coverage
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `pnpm verify:branch` or `pnpm ci:check` as justified by the final surface
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: mixed Cell selection deletion preserves caller-referenced Ports;
  formal names render identically inside and outside a Cell; layout intent is
  stable across save/reopen, caller instances, Route follow, and undo/redo.
- Primary checks: model/protocol migration and schema tests, hierarchy planner
  tests, render tests, document-controller tests, and hierarchy browser tests.

## Commit Intent

Commit as:

```text
feat(hierarchy): add direct Cell symbol layout
```

## Outcome

Initial implementation and layout interaction refinement completed on
`codex/cell-symbol-layout`.

- Replaced the UI-only formal-Port deletion gate with one shared visual-delete
  proposal and an atomic multi-Port structural planner. Caller-wired Ports are
  retained while all safe selected objects remain deletable.
- Kept schema-13 definition-level body and pin-placement intent, with
  deterministic automatic pin-name layout and route-follow reuse.
- Parent Cell symbols now render pin names through the same semantic
  `instance-label` RichText path as child Port annotations; empty formal names
  are rejected instead of deleting the annotation.
- Added compact Properties controls for a selected hierarchy instance: body
  width/height and pin side/offset.
- Compacted every pin to one Properties row and kept its name automatic.
- Added an opt-in canvas layout mode with body and pin grips. Enabled grips
  take priority over the selected instance hit target, while normal canvas
  selection and wiring remain unchanged when the mode is disabled.
- Updated current fixtures and compatibility/hierarchy documentation.

## Validation Record

- `pnpm typecheck`
- focused model/protocol/edit-engine/symbol/render/document Vitest: 40 passed
- `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts`: 6 passed
- `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts apps/editor/e2e/project-file.spec.ts`: 14 passed
- `pnpm build`
- static checks from `pnpm verify:branch` (format, docs, references, catalog,
  distribution, typecheck)
- `node scripts/editor-production-smoke.mjs --check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- follow-up: `pnpm typecheck`; focused model/protocol/symbol/render/document
  Vitest: 94 passed; hierarchy/project-file Playwright: 14 passed; hierarchy
  Playwright with direct body/pin grip coverage: 6 passed; `pnpm build`;
  `pnpm test:impact -- --base origin/main`; and `git diff --check`.
- Follow-up commit: `refine(hierarchy): prioritize Cell pin editing`.
