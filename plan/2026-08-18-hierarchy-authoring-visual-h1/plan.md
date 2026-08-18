---
status: completed
experience: none
---

# Hierarchy authoring and visual H1: schema and adaptive Symbol

## Goal

Implement the schema-13 foundation for definition-level hierarchical Cell
symbol presentation: direct schema-12 migration, strict visual intent
validation, direction-aware adaptive derived geometry, one typed edit, and the
Project/Agent/documentation surfaces required to author it without a parallel
mutation or rendering protocol.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/hierarchy-authoring-visual-plan...origin/codex/hierarchy-authoring-visual-plan
?? .worktrees/
```

`.worktrees/` is pre-existing untracked workspace infrastructure and is not
owned by this target. It does not overlap the planned source, test, fixture,
or documentation paths.

This target may edit the schema/version/migration, hierarchical Symbol,
Project structural planning, Agent schema/generated resources, current
protocol documentation, compatibility fixtures, and their focused tests. The
editor interaction layer, Cell Manager, and one-step Cell Port UI remain
read-only H2–H4 work.

The target also owns the corresponding active-target update in
`plan/root-audit.md`.

The already-completed roadmap-record plan
`plan/2026-08-18-hierarchy-authoring-visual-plan/plan.md` is also in scope for
one mechanical Test Impact field correction required by the current checker; no
historical outcome or delivery claim changes.

## Work

1. Advance the current Project format to schema 13 with a direct v12 adapter
   and update current-only documentation/corpus expectations.
2. Add a strict `Document.presentation.cellSymbol` intent and a sole typed
   edit for it, including formal-terminal closure validation.
3. Generate direction-aware, adaptive hierarchy Symbol geometry from Cell
   intent without persisting primitives or using a new renderer.
4. Add a Project planner that updates the definition and preserves existing
   caller connections through shared route geometry semantics.
5. Expose the same structural edit to the Agent boundary and regenerate/check
   checked artifacts.

## Validation

- focused model, project-protocol, symbols, edit-engine, Agent, and renderer
  tests added or updated by this target
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- affected package builds/typecheck; expand to `pnpm verify:branch` before
  H1 delivery because this crosses persisted protocol and editor consumers

## Test Impact

- Decision: tests-updated
- Contracts: rolling v12-to-v13 read compatibility; visual intent closure;
  stable resolver geometry; complete Project transaction/Agent parity; no new
  Route endpoint or persisted generated artwork.
- Primary checks: focused Vitest files for all changed contracts, generated
  resource checks, `pnpm verify:branch`.

## Commit Intent

Commit as:

```text
feat(hierarchy): add adaptive Cell symbol intent
```

## Outcome

Advanced the Project format to schema 13 with a direct schema-12 adapter and
strict definition-level Cell symbol intent. Hierarchical symbols now derive
direction-aware adaptive geometry from stable terminal IDs; the sole new typed
edit is structural/Agent-compatible; and caller Routes follow pin geometry via
the existing `set_route_points` protocol. Updated canonical fixtures, generated
Agent/MCP artifacts, current specs, user compatibility guidance, and ADR 0026.

Focused unit/Agent/documentation tests, schema-13 Project-file Playwright,
`pnpm test:impact -- --base origin/main`, `git diff --check`, and
`pnpm verify:branch` passed (144 test files / 879 tests, full build and
production smoke).
