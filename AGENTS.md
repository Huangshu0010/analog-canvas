# Agent Working Rules

This repository uses a plan-log-experience workflow for Agent-assisted work.
Treat the repository as an engineering project: bounded targets, explicit
ownership, risk-proportional validation, and durable factual logs. Reusable
experience is extracted separately only when a human requests it.

## Operating Discipline

Before starting a target:

1. Run `git status --short --branch` from the repository root.
2. Audit dirty state by ownership:
   - Proceed normally when the worktree is clean.
   - When it is dirty, identify whether each changed path belongs to the
     current target, the user, another worker, or an earlier target.
   - Unrelated dirty paths do not automatically block work.
   - Stop before editing when dirty paths overlap the target's owned files,
     ownership is unclear, or a dirty shared contract affects the target.
   - Record the decision in the target plan when proceeding with unrelated
     dirty files present.
3. Identify the target owner, goal, expected files, shared dependencies, and
   validation surface.
4. Read `README.md`, `plan/README.md`, and any closer domain instructions.
5. Review validation intent before editing:
   - Run `pnpm gate:plan -- --path <expected-path>` for the expected owned
     paths when practical.
   - Expand the selected commands and identify platform, release, generated-
     artifact, and golden-state assumptions.
   - Record the decision under `## Gate Review` in the target plan.

## Before Editing

Create or update a target plan before editing tracked files:

```text
plan/<date-goal-slug>/plan.md
```

Start it with the machine-readable state block from
`plan/target-plan.template.md`. `status` is one of `active`, `blocked`,
`completed`, or `superseded`; `experience` is one of `none`, `candidate`,
`extracted`, `rejected`, or `deferred`. These fields are the only current-state
authority. Do not add an empty `Experience Signal` section.

The plan must state the goal, dirty-state decision, ownership boundary,
expected work, validation, and commit intent. Name shared dependencies and
read-only paths when they create a credible overlap risk. Do not edit outside
the owned set without updating the plan first.

## During Work

- Keep each target small and reviewable; exclude unrelated cleanup.
- Define a target by one ownership and validation boundary, not by every
  visible symptom. Closely related micro-fixes that share files, contracts,
  and validation belong in one target; independent changes do not.
- Protect shared contracts, generated artifacts, binary assets, and user-owned
  work unless the plan explicitly claims them.
- Update the plan before expanding scope or taking on a new dependency.
- Regenerate the advisory plan from the real diff with
  `pnpm gate:plan -- --base <base-ref>` before expensive validation. If the
  actual selection differs materially from the recorded Gate Review, update
  the plan before proceeding.
- Run `pnpm gate:preflight -- --base <base-ref>` before affected browser,
  build, release, or complete gates. Use
  `pnpm gate:affected -- --base <base-ref>` as the normal automated development
  validation after focused implementation checks.
- Prefer the smallest deterministic validation that covers changed behavior,
  direct dependencies, and credible failure risks.
- Add tests when behavior changes, a regression needs protection, or a
  contract is best demonstrated automatically. Do not add tests that merely
  restate an implementation.
- Record `## Test Impact` in every implementation target plan: name changed
  tests and protected contracts, or use `Decision: no-test-change` with
  evidence that behavior is unchanged or protected elsewhere. Run
  `pnpm test:impact -- --base <base-ref>` before delivery; see
  `docs/testing/README.md` and its contract matrix.
- Keep one primary test layer per behavior. A test mentioning retired input is
  not automatically dead: retain reachable rejection, migration, history, and
  safety boundaries until their replacement is explicit.
- Do not run a full suite by default. Expand from focused checks when the
  change crosses shared contracts or subsystems, carries broader risk, or a
  project gate requires it.
- Use `pnpm test:local <test-paths>` for affected unit contracts and
  `pnpm test:e2e:local <spec-paths> [--grep <pattern>]` for affected
  browser behavior. Both commands cap local concurrency.
