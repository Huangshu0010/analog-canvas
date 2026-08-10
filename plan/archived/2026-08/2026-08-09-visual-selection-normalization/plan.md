# Normalize editor visual selection

## Goal

Replace the editor's parallel instance, route, annotation, and drafting
selection stores with one normalized `VisualSelection` protocol at the editor
boundary. Preserve distinct persisted object schemas while making marquee,
single selection, copy eligibility, and deletion consume one canonical object
set.

## Dirty-State Note

The tracked worktree is clean. Untracked circuit export artifacts, historical
plans, and a local probe are unrelated to editor source and remain untouched.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/visual-selection.ts`
- `apps/editor/src/visual-selection.test.ts`
- `apps/editor/src/delete-selection.ts`
- `apps/editor/src/delete-selection.test.ts`
- `plan/2026-08-09-visual-selection-normalization/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/model/src/schema.ts`
- `packages/edit-engine/src/transaction.ts`
- `apps/editor/src/clipboard.ts`

## Shared Dependencies

- Semantic `Annotation` and generic `DraftingObject` stay separate persisted
  contracts.
- The edit engine is the only mutation boundary.
- Instance deletion owns removal of attached annotations.

## Expected Work

1. Define a deterministic `VisualSelection` value with unique object IDs by
   visual object kind, plus pure replacement/normalization helpers.
2. Make it the sole editor selection state; derive primary route/annotation/
   drafting selections for existing property panels and gesture affordances.
3. Route marquee and deletion through the canonical value, including ownership
   de-duplication for attached annotations.
4. Add pure protocol tests and retain focused editor regressions.

## Outcome

- `VisualSelection` is the editor's sole selection state. It has normalized,
  unique ID sets for instances, routes, junctions, semantic annotations, and
  drafting objects.
- Existing primary selection affordances are derived from that value so the
  property panels and route handle retain their single-object behavior without
  owning parallel state.
- Marquee writes one normalized selection value; deletion reads that same value
  before applying attached-annotation ownership de-duplication. Junction
  endpoint selection now enters the same selection value as well.
- The model still has separate `Annotation` and `DraftingObject` schemas; only
  the editor interaction protocol is unified.

## Validation

- `pnpm exec vitest run apps/editor/src/App.test.tsx apps/editor/src/visual-selection.test.ts apps/editor/src/delete-selection.test.ts`
- `pnpm typecheck`
- `pnpm -C apps/editor build`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
refactor(editor): normalize visual selection protocol
```
