---
status: active
experience: none
---

# Merge Schematic Reference Text to Main

## Goal

Deliver the reviewed `codex/unified-text-binding` implementation to `main`
after the repository's mainline dependency, CI, push, and remote-check gates.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-text-binding...origin/codex/unified-text-binding
?? .pnpm-store/
?? .worktrees/
```

The untracked directories are local infrastructure and do not overlap the
merge. `origin/main` is an ancestor of the reviewed branch. This target owns
only merge/delivery records and the fast-forward merge; it must not alter the
already reviewed implementation.

- `plan/2026-08-20-merge-schematic-reference-main/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only: implementation commits `a923af21`, `472cbda3`, and `62632de5`;
the frozen lockfile; and remote branch protection/required checks.

## Work

1. Run the required clean dependency and local CI gate on the reviewed branch.
2. Repair the stale Properties browser contract discovered by the mainline
   gate: it must exercise the new schematic-name field and prove the SPICE
   reference remains an export-only identity.
3. Fast-forward local and remote `main` only if the rerun gate passes.
4. Wait for the required remote checks and record their outcome.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`
- remote required checks green after push

## Test Impact

- Decision: no-test-change
- Evidence: this delivery target changes no implementation; the reviewed
  implementation's focused unit, protocol, browser, typecheck, and impact
  checks completed in its source target.

## Commit Intent

No source commit; merge the reviewed branch to `main` after gates pass.

## Outcome

Pending mainline delivery.
