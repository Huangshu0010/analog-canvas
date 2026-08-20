---
status: completed
experience: none
---

# Record Accepted Stage 1 Data And GUI Contracts

## Goal

Update the Stage 1 schematic-foundation roadmap with the accepted implementation recommendations: remove the persisted electrical property branch while preserving current Properties GUI behavior, derive rather than persist annotation management state, choose the minimal non-emitting representation, reuse current extraction, and make the remaining schema/bulk/hierarchy preparation gates explicit.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The dedicated planning worktree is clean. This documentation-only target owns:

- `docs/roadmap/stage-1-schematic-foundation.md`
- `plan/2026-08-19-stage-1-accepted-contracts/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only contract evidence:

- `packages/model/src/schema/**`
- `packages/devices/src/**`
- `packages/edit-engine/src/**`
- `packages/netlist/src/**`
- `packages/project-protocol/src/**`
- `apps/editor/src/features/**`
- `apps/editor/e2e/**`

Shared dependencies are schema-13 compatibility, the rolling previous-version adapter, current Properties and canvas-text behavior, transaction resource limits, hierarchy terminal authoring, and netlist extraction diagnostics. No implementation or test path is owned.

## Work

1. Clarify data-protocol removal versus Properties GUI compatibility and retain current immediate interaction semantics.
2. Replace persisted annotation mode with a canonical derived classifier and keep canvas text presentation-only.
3. Freeze the minimal non-emitting, provenance mapping, hierarchy binding, external definition, and analyzer choices.
4. Add an implementation-preparation gate for schema migration, characterization, bounded bulk editing, and hierarchy GUI integration.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target only records accepted planning contracts; implementation
  behavior is unchanged.
- Existing protection: documentation validation and test-impact analysis cover
  the modified surface.

## Commit Intent

Commit as:

```text
docs(roadmap): lock accepted stage 1 contracts
```

## Outcome

Recorded the accepted Stage 1 contracts in the roadmap. The final plan now
separates removal of the persisted electrical property branch from preservation
of current Properties GUI behavior; derives canonical versus hand-edited
instance text without a persisted mode; keeps canvas text presentation-only;
chooses absent netlist data for non-emitting markers; defines the bounded bulk
edit and resolved hierarchy binding shapes; reuses the current netlist
extraction as the sole analyzer; and adds an S0 gate for one schema-14 release,
migration-corpus review, GUI characterization, bulk specification, and terminal
order GUI integration.

Validation passed:

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
