# Drafting midpoint bending and contextual inspector

## Goal

Make free drafting arrows and construction lines directly reshapeable from a
segment midpoint, and expose their most-used appearance controls beside the
selected object. Electrical routes/wires and route-mounted current markers are
explicitly out of scope.

## Dirty-state decision

`git status --short --branch` was clean at target start on
`codex/optimize-iteration` (ahead 2). A separate completed plan directory,
`plan/2026-08-09-direct-miter-terminal-joins/`, exists but is not modified by
this target. Proceeding without touching it.

During implementation, a concurrent precise-selection target created
`apps/editor/src/selection-geometry.ts`, its test, and
`plan/2026-08-09-precise-selection-interaction/`, and also modified the shared
`App.tsx`/`styles.css`. This target's hunks were applied without replacing
those changes, but no more edits will be made to the shared editor files until
that work is settled. They must not be staged or committed as part of this
target.

Later concurrent CAD-shortcut/select-before-drag work also touched `App.tsx`,
the manual-editor E2E spec, interaction docs, and untracked shortcut helpers.
This target will confine its final editor hunks to free-drafting geometry and
the nearby inspector, then leave every concurrent path unstaged.

At follow-up start, the shared editor files remain dirty alongside independent
canvas-drag-session, route-stretch, and selection changes. This fix adds only
the transient free-drafting handle preview and leaves all of those neighboring
hunks intact; package renderer/test edits are isolated to arrow end tangent
calculation.

## Ownership

Owned paths:

- `packages/model/src/schema.ts`
- `packages/derived/src/drafting-geometry.ts`
- `packages/model/src/drafting-geometry-schema.ts`
- `packages/render-svg/src/render.ts`
- `apps/editor/src/App.tsx`
- `apps/editor/src/styles.css`
- focused drafting geometry/render tests as needed
- this plan and `plan/log.md`

Read-only shared boundaries:

- edit-engine transaction protocol (reuse `upsert_drafting_object`)
- electrical route/wire model and interaction
- route-mounted current annotation semantics

## Design

- A free arrow gains optional `waypoints`; old arrows remain valid and resolve
  as a two-point path.
- **Scope correction (human requested):** midpoint drag is not an elbow
  insertion. It creates/updates a quadratic Bézier control for that segment;
  the persisted `curveControls` array is aligned with the point segments.
  Double-click continues to be the explicit polyline-vertex action.
- Existing endpoint anchors are retained, so no electrical state changes.
- The formal renderer consumes the same line/quadratic path and orients the
  arrow head along the final segment's end tangent.
- A compact SVG `foreignObject` inspector is positioned beside selected free
  drafting geometry. The selection shelf remains the persistent/bulk surface.
- This target supplies per-segment quadratic curves, not a general cubic spline
  editor. Quadratic segments give the requested midpoint-flex behavior while
  keeping a small, deterministic persistence and export contract.
- The contextual inspector exposes the active segment's endpoint-tangent
  included angle. Its readout updates during midpoint drag; direct numeric
  entry creates a symmetric quadratic control on the existing bend side, so a
  single scalar has an unambiguous and stable result.
- Follow-up interaction fix: the numeric field owns a temporary text draft
  while focused. Geometry may update per valid numeric keystroke, but realized
  angle rounding must not overwrite the user's partial input until blur.
- Free Arrow and Construction line also expose an absolute first-segment
  bearing. Entering a bearing rotates all free path points and quadratic
  controls around the object pivot; attached arrow endpoints remain protected
  from a rotation that would detach them.
- Follow-up render check: curved free arrows must share one final-segment
  tangent for their shaft truncation and arrowhead polygon in both the editor
  canvas and formal export. A focused SVG renderer regression verifies that a
  final curved segment changes the head polygon direction rather than merely
  the shaft path; the editor build exercises the same renderer in the canvas.

## Validation

- focused model/derived/render tests
- editor build/typecheck where available
- `git diff --check`
- final `git status --short --branch`

## Commit intent

One focused feature commit after validation; do not stage unrelated paths.
