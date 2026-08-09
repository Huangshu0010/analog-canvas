# Terminal escape routing and seamless joins

## Goal

Make manual orthogonal wires leave and approach component terminals along their
declared outward direction, so a direct right-angle never begins at a device
pin. Keep electrical endpoints exact while rendering a small controlled overlap
at terminal joins to remove anti-aliased seams.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## codex/optimize-iteration...origin/codex/optimize-iteration [ahead 1]
```

The worktree is clean. This target owns its edits below.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/wire-path.ts`
- `apps/editor/src/wire-path.test.ts`
- `packages/derived/src/routes.ts`
- `packages/derived/src/derived.test.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `plan/2026-08-09-terminal-escape-routing/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/model/src/geometry.ts`
- `packages/model/src/schema.ts`
- `packages/symbols/src/**`

## Shared Dependencies

- Symbol pin `at` and `direction` are the canonical electrical terminal
  contract.
- `routePolyline()` continues to derive persisted route geometry from exact
  electrical endpoints.
- The Razavi style profile remains the sole visual authority.

## Expected Work

1. Preserve transformed terminal direction (including mirror and rotation) in
   editor wire candidates rather than reducing it to an axis.
2. Route component-terminal starts and ends through deterministic orthogonal
   escape stubs; retain direct paths only when they already honour both ends.
3. Render a route's terminal-facing segment with a bounded visual-only overlap
   beneath its component symbol, without changing topology or route data.
4. Preserve the 10-unit connection grid when the shared escape router derives
   a midpoint, rather than emitting rounded half-grid coordinates.
5. Add deterministic geometry and SVG regression tests for perpendicular
   terminal exits, rotations/mirrors, and the overlap contract.

## Validation

- Focused Vitest tests for `wire-path` and SVG renderer.
- Editor production build, because the interactive canvas consumes the new
  route helper.
- `git diff --check` and `git status --short --branch`.

These checks exercise the routing geometry, its SVG output and the application
integration without running unrelated workspace gates.

## Experience Signal (for human review)

None.

## Commit Intent

Commit as:

```text
fix(editor): escape component terminals before orthogonal turns
```

## Outcome and Validation

- GUI wire sources now retain the full transformed signed pin direction,
  including mirror and rotation, and use the shared escape router for direct
  terminal connections.
- The shared router now snaps calculated detour midpoints to the document's
  connection grid. Manual routes preserve their exact electrical endpoints.
- Formal SVG retains exact route polyline coordinates and adds an under-symbol
  overlap stroke only for correctly-oriented terminal `escape` segments.
- Passed: focused Vitest (7 passed), focused manual-editor Playwright (1
  passed), editor production build, Prettier, and `git diff --check`.
- Full render test file has unrelated pre-existing visual-style expectation
  failures (for example its old `#202020` and typography baselines); focused
  terminal-overlap coverage passed.
- Commit status: committed as `fix(editor): escape component terminals before
  orthogonal turns`.
