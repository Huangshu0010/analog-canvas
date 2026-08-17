---
status: completed
experience: none
---

# Net Contract Unification Plan

## Goal

Define a compact implementation plan that gives Net identity, naming, scope,
power role, hierarchy, authoring, ERC, tracing, and deterministic netlist
export one shared contract without redesigning unrelated routing geometry or
the persisted Project schema prematurely.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

The branch starts from local `main` at `6a86b68`. The untracked `.worktrees/`
directory is repository-local worker infrastructure, is unrelated to this
documentation target, and will remain untouched.

- `plan/2026-08-17-net-contract-unification-plan/plan.md`
- `docs/roadmap/net-contract-unification-plan.md`
- `docs/roadmap/README.md`
- `plan/log.md`

Read-only shared contracts:

- `docs/specs/schematic-model.md`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/netlist-export.md`
- `docs/specs/edit-engine.md`
- `docs/specs/agent-api.md`
- `docs/roadmap/connectivity-routing-debugging-plan.md`
- Current Net, power-domain, connectivity, ERC, and netlist-export code

## Work

1. Characterize the current Net contract and identify contract gaps that make
   repeated power attachments, hierarchy, ERC, tracing, and export disagree.
2. Freeze a minimal target model that separates object identity, electrical
   identity, name scope, power role, and drawing presentation.
3. Define one authoring/planning boundary and a small staged migration with
   explicit compatibility, test, and exit criteria.
4. Keep route geometry, visual styling, and unrelated ERC expansion outside
   this target.

## Validation

- Review links and terminology against the accepted specs and current code.
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- This target changes planning documentation only. The plan names the
  implementation tests required by later targets; it does not change runtime
  behavior or existing contracts in this branch.

## Commit Intent

Commit as:

```text
docs(net): plan unified connectivity contract
```

## Outcome

Added a proposed Net-contract roadmap that preserves the current Project shape,
separates Net object identity, name scope, and power role, defines one named-Net
planner and shared validation boundary, and stages producer, index, ERC,
flightline, export, and legacy-value convergence. The roadmap index links the
new prerequisite. Documentation-only validation and test-impact checks passed.
