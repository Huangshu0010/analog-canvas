# Release GUI interaction batch

## Goal

Publish the user-authorized accumulated GUI interaction, drafting, selection,
and formal-rendering changes through a reviewed pull request and merge it into
`origin/main`.

## Dirty-State Decision

The worktree contains modifications from multiple completed bounded targets.
The user explicitly requested that **all** current modifications be included
in one PR and merged to remote `main`. This release target therefore owns the
complete current dirty set and the untracked target plans/helpers listed by
`git status` at release start.

## Scope

- Editor interaction, selection, shortcut, drafting, and E2E changes.
- Model/derived/rendering support for current drafting and wire behavior.
- Interaction specification, target plans, and factual maintenance log.

## Validation

- Workspace format, typecheck, and test gates.
- Editor production build.
- Review staged diff and run `git diff --check`.

## Release Gate Result

The editor build and focused interaction checks pass. Full workspace gates
currently fail on pre-existing Razavi catalog type expectations (`leadsPx`),
out-of-date visual golden/style assertions, and six pre-existing formatting
files. The user explicitly authorized publication of the complete current
batch despite this known baseline debt; the PR must state it rather than claim
a green full suite.

## Commit and Merge Intent

Create a release PR from `codex/optimize-iteration`, merge it into
`origin/main`, and record the resulting commit/PR in the maintenance log.
