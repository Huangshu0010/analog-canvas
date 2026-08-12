---
status: completed
experience: none
---

# Align Net Label highlight with the unified Net protocol

## Goal

Make a selected Net Label resolve to the same logical Net as Route and endpoint
selection, so the `H` shortcut and Properties action highlight the complete Net
through the shared Net-label binding contract.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target owns the editor's highlight-selection
adapter, its focused browser regression, this plan, and the maintenance log.

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-align-net-label-highlight/plan.md`
- `plan/log.md`

Shared dependency: the accepted `resolveNetLabelBinding()` contract from
`@icm/derived` is read-only and remains the only Label-to-Net adapter.

## Work

1. Derive one selected highlight Net id from Route, endpoint, or a valid
   selected Net Label.
2. Feed both the `H` shortcut and visible annotation action through that id.
3. Prove that selecting an imported arbitrary-id Label highlights every Route
   on its Net and that `H` clears it.

## Validation

- focused Net highlight browser tests
- workspace typecheck
- targeted Prettier
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): align Net Label highlight selection
```

## Outcome

Unified Route, endpoint, and valid Net Label selection behind one
`selectedHighlightNetId`. A selected Label now enables `H` and exposes the
same highlight/clear action in Properties; both paths highlight the complete
logical Net via its frozen Net-id binding.

Validation completed: three focused browser flows covering Label and Route
selection; workspace typecheck; targeted Prettier; and `git diff --check`.
