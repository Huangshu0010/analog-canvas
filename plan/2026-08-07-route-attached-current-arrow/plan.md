# Route-Attached Razavi Current Arrow

## Goal

Make a current annotation a first-class, route-attached Razavi-style drawing
object: a solid shaft plus filled triangular arrowhead aligned to one explicit
wire segment, with an italic/subscript-capable current label. A user must be
able to create it from the editor, change its text, drag it along the selected
route, and have it follow a moved or re-derived route.

## Dirty-State Decision

The worktree is concurrently dirty in editor, model, renderer, derived,
edit-engine, visual-golden, and other areas. The user explicitly confirmed
parallel work does not block this target. Current diffs in `schema.ts`,
`render.ts`, and `App.tsx` are limited to junction-role and text-label work;
this target adds a new optional annotation attachment contract and isolated
current-arrow command/render paths. It will not overwrite or revert any
existing changes. `plan/log.md` is concurrently dirty and read-only for this
target.

## Owned Files

- `plan/2026-08-07-route-attached-current-arrow/plan.md`
- `packages/model/src/schema.ts` and focused schema tests if required
- a focused route-annotation geometry helper/test under `packages/derived/src/`
- `packages/render-svg/src/render.ts` and `render.test.ts`
- `apps/editor/src/App.tsx`, `clipboard.ts`, and focused editor tests
- `package.json` entries for the dedicated visual check
- `scripts/route-attached-current-arrow-golden.mjs`
- `fixtures/projects/route-attached-current-arrow/project.icproj.json`
- `fixtures/visual-golden/route-attached-current-arrow.svg`

## Read-Only Dependencies

- all concurrent non-target changes, including `plan/log.md`
- transaction semantics in `packages/edit-engine/`
- existing style-profile typography and arrow tokens
- project fixture topology and symbol catalogue

## Contract

An optional `routeAttachment` on an annotation contains `routeId`,
`segmentIndex`, `t` (0 through 1 along the resolved segment), and
`normalOffset`. It is valid for `kind: "current"` only. `position` remains a
persisted fallback/selection position for backwards compatibility; render and
editor derive the displayed anchor and direction from the referenced resolved
route. The attachment is visual-only and does not change a Net, Route, or
terminal membership.

## Expected Work

1. Add a strict, backwards-compatible route attachment schema and shared
   resolved-segment placement helper.
2. Update rendering and bounds to derive arrow position/rotation from the
   attachment, retaining existing free current annotations unchanged.
3. Add an editor command that creates a current arrow on the selected route,
   then lets annotation dragging choose the nearest segment and preserve its
   label offset.
4. Add focused render and geometry coverage, plus a representative visual
   fixture or golden.

## Validation

- focused model/derived/render/editor tests for attachment persistence,
  horizontal/vertical direction, label placement, and moved-route following
- targeted TypeScript/build validation
- inspect the generated formal SVG for a Razavi-like filled arrowhead and
  current text treatment
- `git diff --check` and `git status --short --branch`

## Commit Intent

The route-attachment contract (`RouteAnnotationAttachment`, `routeAttachment`
on the annotation schema), the shared `routeAttachmentPlacement` helper in
`packages/derived`, and the renderer's attached-arrow path were already
committed as part of the 2026-08-08 worktree-split sequence (absorbed into
the `a6eeccf` / `64eefa1` fix commits). This plan now lands the remaining
editor layer: the `Add current arrow` command, drag-along-segment behavior,
`Reverse arrow` control, clipboard route-reference remapping, the focused
`current-arrow.test.ts`, the checked project/visual-golden fixture, and the
plan record itself. It is committed together with the annotation-editing and
editor-text-label-hit-fixes editor-layer remnants because all three share the
same `App.tsx` working set.

## Outcome

- Added the strict optional `routeAttachment` contract for current
  annotations: route id, segment index, normalized segment fraction, direction,
  and label normal offset. Other annotation kinds reject the contract.
- Added a shared route-placement derivation. The arrow anchor moves with the
  resolved wire segment while its `t` value stays constant; the visual-only
  attachment changes no electrical topology.
- Rendered attached arrows with the existing Razavi solid triangle, annotation
  stroke, and italic/subscript text pipeline. Free legacy current annotations
  preserve their former rendering.
- Added the editor Route action `Add current arrow`; it creates `I_x` at the
  selected segment midpoint. Dragging retains the attachment and moves it
  along that segment; the selected arrow has a contextual `Reverse arrow`
  control. Clipboard copy/paste remaps its internal route reference.
- Added a checked formal fixture and inspected its rasterized SVG: a leftward
  solid arrow lies on the output wire with a Razavi-style `I_x` above it.
- Passed: focused model, route geometry, renderer, clipboard-remapping tests;
  `pnpm typecheck`; `pnpm build`; dedicated visual-golden check; formatting;
  and `git diff --check`.
- A broader focused command including the pre-existing dirty
  `clipboard.test.ts` and formal phase-1 golden still reports their unrelated
  failures. The dedicated current-arrow renderer test passes. `plan/log.md`
  remains untouched because it is concurrently dirty.
