---
status: completed
experience: none
---

# Connectivity roadmap recovery C0

## Goal

Reconcile the accepted connectivity/routing roadmap with the additive prototype
commits already on `roadmap/connectivity-routing-debugging`. Preserve the
historical target plans and commits, but make the remaining work, corrected
contracts, and delivery gates unambiguous before more production migration.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This documentation target owns:

- `docs/roadmap/connectivity-routing-debugging-plan.md`
- `docs/adr/0013-project-connectivity-index.md`
- `docs/adr/0014-resolved-route-geometry.md`
- `docs/adr/0015-object-locator-and-diagnostic-envelope.md`
- `plan/2026-08-12-connectivity-recovery-c0/plan.md`
- `plan/log.md`

Read-only evidence includes the additive R0–R10 modules and their historical
target plans. No production TypeScript or persisted schema changes occur in
this target.

## Work

1. Add one current-state table that distinguishes completed additive milestones
   from the still-open roadmap work packages.
2. Record the corrected C0–C10 execution sequence and its dependency gates.
3. Amend ADR language where the initial implementation exposed a contract
   mismatch: shared locator ownership, revision-scoped route segments, and
   cache/geometry claims that are not yet implemented.
4. Preserve history: do not rewrite prior target plans or claim their commits
   did not happen.

## Validation

- Confirm every original R0–R10 exit condition maps to a current recovery wave.
- Confirm all links to active plans/ADRs resolve.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
docs(roadmap): reconcile connectivity delivery status
```

## Outcome

Reconciled the master roadmap without rewriting historical target records. The
roadmap now labels each R0–R10 result as a retained prototype, active work, or
a consumer-gated cleanup, and defines C0–C10 recovery waves. ADR 0013–0015 now
distinguish their accepted end-state contracts from the current additive
implementation, including cache/geometry, segment-remap, and canonical
locator-ownership boundaries.

Validation: reviewed the roadmap/ADR cross-references and ran `git diff --check`.
No production behavior changed.
