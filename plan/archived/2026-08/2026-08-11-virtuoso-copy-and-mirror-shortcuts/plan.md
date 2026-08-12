---
status: completed
experience: none
---

# Virtuoso-Style Copy Placement and Mirror Shortcuts

## Goal

Adopt the agreed compact keyboard contract:

- `R`: rotate selected object(s) clockwise; placement preview still rotates;
- `Shift+R`: mirror selection left/right;
- `Shift+V`: mirror selection top/bottom;
- `C`: clone the current component selection into a mouse-following,
  single-shot preview; click commits the existing atomic paste proposal and
  `Esc` cancels;
- remove editor bindings and menu affordances for `Ctrl+C` / `Ctrl+V`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns:

- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/features/clipboard/clipboard.ts`
- `apps/editor/src/features/clipboard/clipboard.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/src/styles.css`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-11-virtuoso-copy-and-mirror-shortcuts/plan.md`
- `plan/log.md`

Shared model, edit engine, and formal renderer contracts remain read-only. Copy
placement must compose the existing `copySelection` / `proposePaste` transaction
and formal scene renderer; it must not create a second copy schema or edit kind.

## Work

1. Change the shortcut resolver to the agreed R / Shift+R / Shift+V / C map,
   remove Ctrl+C/V intents, and preserve browser-reserved chords.
2. Add a translated clipboard-preview document helper and render it as a
   non-interactive, formal-style canvas ghost.
3. Add a temporary copy-placement state: cursor delta drives the ghost, one
   canvas click runs `proposePaste`, selects the new instances, and Esc cancels
   without a revision.
4. Remove menu Copy/Paste controls and legacy immediate-paste functions.
5. Add focused unit and E2E coverage for mirrored selection, C preview,
   atomic group commit, and cancellation.

## Validation

- Focused shortcut/clipboard/App tests and manual editor E2E.
- Workspace typecheck, production editor build, `git diff --check`, and status
  review.

## Commit Intent

```text
feat(editor): add copy placement shortcuts
```

## Outcome

Implemented the agreed `R` / `Shift+R` / `Shift+V` shortcut map and replaced
the immediate Ctrl+C/Ctrl+V workflow with single-shot `C` copy placement.
`C` captures the existing internal subgraph, renders a formal non-interactive
ghost at the grid-snapped pointer location, commits the existing
`proposePaste()` transaction on click, selects the copied instances, and
cancels without a revision on Escape. Browser Ctrl+C/V and the redundant Edit
menu controls are no longer editor commands.

Focused shortcut/clipboard/App tests (23), key manual-editor E2E (4), workspace
typecheck, production editor build, complete editor E2E (72), and `git diff
--check` passed.
