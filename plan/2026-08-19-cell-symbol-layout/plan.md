---
status: completed
experience: none
---

# Cell symbol layout and hierarchy editing

## Goal

Make child-Cell editing behave like ordinary schematic editing, align parent
hierarchy-pin typography with child Port labels, and add direct,
definition-level Cell Symbol Layout editing for pin placement, pin-label
placement, and body size.

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
3. Advance the Project protocol for definition-level pin-label placement,
   migrate schema-13 Projects deterministically, and extend validation,
   symbols, rendering, and Agent parity.
4. Add compact Cell Symbol Layout controls in Properties: body resize, pin
   side/offset, pin-label inward offsets, automatic placement, caller
   Route follow, and structural undo/redo.
5. Update hierarchy documentation and focused unit/browser coverage.
6. Follow-up: correct north/south text-baseline placement; compact each pin's
   Properties controls to one row; remove the redundant tangential label
   parameter; and provide an opt-in canvas drag mode whose grips commit the
   same definition-level planners.

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
- Added schema-14 optional definition-level pin-label placement, deterministic
  v13 migration, validation, geometry derivation, cleanup on Port deletion,
  and route-follow reuse.
- Parent Cell symbols now render pin names through the same semantic
  `instance-label` RichText path as child Port annotations; empty formal names
  are rejected instead of deleting the annotation.
- Added compact Properties controls for a selected hierarchy instance: body
  width/height, pin side/offset, and pin-name inward offsets.
- Corrected the manual pin-label baseline so top/bottom names align with their
  automatic counterparts, removed the redundant tangential name parameter, and
  compacted every pin to one Properties row.
- Added an opt-in canvas layout mode with body, pin, and label grips. The grips
  use the same definition-level planners and preserve normal canvas selection
  and wiring while disabled.
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
- follow-up: `pnpm typecheck`; focused Vitest: 39 passed; hierarchy Playwright:
  6 passed
