---
status: completed
experience: none
---

# Integrate netlist and test-contract branches

## Goal

Integrate the merged test-contract deduplication from current `origin/main`
into the hidden-surface netlist branch, preserve both accepted contract sets,
validate the combined result, and merge PR #31 into `main`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/netlist-export-system...origin/codex/netlist-export-system
```

The worktree is clean. PR #32 merged the reviewed test-only branch into main as
`6efbf3d`; PR #31 remains open and green against the previous main.

- Owned: merge resolutions in test files touched by both branches
- Owned: generated artifacts only if the integrated contracts require refresh
- Owned: this target plan and `plan/log.md`
- Read-only intent: all product behavior outside the already accepted netlist
  implementation and hidden web surface

## Work

1. Merge current `origin/main` into `codex/netlist-export-system`.
2. Preserve the test-contract ownership reductions while retaining the new
   hidden-netlist-surface assertion and lower-level netlist contract tests.
3. Run focused overlap checks and the canonical clean delivery gate.
4. Push the integrated branch, wait for all PR checks, mark #31 ready, merge it,
   and verify both merge commits are ancestors of remote `main`.

## Validation

- focused editor/netlist unit tests
- focused affected Playwright scenarios
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- all GitHub Actions required checks on PR #31
- post-merge ancestry and clean status checks
- `git diff --check`

## Commit Intent

Commit the merge as:

```text
merge: integrate test contracts into netlist export
```

## Outcome

PR #32 passed all six required checks and merged into `main` as `6efbf3d`.
Merged that main into the netlist branch as `3594c01`; Git resolved the shared
test files without conflict, retaining both the deduplicated contract ownership
and the hidden-netlist-surface browser assertion.

The combined branch passed 49 focused unit tests, two focused overlap browser
scenarios, frozen install, and the canonical `pnpm ci:check`: 112 Vitest files
with 675 tests, builds, performance and export goldens, production/release
smokes, and all 96 Playwright scenarios. The branch is ready for final PR #31
checks and merge into `main`.
