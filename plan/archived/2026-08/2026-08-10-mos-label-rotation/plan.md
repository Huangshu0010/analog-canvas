---
status: completed
experience: none
---

# MOS instance-label rotation

## Goal

Keep an explicit NMOS/PMOS instance label on the same semantic side of its
device, with the correct upright SVG text alignment, through repeated 90-degree
rotations and a full 360-degree cycle.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/fix-ci-baseline
```

The worktree is clean. This target continues on the user-selected branch and
owns only the Edit Engine transform behavior, its focused regression, this
plan, and the factual log entry.

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `plan/2026-08-10-mos-label-rotation/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/render-svg/src/default-instance-label-placement.ts`
- `packages/symbols/src/razavi-catalog.generated.ts`
- the persisted Annotation schema and typed edit union

## Work

1. Preserve the existing exact outside-edge clearance behavior.
2. When an instance-label anchor lies inside a symbol viewBox, retain its
   semantic side from its normalized local displacement instead of discarding
   the side and forcing `middle` alignment.
3. Add an actual built-in NMOS regression covering 0/90/180/270/360 degrees.

## Validation

- `pnpm exec vitest run packages/edit-engine/src/routing.test.ts packages/render-svg/src/default-instance-label-placement.test.ts`
- `pnpm --filter @icm/edit-engine build`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

The focused tests cover the shared default-placement assumptions and the
transaction path. Typecheck covers the cross-package contract without running
unrelated GUI suites.

## Commit Intent

Commit as:

```text
fix(edit-engine): preserve mos label side through rotation
```

## Outcome

- The Edit Engine now recognizes MOS definitions from their gate/drain/source
  pin roles rather than hard-coded symbol IDs.
- Materialized 4-terminal and dedicated 3-terminal NMOS/PMOS labels retain
  their exact local semantic anchor and recover the correct upright text side
  at 0/90/180/270 degrees. Existing outside-edge clearance behavior for other
  symbols remains unchanged.
- A parameterized regression performs a complete four-step rotation for all
  four built-in MOS forms and verifies position, offset, alignment, and upright
  text rotation at every step.
- Validation passed: 23 focused tests, Edit Engine build, repository typecheck,
  and `git diff --check`.
