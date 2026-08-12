---
status: completed
experience: none
---

# Net Highlight and Flightline Clarity

## Goal

Make a selected Net visually unmistakable, provide a keyboard toggle, and keep
flightlines limited to unresolved physical routing rather than label state or
an active highlighted Net.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target owns the editor Net interaction and its
focused tests. It does not change electrical SPICE import semantics or symbol
assets.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/interaction/editor-shortcuts.ts`
- focused editor interaction tests
- `plan/log.md`

Shared/read-only dependencies: `packages/derived/src/connectivity.ts` defines
flightline derivation and is inspected first. A change there is only permitted
if the editor policy cannot be expressed at the presentation boundary.

## Work

1. Audit label deletion, derived flightline state, and highlighted-Net overlay
   to distinguish electrical truth from display policy.
2. Render highlighted Net routes, junctions, and visible endpoints with a
   strong, non-interactive overlay; suppress only that Net's flightlines while
   it is highlighted.
3. Add a context-sensitive keyboard shortcut to toggle the selected route or
   endpoint Net highlight, including clear behavior.
4. Add focused tests for shortcut resolution and the Net display policy, then
   validate the editor build/type surface.

## Validation

- `corepack pnpm --filter @icm/editor test -- --run`
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): strengthen Net highlighting and flightline policy
```

## Outcome

Implemented a strong cyan Net overlay with a broad halo, core conductor,
junctions, and visible endpoints. `H` toggles the selected Route (or an
explicitly selected endpoint) Net, and the active Net's flightlines are hidden
until the highlight is cleared. The existing label-delete behaviour was
confirmed as a separate model issue: labels currently merge Nets permanently,
so deleting the annotation cannot safely reconstruct the prior Net partition.

Validation passed: the shortcut unit test, workspace typecheck, and two focused
Playwright flows covering complete-route highlighting plus imported partial-Net
flightline hide/restore.
