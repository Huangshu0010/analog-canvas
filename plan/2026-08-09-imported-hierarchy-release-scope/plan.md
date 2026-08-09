# Imported hierarchy release scope

## Goal

Make the release UI accurately represent the only hierarchy capability that is
complete today: browse SPICE-imported `.subckt` documents. Do not imply that
users can author Cells, extract a Cell from a selection, define a reusable
symbol interface, or place a manually-created hierarchical instance.

## Dirty-state decision

At target start, `packages/derived/src/drafting-geometry.ts` and
`packages/model/src/drafting-geometry-schema.ts` are modified by another
drafting-geometry target. They are shared contracts but this target neither
reads nor modifies their behavior. Untracked Razavi evidence, generated
netlist artifacts, and other target plans are also unrelated.

During implementation, the user confirmed that a concurrently completed,
uncommitted drafting/selection target may remain in the worktree. It touches
`App.tsx`, editor tests, styles, model, edit-engine, derived, renderer, and
`plan/log.md`. This target may now make its narrowly scoped hierarchy edits in
`App.tsx` and its own tests, but must stage only its own hunks and must not
modify or log the other target's work. Validation runs against the combined
worktree and any unrelated failure is recorded rather than repaired here.

## Ownership

Owned paths:

- `apps/editor/src/App.tsx`
- `apps/editor/src/App.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/spice/src/importer.ts`
- `packages/spice/src/baseline.test.ts`
- `plan/2026-08-09-imported-hierarchy-release-scope/plan.md`
- `plan/log.md`

Read-only dependencies:

- `packages/model/` Project and Instance schemas
- `packages/spice/src/ir.ts` Circuit IR contract
- editor selection, document history, and style system

## Implementation

1. During import, resolve every known subcircuit instance to a stable target
   Document ID and store it as `spice.childDocumentId`. Retain `spice.target`
   for source fidelity and support its name-based resolution only for legacy
   projects without the stable property.
2. Show document navigation only when the Project has at least one resolvable
   imported child relationship. Name the control `Cells`; use `Up`, `Top`, and
   `Enter Cell` for navigation, rather than presenting `Main` as a complete
   authoring hierarchy.
3. Preserve direct document selection for imported projects. Do not show any
   hierarchy controls in a one-document/manual Project.
4. Allow double-click to enter only a resolvable hierarchical instance, so a
   normal component double-click does not produce a misleading failure status.
5. Cover stable import binding, the single-document release UI, and the
   imported navigation flow. Do not add model migration, Cell creation,
   interface editing, extraction, or new API endpoints.

## Validation

- Focused SPICE importer tests and editor unit tests.
- Focused Playwright imported-SPICE workflow.
- `pnpm --filter @icm/editor build`.
- `pnpm --filter @icm/spice typecheck` and `pnpm --filter @icm/editor typecheck`
  where supported by workspace scripts.
- `pnpm prettier --check` for changed files, `git diff --check`, and final
  `git status --short --branch`.

## Commit intent

One release-scoped commit:

```text
fix(editor): scope hierarchy UI to imported cells
```
