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

## Before Editing

Create or update a target plan before editing tracked files:

```text
plan/<date-goal-slug>/plan.md
```

The plan must state the goal, dirty-state decision, owned and read-only paths,
shared dependencies, expected work, validation, and commit intent. Do not edit
outside the owned set without updating the plan first.

## During Work

- Keep each target small and reviewable; exclude unrelated cleanup.
- Protect shared contracts, generated artifacts, binary assets, and user-owned
  work unless the plan explicitly claims them.
- Update the plan before expanding scope or taking on a new dependency.
- Prefer the smallest deterministic validation that covers changed behavior,
  direct dependencies, and credible failure risks.
- Add tests when behavior changes, a regression needs protection, or a
  contract is best demonstrated automatically. Do not add tests that merely
  restate an implementation.
- Do not run a full suite by default. Expand from focused checks when the
  change crosses shared contracts or subsystems, carries broader risk, or a
  project gate requires it.
- Record unresolved questions in the plan or a review note.

## Circuit Asset Rules

- Treat `lib/circuit.vss` as binary. Never rewrite, normalize, or inspect it as
  text. Validate modifications in Visio or a compatible application and state
  what was visually checked.
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
4. Review the diff, stage only intended files, then commit and push according
   to branch policy.
5. Do not automatically extract a reusable lesson. When a human asks, draft a
   candidate under `docs/experience/` with supporting evidence for the human
   to accept, edit, or reject.

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

A plan records intent before work. A log records facts after work. An
experience note records a transferable judgment supported by evidence. An
Agent may flag a possible signal—such as a repeated failure, contradicted
rule, unsafe shortcut, or validation gap—but the human decides whether it is a
lesson.

## Boundary and Hygiene Rules

- Do not mix unrelated targets in one plan, log entry, or commit.
- Do not mix reusable workflow changes with project artifacts unless the plan
  explains why they must land together.
- Do not use model confidence as the only quality gate when deterministic
  validation or human review is available.
- Do not delete unresolved plans or review notes to make the repository appear
  clean.
- Completed plans may be summarized in `plan/log.md` and archived according to
  project policy. Keep failed, blocked, or unresolved plans visible.
- Before archiving a completed plan with a possible experience signal, ask a
  human whether they want a lesson extracted.
