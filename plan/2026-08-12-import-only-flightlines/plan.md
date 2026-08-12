---
status: completed
experience: none
---

# Import-Only Flightlines and Net Label Removal

## Goal

Restrict dashed flightlines to untouched SPICE-imported documents and provide a
clear Route action for removing a Net Label without changing electrical Net
membership.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target owns only editor display/action policy and
focused browser coverage. It intentionally does not alter the concurrent
power-domain model work or implement unsafe reverse Net splitting.

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/log.md`

Shared/read-only: the edit engine's `sourceStatus` contract distinguishes an
untouched import (`in-sync`) from a user-modified document; this target consumes
that existing contract without changing it.

## Work

1. Render flightlines only when a document still has both a SPICE source
   binding and `sourceStatus: in-sync`.
2. Add a dedicated Delete Net Label action for the selected Route.
3. Verify naming/removing a label hides imported flightlines while removal does
   not claim to disconnect merged electrical Nets.

## Validation

- focused Playwright Net label/flightline tests
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): limit flightlines to untouched imports
```

## Outcome

Flightlines now render only for a document that both originated from SPICE and
remains `in-sync`; any human modification, including label removal, hides them.
The selected Route action shelf now has Delete Net label, which removes only
the route-attached annotation and explicitly leaves electrical Net membership
unchanged.

Validation passed: workspace typecheck and four focused browser flows for
import guidance, manual route deletion, highlight interaction, and Net Label
add/remove.
