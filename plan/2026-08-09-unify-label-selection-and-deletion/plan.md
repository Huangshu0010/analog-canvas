# Unify label selection and deletion

## Goal

Make default instance labels first-class, movable semantic labels; ensure a
marquee selection containing labels deletes atomically; and use the existing
RichText layout metric for semantic-label hit testing.

## Dirty-State Note

Start state: `feat/razavi-fidelity-diff-harness` is ahead of origin by three
commits and has uncommitted work for the independent VDD visual-authority
target, including an `apps/editor/src/App.tsx` hunk that adds a VDD power-label.
That file is a shared dependency for this target. On 2026-08-09 the human
explicitly authorized retaining that hunk while this target edits distinct
regions. The VDD hunk and all other dirty paths remain read-only and untouched.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/delete-selection.ts`
- `apps/editor/src/clipboard.ts` (only if selection abstraction requires it)
- `apps/editor/src/**/*.test.tsx` (new focused interaction regressions)
- `packages/derived/src/**/*.ts` (only if a shared semantic label bounds helper
  is required)
- `packages/derived/src/**/*.test.ts`
- `plan/2026-08-09-unify-label-selection-and-deletion/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/model/src/schema.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/schematic-text.ts`
- VDD visual-authority files and generated symbol catalog currently dirty in
  the worktree.

## Shared Dependencies

- `Annotation` is the semantic electrical-label contract; explicit instance
  labels suppress render-only default instance IDs.
- `DraftingObject` remains the separate general drafting contract.
- `proposeConnectedInstanceDeletion()` owns automatic deletion of annotations
  attached to removed instances.
- The derived RichText layout system is the common source for text geometry.

## Expected Work

1. Introduce one deterministic implicit/explicit instance-label path so every
   visible default label can be selected and dragged without a preliminary
   rename, while preserving stable instance IDs and avoiding gratuitous project
   mutations.
2. Deduplicate explicit selected annotations against annotations that instance
   deletion already removes, before assembling the mixed deletion transaction.
3. Consolidate marquee and drag selection bookkeeping around a common visual
   selection representation; preserve semantic Annotation and DraftingObject
   storage distinctions.
4. Replace character-count annotation hit-box estimation with the existing
   RichText layout measurement, including semantic subscript geometry.
5. Add focused regression coverage for default-label dragging, marquee delete
   of instance-plus-label, and subscript label hit testing.

## Outcome

- A render-only default instance label now receives an editor hit surface. Its
  first pointer-down materializes the equivalent attached `instance-label` and
  continues through the normal semantic-label drag flow; a rename is no longer
  required before movement.
- A marquee that intersects a render-only default label selects its owning
  instance. Existing explicit labels remain independently represented in the
  supplemental visual selection.
- Mixed deletion now filters annotation removals already owned by selected
  instance deletion, eliminating the second `remove_annotation` transaction
  edit and its `OBJECT_NOT_FOUND` rollback.
- Semantic annotation hit geometry uses the shared RichText layout metrics,
  including the calibrated subscript scale and baseline shift.

## Validation

- Focused editor interaction tests for selection, movement, and deletion.
- Focused Derived tests if a shared bounds helper changes.
- `pnpm -C apps/editor build` and workspace `pnpm typecheck`, because the
  interaction bridge consumes model, derived geometry, and edit transactions.
- `git diff --check` and `git status --short --branch`.

The full test suite is not the first gate; this target is concentrated in the
editor interaction layer. It may be added if shared-contract tests expose a
broader regression.

Completed focused validation:

- `pnpm exec vitest run apps/editor/src/App.test.tsx apps/editor/src/delete-selection.test.ts` — 8/8 passed.
- `pnpm -C apps/editor build` — passed.
- `pnpm typecheck` — blocked before this target's code by the retained VDD
  hunk at `apps/editor/src/App.tsx:1959`: `rotation: 0` is inferred as
  `number`, while the edit schema requires `0 | 90 | 180 | 270`. This target
  intentionally does not modify the separately owned VDD hunk.
- `git diff --check` — passed.

## Experience Signal (for human review)

The render-only default-label convention has diverged from the editor's object
selection model. If the repair confirms this is a repeatable architecture
failure, ask whether to extract a lesson after review.

## Commit Intent

```text
fix(editor): unify instance label selection and deletion
```
