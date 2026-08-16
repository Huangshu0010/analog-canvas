---
status: completed
experience: none
---

# Text system: annotation visibility, edit auto-commit, movable net labels

## Goal

Three user-requested text-system behaviors, aligned with Virtuoso conventions:

1. Component reference annotations become visibility-toggleable from
   Properties, for one or many selected instances (Virtuoso model: the `q`
   properties form carries per-label Display controls that also apply to a
   multi-selection). The buggy annotation-section "Delete annotation" button
   (only surfaces on multi-select, deletes exactly one label, and offers no
   re-show path) is removed outright.
2. Text/property editing commits on exit: clicking blank canvas or pressing
   Escape saves pending edits instead of discarding them. Explicit Apply
   stays.
3. Route-attached net labels (`L` labels) become properly movable: dragging
   re-anchors them along their route (segment/t/normalOffset) with a generous
   range instead of the current silent spring-back (release writes only the
   unused `fallbackPosition`).

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

Worktree clean except the unrelated untracked `.worktrees/` directory.

Owned paths:

- `packages/model/src/schema.ts` (+ its test) — optional `visible` on
  `AnnotationSchema` (default visible; backward-compatible optional field).
- `packages/render-svg/src/render.ts` — skip `visible === false` annotations.
- `apps/editor/src/app/App.tsx` — visibility toggles (single + group), delete
  the annotation delete button, commit-on-exit for `instancePropertyDraft` /
  `netLabelDraft` / `textEditing`, net-label drag re-anchoring and clamp
  range.
- `apps/editor/src/features/wiring/route-interaction-geometry.ts` — net-label
  slide/clamp constants shared with the drag path.
- `apps/editor/e2e/manual-editor.spec.ts`, `component-insert.spec.ts` and
  affected unit specs.
- `docs/specs/editor-interaction.md` — the "hiding a label == deleting the
  annotation" contract line is superseded by the `visible` flag.

Shared dependencies with credible overlap:

- `AnnotationSchema` is a persisted project contract (`upsert_schematic_annotation`,
  renderer, import/export). The field is optional and additive; goldens are
  unaffected because no fixture carries hidden labels.
- The route-panel "Delete Net label" action and empty-name L-editor deletion
  remain the supported net-label deletion paths after the annotation-section
  delete button is removed.

## Work

1. Model: `AnnotationSchema.visible?: boolean`; renderer, editor hit targets,
   and marquee selection skip annotations with `visible === false`. Upsert
   semantics preserve the flag.
2. Properties UI: a "Show reference label" checkbox in the single-instance
   section (creates a missing default label when switched on, via
   `defaultInstanceLabel`) and a group checkbox in the multi-select overview
   applying to every selected instance. Remove the annotation-section delete
   button (read-only info stays).
3. Commit-on-exit: commit dirty `instancePropertyDraft`/`netLabelDraft` before
   their selection-driven reload effects discard them; Escape inside Properties
   inputs commits; the floating rich-text editor commits on outside-pointerdown
   and Escape instead of discarding; the L floating editor commits on Escape.
   Insert dialog modal semantics stay cancel-on-Escape.
4. Net-label drag: in `draggedAnnotationAtPosition`, route-anchored net labels
   re-anchor via the nearest point on their own route (segmentIndex/t/signed
   normalOffset) using widened clamp constants; `constrainAnnotationPosition`
   net-label clamp widened to match.
5. Tests: unit contracts for schema/render skip and geometry; e2e for
   single+group visibility toggling (including re-show), blank-click and
   Escape commits, and a net-label drag that survives release.

## Validation

- `pnpm test:local` on: model schema, render-svg, editor App + affected
  feature specs (`route-interaction-geometry`, `text-editing`).
- `pnpm typecheck`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts` (label/editing
  surface) and `apps/editor/e2e/component-insert.spec.ts`
- Prettier on changed files
- `git diff --check`, `git status --short --branch`
- Mainline gate before merge (clean `pnpm ci:check` + green required checks)

## Commit Intent

Committed as one commit — the three features share the App.tsx properties
panel and draft-effect surfaces, so hunk-level splitting would be artificial:

```text
feat(editor,model): text system visibility, auto-commit, and movable net labels
```

## Outcome

Delivered all three behaviors:

1. `AnnotationSchema.visible?: boolean` (optional, backward compatible);
   renderer, editor hit targets, and marquee skip `visible === false`.
   Properties gains "Show reference label" (single) and "Show reference
   labels" (group) checkboxes — hiding keeps the annotation in the Project,
   showing re-creates a missing label via `defaultInstanceLabel`. The
   annotation-section "Delete annotation"/"Delete selected Net label" button
   is removed (route-panel deletion and empty-name L deletion remain; keyboard
   Delete still works).
2. Edits commit on exit: instance-property drafts commit when the selected
   instance id changes (keyed by id, not record, so unrelated transactions
   never replay a stale draft); Net label drafts commit when their route
   selection changes; Escape inside Properties inputs commits and blurs; the
   L floating editor and the canvas rich-text editor commit on Escape and on
   outside clicks instead of discarding. Fixing this surfaced a latent
   revision bug: `proposeTextEditingCommit` compared an absent sizeScale
   (undefined) against the session-normalized 1, so an untouched session
   committed a phantom style update; both sides now normalize with `?? 1`.
3. Route-anchored Net labels re-anchor on drag via
   `dragNetLabelAttachmentAtPoint` (segment/t/normalOffset, band ±[8, 200],
   signed side flips freely), replacing the silent fallback-only spring-back;
   the free-label constrain clamp widened to match. Segment choice uses the
   nearest on-conductor projection so corners cannot steal nearby drags.
   Name edits now preserve a dragged route anchor.

Validation: 511 unit tests across editor/model/render-svg/edit-engine/derived
(including new schema `visible` and net-label slide contracts), workspace
typecheck, Prettier, and Playwright: full manual-editor spec (74), full
drafting spec (25), full component-insert spec (18), covering the new
visibility-toggle, commit-on-exit, text-editor commit, and net-label drag
contracts plus the rewritten L-editor Escape contract. `git diff --check`
clean.

Experience signal: `none`.
