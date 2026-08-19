---
status: completed
experience: none
---

# S0 Schema-14 Netlist Protocol Decision

## Goal

Record the accepted, single schema-14 target contract that unlocks Stage 1
implementation: typed Instance netlist facts, formal parameters, external
subcircuit definitions, and direct schema-13 compatibility. The decision must
preserve the current GUI's visible behavior and must not introduce simulation,
PDK, layout, or a public Agent release.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan [ahead 17, behind 6]
```

The worktree is clean. The ahead/behind divergence is the deliberate rebase of
this branch onto `origin/main`; the eventual branch update requires
`git push --force-with-lease`, never an unchecked force push.

Owned paths:

- `docs/adr/0027-stage-1-netlist-authoring-protocol.md`
- `docs/adr/README.md`
- `docs/current/README.md`
- `plan/2026-08-19-s0-schema14-netlist-protocol-decision/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Read-only shared dependencies:

- `docs/roadmap/stage-1-schematic-foundation.md`
- ADR 0022–0026 and current model, Edit Engine, editor-interaction, and
  netlist-export specifications
- schema-13 model/protocol/editor implementation and existing hierarchy
  contracts

## Work

1. Add an accepted ADR that specifies one schema-14 runtime shape and one
   schema-13-to-14 direct adapter, including the legacy-property audit gate and
   ambiguity failure behavior.
2. Record the single authority for instance facts, descriptor metadata,
   annotation projections, non-emitting markers, Cell formal parameters, and
   external subcircuit definitions without changing current GUI interaction.
3. Link the decision into the current documentation map and ADR index, then
   record the factual plan/log/audit close-out.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Evidence: this target records the architectural boundary only; it changes no
  executable schema, migration, editor behavior, or generated artifact. The
  next implementation target owns focused model/protocol regression tests.

## Commit Intent

Commit as:

```text
docs(adr): define stage 1 netlist authoring protocol
```

## Outcome

Added ADR 0027 as the accepted schema-14 netlist-authoring decision. It fixes
the single persisted authority, v13-to-v14 direct-migration boundary,
descriptor/property projection rules, hierarchy external-definition shape, and
GUI-default preservation rule before code work begins. `pnpm docs:check`,
`pnpm test:impact -- --base origin/main`, and `git diff --check` passed.
Commit and safe force-with-lease push are recorded in Git and `plan/log.md`.