- Use `pnpm verify:branch` when a completed branch crosses enough workspace
  boundaries to justify static checks, all unit tests, one build, and the
  production smoke check. It is not the mainline delivery gate.
- Gate planning is advisory in this phase. It does not authorize skipping the
  canonical mainline gate or any required GitHub check. Gate-policy changes and
  unclassified non-documentation paths require the full fallback.
- Record unresolved questions in the plan or a review note.

## Circuit Asset Rules

- Keep each circuit fixture in its own `netlists/<circuit-name>/` directory.
- Preserve explicit `.subckt` interfaces and instance pin order. Interface
  changes are shared-contract changes and require checking every caller.
- Keep local model files beside the netlist that includes them unless a plan
  intentionally introduces a shared model library.
- Do not claim electrical correctness from syntax inspection alone. If the
  target changes electrical behavior, name the simulator, models, analyses,
  corners, and acceptance criteria used—or record why simulation is blocked.
- Never silently replace foundry or vendor model data with illustrative
  values. Label topology-only fixtures and simplified models clearly.

## After Work

Before considering a target complete:

1. Run the validation listed in the target plan. A full suite is required only
   when justified by breadth, risk, or project policy.
2. At minimum, run `git diff --check` and `git status --short --branch`.
3. Update `plan/log.md` with target, changed areas, validation, and commit
   status.
4. Record a concise outcome, set `status: completed`, and set `experience` to
   `none` or `candidate`. Never use a blank signal as a placeholder.
5. Review the diff, stage only intended files, then commit and push according
   to branch policy.
6. Do not automatically extract a reusable lesson. When a human asks, draft a
   candidate under `docs/experience/` with supporting evidence for the human
   to accept, edit, or reject.

## Mainline Delivery Gate

Focused validation is the normal development loop. It is not sufficient by
itself to deliver a non-document change to `main`.

Before a non-document change is merged or pushed to `main`:

1. Start the canonical CI check from a clean dependency/build state:
   `pnpm install --frozen-lockfile` followed by `pnpm ci:check`.
2. Push a review branch and wait for the corresponding GitHub Actions required
   checks to finish successfully.
3. If a remote check fails, keep the target active: inspect its log, repair the
   reported cause, and repeat verification. A successful `git push` is not a
   completed delivery.

Do not bypass the gate by weakening, skipping, or deleting a failing check.
When a test or golden is obsolete, demonstrate that the accepted behavior is
preserved and update the contract deliberately. If the check cannot run in the
local environment, record the limitation and require the remote green result.

## Plan-Log-Experience Mainline

The automatic per-target loop is:

```text
target plan -> bounded implementation -> validation -> factual log -> commit
```

The cross-target experience layer is human-triggered:

```text
human reviews plans, logs, failures, or commits
-> human requests extraction
-> Agent drafts an evidence-backed candidate lesson
-> human accepts, edits, or rejects it
```

A plan owns intent, boundaries, current state, and its concise outcome. Git
owns the exact change and commit evidence. The log owns a short cross-target
factual index and must not reproduce the plan. An experience note owns only a
transferable judgment supported by evidence. An Agent may set
`experience: candidate` for a repeated failure, contradicted
rule, unsafe shortcut, or validation gap, but the human decides whether it is a
lesson.

## Boundary and Hygiene Rules

- Do not mix unrelated targets in one plan, log entry, or commit.
- Do not mix reusable workflow changes with project artifacts unless the plan
  explains why they must land together.
- Do not use model confidence as the only quality gate when deterministic
  validation or human review is available.
- Do not delete unresolved plans or review notes to make the repository appear
  clean.
- A tracked plan with `status: completed` may be archived according to project
  policy after its work is committed. Keep active, blocked, unresolved, and
  superseded-before-implementation plans visible.
- Before archiving a completed plan with `experience: candidate`, ask a human
  whether to extract, reject, or defer the lesson. `none`, `extracted`,
  `rejected`, and explicitly `deferred` are resolved dispositions.
