# WP-R0 + WP-R1: Drafting Runtime Completion — Contract Freeze and Unified Geometry

## Goal

Respond to the review feedback that the drafting system is "runtime-incomplete":
schema, Edit Engine, and a basic renderer exist, but the editor and exporters do
not consume a single derived-geometry source of truth. This target delivers the
first two work packages of the Drafting Runtime Completion project:

- **WP-R0**: re-align the contracts (ADR 0010 + specs) with the runtime reality
  and publish a per-object capability matrix, so "Model complete / transaction
  complete / basic renderer complete / runtime-editor incomplete" is stated
  honestly. No schema upgrade, no new Agent endpoint, no persisted resolved
  positions.
- **WP-R1**: add the single `resolveDraftingObjectGeometry()` entry in
  `@icm/derived`, which resolves every DraftingObject's anchors to derived
  geometry (position/rotation/bounds/diagnostics) with a stable diagnostic
  shape. Renderer, Editor overlay, and Agent Snapshot must consume only this
  result from here on.

## Dirty-State Decision

Worktree is clean of tracked changes (HEAD is `a5382aa`; the only untracked
paths are the unrelated bandpass netlist). Proceed on a clean base.

## Frozen design decisions (from review; not to be expanded)

1. **No Project schema upgrade.** The existing VisualAnchor/DraftingObject/
   Guide structures are sufficient; the problem is runtime consumption, not the
   schema. No Layout Intent, no new Agent endpoint, no persisted resolved
   position, no diagnostics written back to project files, no drafting-to-
   drafting anchors, no change to `electricalTopologyHash`.
2. **Resolved geometry is always derived.** The Document stores only anchor
   references, fallbackPosition, localOffset, route segment/t/normal offset,
   and DraftingObject content. Actual position/rotation/endpoints/bounds/
   invalid-anchor status/diagnostics are runtime-computed and never serialized.
3. **One Drafting Geometry entry.** `resolveDraftingObjectGeometry(document,
   resolver, object): ResolvedDraftingGeometry` lives in `@icm/derived`. No
   per-consumer anchor logic.
4. **RichText AST is the only canonical content.** `flattenMarkup` is not used
   to initialize editing (WP-R3 handles the reversible serialize/parse pair).

## Owned Files (WP-R0)

- `docs/adr/0010-text-annotation-drafting-schema.md`
- `docs/specs/schematic-model.md`
- `docs/specs/agent-api.md`
- `plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/plan.md`
- `plan/log.md`

## Owned Files (WP-R1)

- `packages/derived/src/drafting-geometry.ts` (new)
- `packages/derived/src/anchor.ts` (extend diagnostics with anchorRole/targets;
  keep resolveVisualAnchor but add the drafting-level resolver)
- `packages/derived/src/index.ts` (exports)
- `packages/derived/src/drafting-geometry.test.ts` (new)
- `packages/derived/src/anchor.test.ts` (extend)
- `plan/log.md`

## Read-Only Files

- `packages/render-svg/src/**`, `packages/agent-adapter/src/**`,
  `apps/editor/src/**` — WP-R2/R4/R5 consume the new geometry in later work
  packages. WP-R1 does NOT edit them (review: "R1 完成前，不允许 R2/R4/R5 自己
  复制 anchor 算法"). The existing `draftObjectPosition` in render.ts is
  removed in WP-R2, not here.

## WP-R0 Work

1. Add a capability matrix to the roadmap/ADR review note (rendered, selected,
   created, moved, endpoint-adjusted, deleted, anchored, snapshot, export
   bounds) per DraftingObject kind, marking the honest runtime status:
   - Model: complete; Edit Engine: complete; basic renderer: complete;
     runtime/editor: incomplete.
2. Fix the agent-api spec + generated schema contradiction noted in review
   (Snapshot request should carry `includeEditorGuides`; default false).
3. State in the specs that resolved geometry is derived-only and the
   `resolveDraftingObjectGeometry` entry is the single consumer contract.

## WP-R1 Work

1. Define `DraftingDiagnostic` with `code` in
   {DRAFTING_ANCHOR_TARGET_MISSING, DRAFTING_ROUTE_SEGMENT_INVALID,
   DRAFTING_SYMBOL_UNRESOLVED}, `severity: "warning"`, `draftingObjectId`,
   `anchorRole: "anchor"|"from"|"to"|"target"`, `targetObjectIds`,
   `message`, optional `bounds`.
2. Define `ResolvedDraftingGeometry` as a discriminated union per object kind
   (text / arrow / leader / callout / construction-line / floating-symbol),
   each with position(s), `bounds: Rect`, and `diagnostics`.
3. Field-to-anchor mapping (fixed): text->anchor, arrow->from+to,
   leader->anchor+target, callout->anchor+target, floating-symbol->anchor,
   construction-line->points (no anchors).
4. Invalid-anchor behavior: use fallbackPosition, emit warning diagnostic,
   never guess a new route, never auto re-attach, never mutate the Document,
   never block rendering/export.
5. Anchor resolution reuses `resolveVisualAnchor` (already implemented) so
   route math stays identical; add anchorRole/targets to its diagnostics.
6. Bounds rules: text = rich-text-layout bounds; construction-line = points
   bounding box + stroke padding; arrow = segment bounds + arrowhead padding;
   leader = anchor/target bounds + padding; callout = leader ∪ text bounds;
   floating-symbol = transformed symbol bounds.
7. Tests: instance move follows object anchor; port/junction move follows;
   route waypoint change follows route anchor; route deletion -> fallback +
   diagnostic; out-of-range segmentIndex does not guess another segment;
   arrow anchors both ends to different targets; same input resolves
   deterministically; construction-line has no anchors and bounds cover points.

## Validation

- `npx vitest run packages/derived` — the owned package must be green.
- New drafting-geometry tests cover every kind's geometry + diagnostics.
- `npx tsc -p tsconfig.check.json --noEmit` clean (proves no consumer was
  broken by adding the derived module).
- `git diff --check`, `git status --short --branch`.
- Full suite runs as a guard; any failure must be attributable to this
  target's files, not to unrelated state.

## Commit Intent

```text
docs(drafting): freeze runtime completion contract and capability matrix (WP-R0)
feat(derived): resolve drafting object geometry with unified anchor diagnostics (WP-R1)
```
