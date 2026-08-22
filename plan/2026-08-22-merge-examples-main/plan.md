---
status: active
experience: none
---

# Deliver Examples toggle and bundled circuits to main

## Goal

Rebase `codex/examples-toggle-and-circuits` onto current `origin/main`, complete the canonical mainline checks, and merge the reviewed branch into remote `main`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/examples-toggle-and-circuits...origin/codex/examples-toggle-and-circuits
?? .pnpm-store/
?? .worktrees/
```

The untracked local dependency cache and linked-worktree directory are unrelated and will remain untouched. This delivery target owns the branch integration and its records; the implementation files are already committed in `65250cf5`.

- `plan/2026-08-22-merge-examples-main/plan.md`
- `plan/log.md`

- Read-only: committed Examples implementation in `65250cf5`, `origin/main`, and GitHub Actions results.
- Shared: remote `main`, branch protection, package lockfile and mainline CI commands.

## Work

1. Rebase the reviewed Example change onto current `origin/main`, resolving only conflicts attributable to this branch.
2. Run the canonical fresh-install and CI check required for mainline delivery.
3. Push the rebased review branch, open a pull request, wait for required checks, and merge it through GitHub.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- GitHub Actions required checks on the review pull request
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: fresh frozen dependency install before the canonical CI check.
- Affected gates: already completed for `65250cf5`; rebase conflicts would require rerunning the relevant affected gate.
- Final gates: `pnpm ci:check`, remote required checks, and GitHub merge.
- Platform risks: rebase may duplicate or conflict with upstream changes; remote branch protection is authoritative.

## Test Impact

- Decision: no-test-change
- Reason: this delivery target only rebases previously tested implementation and
  resolves a plan-log conflict; it introduces no behavioral source change.
- Existing protection: `apps/editor/src/examples/library-examples.test.ts` and
  `apps/editor/e2e/component-insert.spec.ts` were updated and passed for the
  implementation target.

## Commit Intent

Commit as:

```text
docs(plan): record examples mainline delivery
```

## Outcome

Update after merge with the rebased commit, CI and remote-check status, and merge commit or PR reference.
