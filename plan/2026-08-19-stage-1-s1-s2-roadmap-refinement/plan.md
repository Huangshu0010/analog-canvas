---
status: completed
experience: none
---

# Refine Stage 1 S1 and S2 roadmap

## Goal

Refine the proposed Stage 1 S1/S2 work packages around three agreed product
decisions: define a minimal descriptor-driven device parameter surface, expose
the netlist Reference as an auto-assigned but user-editable engineering fact,
and converge all instance-property entry points on one typed protocol without
an electrical `Instance.properties` branch.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The dedicated worktree is clean. This documentation-only refinement continues
on the existing Stage 1 planning branch; no implementation or accepted
contract changes are owned.

Owned paths:

- `docs/roadmap/stage-1-schematic-foundation.md`
- `plan/2026-08-19-stage-1-s1-s2-roadmap-refinement/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model`, `packages/devices`, `packages/edit-engine`,
  `packages/netlist`, and current editor Properties implementations
- accepted model, edit-engine, device-protocol, interaction, and netlist specs
  and ADRs; later implementation must update them before changing behavior

## Work

1. Rewrite S1 as authority and property-protocol convergence, including the
   disposition of `Instance.properties`, Reference exposure, projection rules,
   parameter metadata ownership, and granular typed edit requirements.
2. Rewrite S2 as the single descriptor-driven Component Properties surface,
   with the minimal first-party parameter set, arbitrary raw parameters,
   staged commit semantics, and explicit terminal/provenance boundaries.
3. Keep S3 and later work-package scope unchanged, adjusting only dependency
   labels where the renamed S1/S2 deliverables require it.
4. Update the root audit and factual maintenance log.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target refines a proposed roadmap and planning records only; it
  changes no executable behavior or accepted normative contract. Each later
  implementation slice must update its affected model, migration, edit,
  descriptor, Properties, search, clipboard, and extraction contracts.

## Commit Intent

Commit as:

```text
docs(roadmap): refine stage 1 property foundations
```

## Outcome

Refined S1 into authority and property-protocol convergence and S2 into the
single descriptor-driven Component Properties surface. The roadmap now records
the removal path for the electrical `Instance.properties` branch, public but
auto-assigned References, the minimal known-parameter set plus arbitrary raw
parameters, strict Reference/Value projections, granular typed edits, and
staged property commits. Later work-package scope remains unchanged.

Validation passed:

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- final branch status review
