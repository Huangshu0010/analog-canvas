---
status: completed
experience: none
---

# Make VDD a Drawn Power Rail

## Goal

Replace fixed VDD-symbol placement with a two-click horizontal VDD rail
construction: the user chooses its start and length, then may route into any
point on the thick bar while the resulting VDD branches remain dotless.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/vdd-power-rail...origin/codex/vdd-power-rail
```

The worktree is clean. This target corrects the immediately preceding VDD
target, whose `VDD.P`-started wire behavior does not match the accepted UI
interaction. It owns:

- `apps/editor/src/app/App.tsx`, `apps/editor/src/styles.css`
- `apps/editor/src/features/component-insert/vdd-rail.ts` and tests
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/edit-engine/src/routing-planner.ts` and focused wiring tests
- `packages/derived/src/style-profile.ts`
- `docs/specs/editor-interaction.md`
- the prior `plan/2026-08-12-vdd-power-rail/plan.md` status record
- `plan/2026-08-12-drawn-vdd-rail/plan.md` and `plan/log.md`

Read-only/shared dependencies:

- `RoutePresentation: "power-rail"`, VDD power-domain validation, and formal
  SVG dot suppression from the preceding target.
- `power-label` Junction attachment preserves VDD's existing virtual
  connectivity convention while leaving the visible rail a real Route.

## Work

1. Change library VDD placement to a two-click horizontal rail constructor.
2. Persist an unplaced VDD semantic instance, its global VDD Net, two dotless
   route-anchor endpoints, one `power-rail`, and a movable VDD power label.
3. Ensure a Route tap carries the rail style through the two split rail pieces
   but starts the external branch as an ordinary wire.
4. Add focused construction and wire-tap tests; document that the earlier P
   pin workflow was superseded.

## Validation

- focused VDD construction, wiring, Edit Engine, renderer, and editor tests
- workspace typecheck; Agent artifacts and symbol catalog checks
- targeted Prettier, `git diff --check`, and `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): construct VDD as a drawn power rail
```

## Outcome

Superseded the earlier `VDD.P` wire-start interaction. Selecting VDD now
enters a two-click horizontal rail constructor with no fixed VDD glyph preview.
The construction transaction persists an unplaced VDD anchor, global VDD Net,
two route-anchor endpoints, a `power-rail`, and a VDD power label at the visual
right end. The rail and preview use `3.24` logical units, matching the reviewed
filled VDD bar; a route tap carries the rail through its split pieces but makes
the new exterior branch a normal wire.

Validation passed: 59 focused unit tests; workspace typecheck; Agent-artifact
and symbol-catalog checks; editor production build; focused Playwright VDD
construction flow; targeted Prettier; and `git diff --check`. Ready to commit
on `codex/vdd-drawn-rail`.
