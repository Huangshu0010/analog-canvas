---
status: active
experience: none
---

# Merge Library Examples to Main

## Goal

Integrate the reviewed Library Project examples branch into `main` only after
the required local and remote mainline checks pass.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/library-examples...origin/codex/library-examples
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated and will remain untouched.
This target owns only its integration record and the branch/PR lifecycle.

- `plan/2026-08-17-merge-library-examples/plan.md`
- `plan/log.md` (close-out entry only)
- `apps/editor/src/examples/common-source-amplifier.icproj.json`
- `apps/editor/src/examples/two-stage-op-amp.icproj.json`

- Read-only: `main`, the committed Library examples implementation, and the
  GitHub Actions result for the review branch
- Shared: repository mainline delivery gate and branch protection

## Work

1. Record the integration target and run the required clean local mainline
   check.
2. Apply the repository's deterministic JSON formatting when the mainline
   formatter identifies a bundled example asset.
3. Create or update a review PR, wait for required remote checks, then merge
   it into `main` through the remote provider.
4. Confirm the merged `main` ref and record the factual outcome.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- GitHub Actions required checks on the review PR
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target integrates already-tested commits without changing
  application behavior.
- Existing protection: `pnpm ci:check` re-runs the protected static, unit,
  release, and browser contracts on the rebased review branch.

## Commit Intent

Commit the integration record as part of the review branch before mainline
validation and merge.

## Outcome

Pending.
