# Unified visual deletion

## Goal

Make Ctrl+A and Delete behave as one coherent visual-deletion operation:
select visible instances, routes, junctions, annotations, and drafting lines/
arrows; delete a route and its now-orphan junctions together; delete a junction
and every route attached to it together. A single delete must not leave a
junction that requires a second Delete.

## Dirty-state decision

This branch contains already-staged terminal-escape routing work in `App.tsx`,
derived, edit-engine, renderer, and log files. It is a separate target. This
target may add narrowly scoped deletion logic to `App.tsx` and a new pure
editor helper/test; it must stage only its own hunks and leave the existing
staged routing changes unchanged.

## Ownership

- `apps/editor/src/App.tsx`
- `apps/editor/src/delete-selection.ts`
- `apps/editor/src/delete-selection.test.ts`
- `plan/2026-08-09-unified-visual-deletion/plan.md`
- separately staged `plan/log.md` completion entry

Read-only: model schema, edit-engine semantics, routing helper, renderer, and
all pre-existing staged files.

## Work

1. Add a pure closure helper which starts from selected routes/junctions,
   includes every route attached to an explicitly deleted junction, then adds
   junction endpoints only when every route using them is being removed.
2. Use that one normalized route/junction set in mixed Delete. Preserve the
   existing direct electrical-connection deletion path only for an isolated
   route with no junction endpoint.
3. Expand Ctrl+A to all currently visible editor object kinds.
4. When Ctrl+A removes every route, clean temporary junctions created by
   connected-instance deletion as part of the same transaction.
5. Cover route→orphan-junction and junction→attached-routes closure with pure
   unit tests.

## Validation

- Focused delete-selection Vitest.
- Editor build and focused formatting check.
- `git diff --check` and staged-diff review.

## Commit intent

```text
fix(editor): delete selected routes with their junctions
```
