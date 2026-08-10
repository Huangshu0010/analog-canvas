# Direct-miter terminal joins for manual wiring

## Goal

Replace the manual editor's default 10-unit terminal escape with direct pin
connections. Render a short, sharp miter bridge from the component lead into
the actual first/last wire segment so direct right-angle joins remain seamless.

## Dirty-State Note

Start state from `git status --short --branch` contains concurrent Razavi
resistor changes in `packages/symbols/**`, its target plan, and small,
non-overlapping miter changes in `packages/render-svg/src/render.ts` and its
test. This target does not alter those hunks, does not run whole-file formatting
on them, and will use intentional hunk staging.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/wire-path.ts`
- `apps/editor/src/wire-path.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/render-svg/src/render.ts` (terminal-bridge hunk only)
- `packages/render-svg/src/render.test.ts` (terminal-bridge test hunk only)
- `plan/2026-08-09-direct-miter-terminal-joins/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/derived/src/routes.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/symbols/**`

## Shared Dependencies

- `Pin.at` remains the exact electrical and persisted route endpoint.
- The render order stays routes before symbols so bridge segments are covered
  by the component body where appropriate.
- Agent `route_orthogonal` keeps its explicit escape behavior; this target is
  limited to the manual GUI wire tool.

## Expected Work

1. Make manual wire geometry direct, with no implicit terminal offset.
2. Derive a miter bridge from a terminal's internal lead direction and the
   actual route segment direction at both ends.
3. Add geometry and SVG regressions proving direct right-angle joins preserve
   grid/electrical coordinates and receive a bridge.

## Validation

- Focused Vitest for wire-path and renderer bridge behavior.
- Focused manual-editor Playwright route test and editor production build.
- `git diff --check` and status review.

## Experience Signal (for human review)

None.

## Commit Intent

Commit as:

```text
fix(editor): use direct miter joins for manual terminal wiring
```

## Outcome and Validation

- The manual GUI wire helper no longer reads terminal direction or inserts an
  escape segment. It persists only directly selected endpoints and necessary
  orthogonal bends.
- SVG renders a `terminal-miter-bridge` path from the component-lead side of a
  terminal through the exact pin to the actual first or last route segment.
  Main route coordinates and connectivity remain unchanged.
- The zero-length preview state at wire start is explicitly non-persistable and
  no longer causes route-normalization failures.
- Passed: focused Vitest (5 passed), focused manual editor Playwright (1
  passed), editor production build, Prettier, and `git diff --check`.
- Commit status: committed as `fix(editor): use direct miter joins for manual
  terminal wiring`.
