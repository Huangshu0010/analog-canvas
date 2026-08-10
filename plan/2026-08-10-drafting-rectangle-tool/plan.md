# Drafting rectangle tool

## Goal

Add a non-electrical outline rectangle to the drafting layer, with the same
two-click preview, persistent styling, selection, movement, resizing, rotation,
locking, deletion, and formal export behavior as the existing arrow and
construction-line tools. Use Virtuoso Layout's unmodified `R` rectangle
bindkey when the canvas has no rotatable selection. Preserve the established
schematic interaction where `R` rotates a selected component/drawing;
`Shift+R` rotates in the reverse direction.

## Dirty-state decision

The branch starts ahead four commits with a dirty editor worktree. `App.tsx`,
drafting tests, interaction docs, renderer files, and `plan/log.md` already
contain completed or in-progress editor-chrome, canvas-drag-session, drafting
inspector, and curved-arrow changes. The rectangle target necessarily touches
some shared files. Proceed by adding only kind-specific schema/geometry/render
and narrowly scoped editor branches; preserve all existing hunks and do not
stage or commit the mixed worktree.

## Ownership

Owned additions/hunks:

- `packages/model/src/schema.ts`
- `packages/model/src/drafting-geometry-schema.ts`
- `packages/derived/src/drafting-geometry.ts`
- focused drafting geometry tests
- `packages/render-svg/src/render.ts`
- focused drafting render tests
- rectangle-specific branches in `apps/editor/src/App.tsx`
- focused editor drafting E2E additions if the existing dirty test can be
  extended without replacing neighboring work
- `docs/specs/editor-interaction.md`
- this plan and the factual entry in `plan/log.md`

Read-only shared boundaries:

- edit-engine transaction semantics; reuse `upsert_drafting_object`
- electrical routes, Nets, annotations, and symbol geometry
- existing arrow and construction-line persistence and curve behavior

## Design

- Persist a rectangle as center, positive width/height, arbitrary bearing, and
  line style. It is decorative only and never creates connectivity.
- Derive four rotated corners and padded bounds once in `@icm/derived`; editor,
  formal renderer, export bounds, and Agent geometry use that result.
- Creation is two-click: first corner, live opposite-corner preview, second
  corner commits. Degenerate zero-area rectangles are rejected.
- The floating inspector reuses line style/stroke controls and exposes bearing,
  Rotate, and Lock. Four corner handles resize in the rectangle's local axes.
- Context dispatch resolves the unified-canvas conflict: unmodified `R`
  rotates a selected placed component, arrow, construction line, or rectangle;
  with no rotatable selection it activates Rectangle following Virtuoso Layout
  convention. `Shift+R` rotates the selection in reverse.

## Validation

- focused model/derived/render tests
- editor TypeScript check and production build
- focused drafting browser test when stable in the dirty worktree
- `git diff --check`
- final `git status --short --branch`

## Commit intent

Do not commit or stage while shared editor files contain unrelated dirty work.
