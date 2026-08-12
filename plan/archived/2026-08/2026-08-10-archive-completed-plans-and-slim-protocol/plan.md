---
status: completed
experience: none
---

# Archive Completed Plans and Slim the Planning Protocol

## Goal

Archive a second conservative batch of completed plans and remove the protocol
ambiguities that made archival require manual interpretation. Preserve all
historical plan content and all reusable methodology.

## Dirty-State and Ownership

The active branch is `agent/fix-ci-baseline`. The worktree contains unrelated
editor text-editing work and the previously authorized documentation cleanup
and first archive batch. Those implementation paths remain read-only. This
target may extend the already-owned plan/archive/log documentation, but it will
not stage or commit onto the unrelated branch.

Owned paths are `AGENTS.md`, `plan/README.md`,
`plan/target-plan.template.md`, `plan/archived/**`, this plan, an isolated
entry in `plan/log.md`, current-location links in
`docs/experience/razavi-symbol-construction-and-pixel-calibration.md`, and the
42 source plan directories enumerated in the second-batch archive index.

All application code, specs, concurrent target plans, unresolved plans,
superseded-before-implementation plans, and plans with substantive undecided
experience signals are read-only.

## Shared Dependencies

- repository workflow policy in `AGENTS.md`
- Git history as the source of commit evidence
- each target plan as the source of target status and experience disposition
- `plan/log.md` as the factual cross-target summary
- `docs/experience/` as the only reusable-judgment layer

The archive and protocol changes belong together: the second archive audit
exposed missing status metadata and blank `Experience Signal` sections as the
specific causes of ambiguous retention.

## Work

1. Replace blank optional experience sections with compact required metadata
   for future plans: `status` and `experience`.
2. Keep one template; require only a compact ownership/validation core and add
   detail in proportion to shared-contract or integration risk.
3. Clarify that one target follows an ownership and validation boundary, not
   every visible symptom, and define the non-overlapping authority of plan,
   log, Git, and experience.
4. Move the 42 committed, completed, resolved candidates without editing their
   bodies; update affected current-location links and the archive index.

## Validation

- compare every archived `plan.md` blob with `HEAD` at its original path
- verify all selected sources are absent and destinations exist
- verify every candidate has Git commit evidence and recorded completion
- resolve all local Markdown links affected by the moves
- inspect remaining old-root references and classify intentional history
- run `git diff --check` and final status review

## Commit Intent

Commit the archive moves and protocol revision together after the user
explicitly authorized taking ownership on the current branch.

## Outcome

- Archived 42 completed legacy plans under `plan/archived/2026-08/` without
  changing their bodies; every archived blob matches its original `HEAD` blob.
- Replaced ambiguous blank experience sections for future targets with the
  required `status` and `experience` metadata fields.
- Reduced the required plan body to one compact ownership and validation core;
  risk-specific dependency and coordination detail remains available without
  becoming routine boilerplate.
- Defined non-overlapping authority: plan for boundary/state/outcome, Git for
  exact changes and commits, log for the cross-target factual index, and
  experience for transferable judgment.
- Updated affected current-location links. All checked local Markdown links
  resolve, selected source directories are absent, destinations exist, and
  `git diff --check` passes.
- The user later authorized taking ownership on `agent/fix-ci-baseline`; current
  validation and combined archive/protocol staging are ready to proceed.
