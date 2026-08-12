---
status: superseded
experience: none
---

# Add a Razavi VDD Power Rail

## Goal

Let a user draw a VDD supply rail as a thick editable conductor whose branch
Junctions remain electrically real but do not add visual node dots.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean after the preceding, separately committed capacitor
target. This target owns:

- `packages/model/src/schema.ts` and its focused contract tests as needed
- `packages/edit-engine/src/routing-planner.ts` and focused tests
- `apps/editor/src/app/App.tsx`, `apps/editor/src/styles.css`, and focused
  wiring tests as needed
- `packages/render-svg/src/render.ts` and renderer tests
- `fixtures/agent-api/agent-circuit-request.schema.json`
- `fixtures/agent-api/agent-circuit-response.schema.json`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `docs/specs/visual-language.md`
- `docs/specs/connectivity-and-routing.md`
- `plan/2026-08-12-vdd-power-rail/plan.md`
- `plan/log.md`

Read-only/shared dependencies:

- `packages/model/src/power-domain.ts` determines VDD membership from a
  reviewed symbol terminal, not a display name.
- Route/Junction persistence, transactions, Agent schema, clipboard, and
  exporter all consume `RoutePresentation` and formal SVG.

## Work

1. Add a `power-rail` presentation for editable VDD Routes and have a wire
   begun at a VDD terminal select it automatically.
2. Render that presentation using the Razavi supply stroke; retain the real
   stored Junction but suppress its dot only on a valid VDD Net.
3. Add focused model/editor/render regressions and document the explicit
   visual-versus-electrical convention.

## Validation

- focused model, edit-engine, editor wiring, and render tests
- workspace typecheck and generated Agent API check if the shared enum changes
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): add editable Razavi VDD power rails
```

## Outcome

Added the persisted `power-rail` Route presentation. The edit engine accepts
it only on a Net whose reviewed VDD terminal establishes the VDD domain. A
branch Junction on the same VDD rail Net remains an ordinary
persisted/selectable/splittable Junction, but its formal dot is omitted. Agent
request/response/OpenAPI artifacts now include the enum value.

Validation passed: 70 focused edit-engine, renderer, Agent, application, and
wiring tests; workspace typecheck; Agent-artifact check; symbol-catalog check;
targeted Prettier; and `git diff --check`. User review superseded its `VDD.P`
wire-start interaction: `2026-08-12-drawn-vdd-rail` replaces it with direct
drawn-rail insertion.
