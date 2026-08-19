---
status: completed
experience: none
---

# Stage 1 schematic foundation roadmap

## Goal

Record the current-product roadmap for completing schematic authoring and its
netlist-semantic foundation before the separate import/export closure stage.
The roadmap must define boundaries, dependencies, delivery slices, acceptance
scenarios, and an exit gate without changing an accepted runtime contract.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan
```

The dedicated worktree is clean and starts from `main` at `6a899fa`. The
separate root worktree and its Cell-symbol target remain outside this target.

Owned paths:

- `docs/roadmap/stage-1-schematic-foundation.md`
- `docs/roadmap/README.md`
- `plan/2026-08-19-stage-1-schematic-foundation-roadmap/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Read-only shared dependencies:

- current model, device, edit-engine, derived-connectivity, hierarchy,
  netlist-IR, and editor implementations
- accepted specifications and ADRs under `docs/specs/` and `docs/adr/`
- the separate Stage 2 import/export closure, which this roadmap may identify
  but must not design as part of Stage 1

## Work

1. Audit which schematic and netlist-semantic foundations already exist on
   `main`, and avoid planning their replacement.
2. Define Stage 1 authority boundaries and explicitly exclude simulation,
   PDK, layout, and dialect-text round-trip implementation.
3. Split Stage 1 into bounded work packages for instance netlist properties,
   reference planning, bulk editing, Wire/Net closure, hierarchy/subcircuit
   facts, and preflight/DesignNetlistIR acceptance.
4. Record deterministic acceptance scenarios, performance expectations,
   dependency order, and the handoff contract to Stage 2.
5. Update the roadmap index, root-plan audit, and factual maintenance log.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target adds proposed roadmap and factual planning records only;
  it changes no executable behavior or accepted normative contract. Later
  implementation targets must name their primary unit, cross-module, browser,
  migration, and performance contracts separately.

## Commit Intent

Commit as:

```text
docs(roadmap): define stage 1 schematic foundation
```

## Outcome

Recorded a proposed Stage 1 roadmap that freezes schematic/netlist authority,
divides delivery into seven dependency-ordered work packages, defines
representative acceptance scenarios and performance evidence, and hands a
deterministic `DesignNetlistIR` contract to the later import/export stage.

Validation passed:

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- final branch status review
