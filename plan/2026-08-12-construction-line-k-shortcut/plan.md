---
status: completed
experience: none
---

# Move Construction Line to K

## Goal

Release `P` for future schematic Port insertion and bind `K` to Construction
line consistently across the editor UI, Help, and shortcut contract.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree was clean before this target and is now on
`codex/construction-line-k-shortcut`. This target owns the shortcut resolver,
its regression, visible shortcut text, contract, and factual records.

- `apps/editor/src/interaction/editor-shortcuts.ts`
- `apps/editor/src/interaction/editor-shortcuts.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/components/editor-help-dialog.tsx`
- `apps/editor/e2e/drafting.spec.ts`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-12-construction-line-k-shortcut/plan.md`
- `plan/log.md`

## Work

1. Change the Construction line shortcut resolver from `P` to `K` and guard
   the new binding with a focused unit regression.
2. Update the Draw menu, Help, interaction specification, and command-menu E2E
   labels; deliberately do not bind `P` until a Port creation flow exists.

## Validation

- focused shortcut unit test
- `pnpm --filter @icm/editor build`
- source search confirming no visible Construction line `(P)` / shortcut entry
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): reserve P for future port insertion
```

## Outcome

Construction line now uses `K`; `P` is intentionally unbound until Port
creation exists. The Draw menu, Help, interaction specification, shortcut unit
test, and command-menu E2E labels were synchronized. The focused shortcut test
(10), drafting E2E suite (25), production editor build, obsolete-label search,
and `git diff --check` passed.
