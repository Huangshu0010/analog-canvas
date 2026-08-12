---
status: completed
experience: none
---

# Archive Completed Foundation Plans

## Goal

Create a documented `plan/archived/` area and move a conservative first batch
of completed, committed foundation/phase-wrapper plans out of the active plan
root. Reduce active-plan noise without hiding blocked, unresolved, pending, or
experience-bearing work.

## Dirty-State Decision

The active branch is `agent/fix-ci-baseline`. The worktree contains an unrelated
CI repair target and the completed-but-uncommitted visual-document redirect
cleanup. Their implementation, documentation, and plan paths remain read-only.
`plan/log.md` is already modified by the redirect cleanup; this target will
update three archived path references and append one isolated entry without
rewriting the other target's hunk.

The archive candidates are tracked, clean directories. None overlaps the active
CI plan, route-interaction work, or redirect-cleanup plan.

## Owned Paths

- `plan/README.md`
- `plan/archived/README.md`
- `plan/archived/2026-08/**`
- the following source directories, moved without content changes:
  - `plan/2026-08-06-bootstrap-repository-workflow/`
  - `plan/2026-08-06-document-overall-product-plan/`
  - `plan/2026-08-07-flatten-overall-product-plan/`
  - `plan/2026-08-07-establish-execution-docs/`
  - `plan/2026-08-07-execute-phase-0/`
  - `plan/2026-08-07-execute-phase-1/`
  - `plan/2026-08-07-execute-phase-2/`
  - `plan/2026-08-07-execute-phase-3/`
  - `plan/2026-08-07-execute-phase-4/`
  - `plan/2026-08-07-execute-phase-5/`
  - `plan/2026-08-07-execute-phase-6/`
  - `plan/2026-08-07-execute-phase-7/`
- three current-location references and one isolated appended entry in
  `plan/log.md`
- `plan/2026-08-10-archive-completed-foundation-plans/plan.md`

## Read-Only Paths

- all other `plan/*/` directories
- `plan/2026-08-07-checkpoint-integrated-development/` and
  `plan/2026-08-07-execute-phase-8/`, which contain experience signals
- Phase 9, superseded-before-implementation, blocked, pending, and unresolved
  plans
- `docs/**`, implementation code/assets, and concurrent target plans

## Shared Dependencies

- repository plan/log/experience policy in `AGENTS.md`
- commit history proving each archived target was committed
- `plan/log.md` as the durable factual summary

## Archive Criteria

A plan may move to `plan/archived/` only when all are true:

1. implementation is complete and represented by a Git commit;
2. validation and outcome are recorded in the plan or `plan/log.md`;
3. it has no unresolved decision, blocked follow-up, or pending coordination;
4. it has no unreviewed experience signal requiring a human decision;
5. no active target owns or depends on its original path.

Failed, blocked, unresolved, proposed-only, superseded-before-implementation,
and active/pending plans remain visible in the plan root.

## Expected Work

1. Add archive policy, navigation, and a dated batch index.
2. Move the twelve verified candidates without editing their contents.
3. Update the three factual log references to their current archived paths.
4. Verify archived files are byte-identical to their pre-move Git blobs and
   the plan root no longer contains the moved directories.

## Validation

- compare each archived `plan.md` hash with `HEAD` at its original path
- verify all twelve source directories are absent and destinations exist
- scan the repository for stale external references to the moved paths
- run `git diff --check` and final status review

## Commit Intent

Commit with the second archive batch and protocol clarification after the user
explicitly authorized taking ownership on the current branch.

## Outcome

- Added the archive policy and monthly layout, then moved the 12 approved plans
  into `plan/archived/2026-08/`.
- Preserved every moved `plan.md` byte-for-byte relative to its original
  `HEAD` blob.
- Updated the three external current-location references in `plan/log.md`.
- Confirmed all old source directories are absent, all destinations exist, and
  local Markdown links resolve. Old-root strings remain only where archived
  plans or this plan intentionally record their historical source paths.
- Left all unresolved, pending, proposed-only, superseded-before-
  implementation, and experience-bearing plans in the active plan root.
- The user later authorized taking ownership on `agent/fix-ci-baseline`; the
  first batch now shares one archive/protocol ownership and validation boundary
  with the completed second batch and is ready for combined staging.
