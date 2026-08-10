# Rectangle outline hit testing

## Goal

Make drafting rectangles behave as non-occluding outlines: component placement
and ordinary canvas interaction must pass through their empty interior, direct
selection must remain available on the visible border, and a marquee wholly
inside the empty interior must not select the surrounding rectangle.

## Dirty-state decision

The target starts from a clean `main` worktree at `c5cf03a`. Work proceeds on
`codex/fix-rectangle-hit-testing`; there are no user-owned or concurrent dirty
paths to preserve.

## Ownership

Owned paths:

- rectangle-specific hit-testing helpers and branches in
  `apps/editor/src/App.tsx`
- rectangle-specific hit styling in `apps/editor/src/styles.css`
- focused rectangle interaction coverage in `apps/editor/e2e/drafting.spec.ts`
- this plan and the factual close-out entry in `plan/log.md`

Read-only boundaries:

- persisted drafting rectangle schema and formal SVG rendering
- electrical connectivity and component placement transactions
- hit behavior for arrows, construction lines, text, and annotations

## Design

- Keep a fixed screen-pixel tolerance around the rectangle outline, but use
  SVG stroke-only pointer events so the transparent interior is never a hit
  target.
- Keep the rectangle hit stroke visually transparent in both selected and
  unselected states. Existing corner handles provide the selection affordance;
  no whole-interior selection fill is drawn.
- For marquee selection, test the four rectangle boundary segments against the
  marquee. A marquee that surrounds or crosses the outline selects it; a small
  marquee wholly inside its empty interior does not.

## Validation

- focused Playwright coverage for border selection, interior component
  placement, and interior-only marquee behavior
- editor TypeScript check and production build
- changed-file formatting
- `git diff --check`
- final `git status --short --branch`

## Commit intent

Stage only the owned target files, commit the focused repair, and push the
target branch after validation.

## Result

- Rectangle editor overlays now use stroke-only pointer events and remain
  unfilled while selected.
- Rectangle marquee selection now intersects the four boundary segments rather
  than the filled bounding box.
- The focused browser scenario verifies that an interior-only marquee leaves
  the outline unselected, a MOS can be placed directly inside, and the border
  remains selectable and resizable.
- Editor TypeScript, the focused Playwright scenario, and the editor production
  build passed.
