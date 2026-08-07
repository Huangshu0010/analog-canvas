# Execute Phase 8 Direct Manipulation and Manual Authoring

## Goal

Implement the accepted Phase 8 vertical workflow: create components in an
empty Document, select and move one or many objects directly, navigate the
canvas with gestures, wire endpoints and route segments with automatic
crossing/junction semantics, expose the same semantic edits to Agents, and
replace the validation-oriented toolbar with a compact production shell.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. All changes made by this target are owned here.

## Owned Files

- `plan/2026-08-07-execute-phase-8/plan.md`
- `plan/log.md`
- `docs/specs/editor-interaction.md`
- `docs/specs/README.md`
- `docs/specs/edit-engine.md`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/agent-api.md`
- `docs/roadmap/phase-8-direct-manipulation-and-manual-authoring.md`
- `docs/roadmap/README.md`
- `docs/user/**`
- `packages/edit-engine/src/**`
- `packages/agent-adapter/src/**`
- `packages/derived/src/**`
- `packages/symbols/src/**`
- `tools/symbol-review/render-reviewed.mjs`
- `apps/editor/src/**`
- `apps/editor/e2e/**`
- `scripts/agent-api-artifacts.mjs`
- `docs/api/**`
- `fixtures/**phase-8**`
- `fixtures/visual-golden/phase-5-symbol-review.svg`

## Read-Only Files

- `lib/circuit.vss`
- `netlists/**`
- `.reference-src/**`
- `references/**`
- `packages/model/src/**`
- `packages/spice/src/**`
- `packages/project-io/src/**`
- completed Phase 0-7 target plans and roadmap files

## Shared Dependencies

- The persisted Project and Schematic Document schemas remain compatible;
  Phase 8 uses existing Instance, Net, Route, Junction, and source-status data.
- All GUI and Agent mutations continue through `packages/edit-engine`.
- The renderer remains the formal visual source; interaction overlays are
  transient editor SVG layers.
- `lib/circuit.vss` is immutable build-time evidence and never a runtime
  dependency.

## Expected Work

1. Accept compatible Phase 8 revisions of the interaction, Edit Engine,
   connectivity, and Agent API contracts.
2. Add typed instance/topology authoring edits, atomic rollback, source-status
   behavior, history coverage, and Agent permission/parity coverage.
3. Add a categorized component palette and manual instance placement.
4. Implement default pointer selection, rectangle multi-selection, atomic
   multi-move, shortcuts, cursor-centered zoom, and middle-button pan.
5. Implement direct wire sessions whose pass-through intersections remain
   crossings and whose explicit route-segment endpoints create/reuse
   junctions atomically.
6. Consolidate the production header, move infrequent actions into menus or
   contextual controls, and update user/E2E coverage.
7. Run focused checks, expand to release gates because Phase 8 crosses the
   editor, engine, Agent, routing, rendering, and persisted-model boundaries,
   then record evidence and commit.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- focused Vitest tests for Edit Engine, Agent adapter, derived interaction
  helpers, symbols, and editor
- `pnpm test`
- `pnpm build`
- `pnpm agent-api:artifacts:check`
- `pnpm symbols:review:check`
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm pwa:icons:check`
- focused and full Playwright acceptance
- production artifact inspection for obsolete buttons and runtime VSS coupling
- `git diff --check`
- `git status --short --branch`

The broad final gates are justified because topology operations and interaction
changes are shared by GUI, Agent, import-derived Documents, rendering, export,
and release packaging. Focused tests remain the primary implementation loop.

## Experience Signal (for human review)

Playwright's web-server health check inherited the machine HTTP proxy and saw
loopback responses as `502` even while the editor returned `200` locally.
Setting `NO_PROXY=127.0.0.1,localhost` made the seven browser checks reliable;
this is an environment note, not a product workaround.

## Outcome

All expected work and validation above completed. The editor starts with an
empty Project, all human and Agent mutations cross the same typed Edit Engine,
and the Phase 0-7 import/render/export/recovery/release baseline remains green.
The accepted limitations are persisted shortcut remapping, free-standing wire
endpoints, and general multi-elbow handles.

## Commit Intent

Commit as:

```text
Complete Phase 8 direct manipulation
```
