---
status: completed
experience: none
---

# Audit resolved-geometry consumer migration and project gates

## Goal

Record the post-migration compatibility boundary with evidence: broad regression
tests, performance gate, and a direct-consumer audit. Do not remove lower-level
geometry primitives or claim all roadmap work is complete.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree was clean. The broad E2E audit exposed duplicate React keys from
visual diagnostic envelopes with one primary route and different related
objects, so this target expands to the small identity repair required to make
the audit green. Source consumers and the public geometry contract remain
read-only.

- `packages/derived/src/diagnostics/diagnostic.ts`
- `packages/derived/src/diagnostics/diagnostic.test.ts`
- `docs/roadmap/connectivity-recovery-status.md`
- `plan/2026-08-12-connectivity-recovery-c10b/plan.md`
- `plan/log.md`

Read-only: resolved geometry, route primitives, editor/Agent consumers and
performance scripts.

## Work

1. Audit remaining production `routePolyline()` consumers and classify them as
   derivation/mutation primitives versus unmigrated read consumers.
2. Repair visual envelope identity so distinct related-object observations do
   not collide in the diagnostic UI.
3. Run broad unit, E2E and performance gates after shared consumer migration.
4. Update factual recovery status, including the remaining cleanup boundary.

## Validation

- workspace unit suite, E2E suite and performance gate
- static consumer audit
- `git diff --check` and status

## Commit Intent

```text
docs(roadmap): audit resolved geometry migration
```

## Outcome

The audit found and repaired a visual-envelope identity collision that caused
duplicate React keys for separate observations sharing a primary route. The
static consumer audit confirms the remaining `routePolyline()` calls are
geometry derivation, route-anchor/drafting compatibility, or Edit Engine
mutation/validation; none was deleted by assumption.

Validation passed: 569 workspace unit tests, 80 editor E2E tests, the
500-instance performance gate, workspace typecheck, and `git diff --check`.
