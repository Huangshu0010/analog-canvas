# Expand Virtuoso-Style Wire Editing

## Goal

Remove the three connected interaction limitations reported after the authoring
fidelity pass: allow a Wire session to place bends and terminate at an arbitrary
grid point, allow direct selection and perpendicular movement of any route
segment, and make Delete remove a connected instance safely without corrupting
the remaining Net graph.

## Dirty-State Decision

The worktree began clean on `main...origin/main` at commit `62b750d`.

## Owned Files

- `plan/2026-08-07-expand-wire-editing/plan.md`
- `plan/log.md`
- `apps/editor/src/**`
- `apps/editor/e2e/**`
- `packages/derived/src/**`
- `packages/edit-engine/src/**`
- `packages/agent-adapter/src/**`
- `fixtures/agent-api/**`
- `docs/specs/editor-interaction.md`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/edit-engine.md`
- `docs/specs/agent-api.md`
- `docs/user/getting-started.md`
- `playwright.config.ts`

## Read-Only Files

- `packages/model/src/**`
- `lib/circuit.vss`
- `netlists/**`
- completed plans

## Reference Findings

- Cadence's current VSE datasheet lists move, stretch, copy, and delete as
  first-class editing operations and describes sophisticated assisted wiring.
- Cadence public support material demonstrates Wire draw modes; its public
  community guidance distinguishes one-segment selection from whole-wire
  selection and describes partial-selection wire stretching without forced
  rerouting.
- Empyrean's Aether material confirms a productivity-oriented custom schematic
  editor with real-time electrical checks, but does not publicly specify exact
  pointer gestures. We therefore adopt the established custom-IC interaction
  pattern without claiming an exact proprietary clone.

## Interaction Decision

- While wiring, a blank-canvas click fixes the next orthogonal bend; double
  click or Enter ends at the current grid point as a dangling Junction.
- Clicking a Route selects the nearest segment. Dragging its contextual handle
  moves that segment perpendicular to itself while keeping endpoints and other
  vertices stable; protected segments reject atomically.
- Delete on an instance converts each routed pin endpoint to a dangling
  Junction at the former pin coordinate, disconnects all of its terminals,
  removes attached instance annotations, then removes the instance. Remaining
  wiring and Net identity are preserved rather than silently discarded.

## Validation

- focused derived/Edit Engine/editor tests
- TypeScript and full Vitest
- Playwright arbitrary wire termination, multi-bend, segment movement, and
  connected-instance deletion flows
- Agent artifact checks, build/release gates, Markdown checks
- `git diff --check` and repository status

## Experience Signal

The strict `remove_instance` precondition was correct at the engine boundary but
insufficient as a user command. The resolution is a visible compound semantic
transaction that preserves wires, not weakening the low-level invariant. This
may be worth extracting as a reusable UI/engine-boundary lesson if requested.

## Outcome

Implemented the agreed custom-IC interaction model. Wire sessions accept free
sources, persistent transient bends, and arbitrary dangling endpoints; any
Route segment can be selected and moved perpendicular to itself; and deleting
connected instances preserves former pin locations as routed Junctions. The
Agent schema remains on the same Edit Engine through additive `add_junction`
`createNet` support.

Validation passed: formatting, reference pins, Agent artifacts, TypeScript, 105
Vitest tests in 31 files, 12 Playwright flows, workspace/release build,
performance budgets, Phase 7 export goldens, PWA icons, release smoke, Markdown
links/fences, and `git diff --check`.

## Commit Intent

Commit as `Expand direct wire editing`.
