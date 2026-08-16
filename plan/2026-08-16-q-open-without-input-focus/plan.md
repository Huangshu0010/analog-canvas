---
status: completed
experience: none
---

# Q opens Properties without stealing focus into the first input

## Goal

`Q` currently opens the Properties dock and auto-focuses the first text input
(for a MOS, the W parameter input). The user wants `Q` to behave as a pure
toggle: opening must not move focus into a text field — focus the shelf header
instead — and typing only begins when the user clicks an input. The previous
"swallow Q while typing inside the dock" interception is removed so that once
the user deliberately clicks into a field, keys type normally. The toggle
semantics (Q opens when closed, closes when open) stay.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

Worktree clean except the unrelated untracked `.worktrees/` directory.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/e2e/component-insert.spec.ts`

Read-only: `plan/log.md` gets a new entry only. The double-click inspect path
(`inspectInstance`) keeps its input auto-focus on purpose: it is an explicit
edit gesture, not the Q toggle.

## Work

1. `openProperties()`: focus `selectionShelfRef` (header button) instead of
   `netLabelPropertyInputRef` / `instanceValueInputRef`.
2. Resolver: drop the `typingInProperties` typing exception and context field;
   restore uniform "typing suppresses every shortcut". Keep `propertiesOpen`
   and the `close-properties` toggle intent.
3. App: remove the `typingInProperties` context wiring and the
   `data-testid="selection-dock"` hook that only served it.
4. Unit tests: replace the in-dock typing-close contract with "typing stays
   suppressed even while the dock is open"; keep the toggle contracts.
5. E2E: the "Q property editing" contract now asserts the value input is NOT
   focused after Q opens (shelf header is), that Q still toggles closed/open,
   and that clicking the input starts editing.

## Validation

- `pnpm test:local apps/editor/src/interaction/editor-shortcuts.test.ts apps/editor/src/app/App.test.tsx`
- `pnpm typecheck`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "Q property editing"`
- `pnpm test:e2e:local apps/editor/e2e/drafting.spec.ts --grep "follows selection and closes"`
- Prettier check on changed files
- `git diff --check`
- `git status --short --branch`

The Q toggle and its focus contract are fully covered by these focused checks;
the drafting grep guards the other Q-open flow that shares `openProperties`.

## Commit Intent

Commit as:

```text
feat(editor): keep Q a pure Properties toggle without input auto-focus
```

## Outcome

`openProperties()` now focuses the shelf header button only; the first text
input (a MOS W field in the reported case) no longer receives focus, so Q is a
pure toggle. The previous in-input Q interception (`typingInProperties` and the
dock testid) was removed: typing anywhere, including a deliberately clicked
Properties field, suppresses every shortcut uniformly. The double-click inspect
path keeps its input auto-focus. Toggle semantics and interaction arbitration
are unchanged.

Validation: 28 focused unit tests, workspace typecheck, Prettier, the reworked
"Q property editing" Playwright contract (shelf focused, input not focused,
Q close/reopen, click-to-edit), the drafting dock contract, the double-click
inspect contract, `git diff --check`, and `git status --short --branch` passed.

Experience signal: `none` — behavior adjustment within the existing shortcut
contract, covered by focused checks.
