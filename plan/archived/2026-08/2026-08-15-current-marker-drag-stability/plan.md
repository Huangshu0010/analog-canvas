---
status: completed
experience: none
---

# Current marker drag stability

## Goal

Keep route-attached current-arrow movement responsive and stable on dense
schematics without changing its existing single-marker semantics: dragging may
slide the arrow and its label together along the attached route, but does not
create an independently movable text object.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This target branches from `origin/main` as
`codex/fix-current-marker-drag-stability`.

Owned paths:

- `apps/editor/src/app/App.tsx`
- focused current-marker coverage in `apps/editor/e2e/manual-editor.spec.ts`
- this plan and the factual close-out entry in `plan/log.md`

Read-only:

- persisted `route-marker` schema and route attachment geometry
- formal SVG marker rendering and rich-text content contract
- generic canvas drag-session and drag-visual helpers

## Work

1. Stop changing the rendered Document during pointer-move preview for a
   route-attached current marker, so a pointer frame cannot rebuild the whole
   formal SVG tree.
2. Reuse the existing imperative drag visual for a lightweight, temporary
   marker translation; restore it before the one typed attachment transaction
   on pointer release.
3. Protect the behavior with a browser regression that verifies a dragged
   marker stays in the same formal SVG node through preview and commits only on
   release.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "drags a current marker"`
- editor TypeScript check and production build
- changed-file formatting
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): avoid full scene redraw during current marker drag
```

## Outcome

The current-marker preview now uses the existing local drag transform and no
longer changes `renderedDocument`, so moving it does not rebuild the formal SVG
scene per pointer frame. Its route attachment still resolves once on release.
The focused browser regression proved that the formal marker node remains in
place through preview, and the editor TypeScript check and production build
passed. No reusable experience signal was identified.
