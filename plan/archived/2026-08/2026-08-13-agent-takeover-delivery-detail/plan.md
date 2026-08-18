---
status: completed
experience: none
---

# Detailed Browser Agent Takeover Delivery Plan

## Goal

Turn the accepted four-operation Agent-takeover roadmap into an ordered,
implementation-ready delivery plan. It must cover every remaining browser Agent
capability the product needs—typed netlist authority, Project lifecycle,
session recovery, bounded file transfer and import, semantic GUI control,
history, duplication and public-contract proof—while explicitly excluding
simulation, PVT, waveforms/measurements, and SPICE/Spectre/design-netlist
export.

## State and Ownership

Start state:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean. This is a documentation and execution-planning target;
it does not change the model, Agent transport, generated artifacts, fixtures,
or production behavior. The previous M0--M2 schema migrations are read-only
evidence, not a request to restore any compatibility path.

Owned paths:

- `docs/roadmap/agent-takeover-v2-completion-plan.md`
- `docs/roadmap/README.md`
- `plan/2026-08-13-agent-takeover-delivery-detail/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `docs/adr/0019-four-operation-agent-golden-contract.md`
- `docs/specs/agent-api.md`, `docs/specs/web-agent-session.md`, and
  `docs/specs/project-file-format.md`
- `packages/model`, `packages/edit-engine`, `packages/agent-adapter`,
  `apps/editor`, `worker`, and generated Agent artifacts

## Work

1. Record the verified current baseline: M0 power, M1 Ports, and M2 RichText /
   VisualAnchor are complete; the remaining live dual authority is typed
   netlist facts versus `spice.*` runtime readers/writers.
2. Add detailed, separately deliverable M3--M4 and A1--A6 implementation
   slices: authority boundary, owned modules, transaction/API shape, migration
   and error policy, tests, and exit gates.
3. Define ordering constraints that prevent a Project/file/session feature from
   creating a second mutation, hierarchy, or transport authority.
4. State the required documentation/spec reconciliation and a scoped delivery
   matrix so that completed code and proposed work cannot be mistaken for the
   same status.

## Validation

- `pnpm docs:check`
- `pnpm references:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
docs(agent): detail takeover delivery slices
```

## Outcome

Recorded the verified M0--M2 baseline and the remaining M3 runtime
`spice.*` authority gap. The roadmap now defines schema-v8 typed netlist and
immutable provenance, compatibility-corpus retirement, one Project controller,
session state machine, scoped File Resource/import approval, semantic editor
control, project-aware history/duplication, and external-contract hardening.
Simulation, PVT, waveform/measurement data, and SPICE/Spectre/design-netlist
export remain explicitly out of scope.

Validation passed: Prettier for the changed Markdown, `pnpm docs:check`,
`pnpm references:check`, and `git diff --check`.
