---
status: completed
experience: none
---

# Prune routine completed plan records

## Goal

Reduce repository history noise by removing selected archived micro-target plans
whose factual outcome is already retained in `plan/log.md` and Git. Preserve
plans that remain useful as architectural, migration, delivery, integration,
or unresolved-decision records.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/plan-lifecycle-hygiene...origin/codex/plan-lifecycle-hygiene
```

The worktree is clean. This target owns only a reviewed shortlist of archived
routine plans under `plan/archived/2026-08/`, the archive retention policy, its
own plan, and its factual log entry. It does not remove active, candidate,
legacy-metadata, architecture, schema/migration, CI/release/deployment,
cross-branch integration, or web-agent-session plans.

- selected `plan/archived/2026-08/<target>/plan.md` directories
- `plan/README.md`
- `plan/archived/README.md`
- `plan/2026-08-13-prune-routine-plan-records/plan.md`
- `plan/log.md`

### Reviewed deletion set

- `2026-08-11-calibrate-bjt-arrow-template`
- `2026-08-11-calibrate-diode-and-voltage-amplifier`
- `2026-08-11-calibrate-ideal-switch`
- `2026-08-11-close-bjt-arrow-seams`
- `2026-08-11-close-ideal-switch-blade-contact-gap`
- `2026-08-11-correct-switch-lead-contact-geometry`
- `2026-08-11-fix-switch-bjt-joints`
- `2026-08-11-rename-ideal-switch-open-switch`
- `2026-08-11-use-pmos-style-pnp-arrow`
- `2026-08-12-calibrate-capacitor-plates`
- `2026-08-12-close-vdd-stem-bar-seam`
- `2026-08-12-contract-capacitor-length-10`
- `2026-08-12-expand-capacitor-length-30`
- `2026-08-12-expand-capacitor-user-tuning`

## Work

1. Delete the reviewed 14-plan set only: resolved, single-purpose visual
   calibration, naming, or narrow geometry-fix plans with an Outcome and Git
   history.
2. Verify that each selected target has a factual `plan/log.md` entry, then
   delete its exact archived directory rather than rewriting its historical
   body.
3. State the retention rule: logs and Git retain routine facts; archived plans
   are reserved for durable design, migration, delivery, and integration
   context.

## Validation

- every deleted plan had `status: completed`, `experience: none`, an Outcome,
  Git history, and a matching factual log entry
- no active, candidate, legacy-metadata, architecture, migration, delivery,
  integration, or web-agent plan is deleted
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
docs(plan): prune routine completed records
```

## Outcome

Deleted the reviewed 14 routine calibration, naming, and narrow geometry-fix
plan bodies. Each had resolved current metadata, an Outcome, Git history, and a
matching factual log entry. Retained plans include architecture, migrations,
delivery/CI, deployment, integration, web-agent sessions, active work,
candidate experience signals, and legacy-metadata records. The plan retention
rule now makes this distinction explicit.

Validation: reviewed-deletion audit and `git diff --check` passed.
