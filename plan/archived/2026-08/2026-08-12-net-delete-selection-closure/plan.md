---
status: completed
experience: none
---

# Close Net-label and Wire deletion selection lifecycle

## Goal

Make deletion composable: removing a Net Label must not leave a stale
annotation id that causes the next Wire deletion transaction to roll back.
Audit and record the wider Net/Route/label contract divergence without
expanding this repair into an unsafe connectivity-schema migration.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target owns selection lifecycle repair and its
focused browser regression.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/selection/visual-selection.ts`
- `apps/editor/src/features/selection/visual-selection.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-net-delete-selection-closure/plan.md`
- `plan/log.md`

Read-only audit dependencies:

- `packages/model/src/schema.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/derived/src/connectivity.ts`
- `packages/derived/src/connectivity-index.ts`
- `docs/specs/connectivity-and-routing.md`
- `docs/adr/0013-project-connectivity-index.md`

## Work

1. Add one pure selection-pruning boundary against the current Document.
2. Reconcile selection after every committed Document mutation and explicitly
   clear a removed Net Label immediately.
3. Extend the browser regression through Label deletion followed by Wire
   deletion, proving that no stale ID rolls back the second transaction.
4. Record the audited protocol divergence in the outcome for the subsequent
   connectivity-contract target.

## Validation

- focused visual-selection unit tests
- focused Net Label browser tests
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): reconcile selection after Net deletion
```

## Outcome

Closed the immediate deletion rollback. Selection now has one model-bound
pruning boundary, and Label deletion clears its annotation selection
immediately. The focused browser flow proves that a user can delete a Label
and then delete the still-selected Wire without reselecting it; the second
transaction no longer contains a stale `remove_annotation` edit.

The wider audit found a real contract divergence that must be handled as a
separate connectivity migration:

1. The current GUI and Edit Engine treat `net-label.attachedObjectId` as a Net
   id. Route-follow code and the archived accepted implementation plan state
   this explicitly.
2. `packages/derived/src/connectivity.ts` and `connectivity-index.ts` still
   interpret the same field as a Junction id when deriving label virtual
   edges. Those edges therefore do not describe labels created by the GUI.
3. Applying a duplicate name performs a destructive `merge_nets`; removing
   the display annotation cannot reconstruct the original Net partition.
4. `Net.name`, the visible Label annotation, Route geometry, and imported
   logical membership are separate records, but the Properties input presents
   `Net.name` as if it were the annotation text. Deleting only the annotation
   can therefore look like a failed deletion when the name remains.
5. `cut_connection` intentionally retains logical membership for an already
   partial/imported Net. This is safe for source truth but means "delete Wire"
   and "disconnect electrical Net" cannot be treated as synonyms.

The next contract target should freeze one owner for Label electrical binding,
replace the Junction-id legacy derivation, and define a reversible typed
operation before allowing Label deletion to split or clear a merged Net. This
repair deliberately does not guess that partition from geometry or silently
rewrite imported SPICE membership.

Validation passed: 3 visual-selection unit tests, 2 focused Net Label browser
tests, workspace TypeScript check, and `git diff --check`.
