---
status: completed
experience: none
---

# Q toggles the Properties dock closed

## Goal

Pressing `Q` currently only opens the Properties dock (`open-properties`).
Because opening focuses the first text input, a second `Q` is typed into that
input instead of closing the dock. Make `Q` a toggle: when the dock is open,
`Q` closes it — including when keyboard focus is inside a Properties input,
where the keypress must be swallowed instead of typing `q`. `Shift+Q` keeps
typing an uppercase letter into the field.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

Worktree is clean except the untracked `.worktrees/` directory, which is
unrelated infrastructure state and untouched by this target.

- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/e2e/drafting.spec.ts`

Read-only: `plan/log.md` gets a new entry only.

## Work

1. Extend `EditorShortcutContext` with `propertiesOpen` and
   `typingInProperties`; add a `close-properties` intent.
2. Resolver: plain `q` closes when the dock is open (idle mode only; active
   interactions keep the existing `blocked-interaction-command` behavior).
   While typing, `q` closes only when the typing target is inside the
   Properties dock and Shift is not held; typing elsewhere still suppresses
   every shortcut.
3. App: pass the new context fields, tag the dock aside with
   `data-testid="selection-dock"` for the containment check, and handle
   `close-properties` by collapsing the dock (mirroring the shelf button,
   including closing import review).
4. Help dialog: document `Q` as Properties open/close.
5. Unit tests: toggle contract including typing-inside-dock, Shift escape
   hatch, typing elsewhere, and active-interaction precedence.
6. E2E: extend the Q property-editing test with a close/reopen cycle while
   focus is in the value input; rewrite the drafting "follows selection and
   closes with the dock" test whose second `Q` press relied on idempotent
   reopen.

## Validation

- `pnpm test:local apps/editor/src/interaction/editor-shortcuts.test.ts apps/editor/src/app/App.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "Q property editing"`
- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts --grep "follows selection and closes"`
- TypeScript contract check covering the changed context interface
- `git diff --check`
- `git status --short --branch`

The resolver contract and the browser toggle flow are the two behavior
surfaces changed; the e2e picks cover both including the typing-swallow path.

## Commit Intent

Commit as:

```text
feat(editor): make Q toggle the Properties dock closed
```

## Outcome

Implemented Q as a Properties toggle. Idle-mode plain `q` now returns
`close-properties` when the dock is open, and while typing inside the dock the
keypress is intercepted (swallowed) so it closes instead of typing `q`;
`Shift+Q` still types an uppercase letter. Active interactions keep the
existing blocked-command arbitration, and typing outside the dock still
suppresses every shortcut. Help now reads "Properties open/close".

Validation: 28 focused unit tests (shortcuts + App), workspace typecheck,
Prettier, the extended "Q property editing" Playwright contract (close/reopen
while focused in the value input), the rewritten drafting dock contract, the
full drafting spec (25 tests), the two remaining Q-pressing component-insert
tests, `git diff --check`, and `git status --short --branch` all passed.

Experience signal: `none` — routine shortcut-arbitration change fully covered
by existing focused checks.
