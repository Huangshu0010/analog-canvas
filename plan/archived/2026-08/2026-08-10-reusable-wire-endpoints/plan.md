# Reusable wire endpoints and route-anchor joins

## Goal

Ensure a free manual wire endpoint can always start a later wire, and render a
seamless direct join when a second route or a component lead meets that endpoint.

## Dirty-State Note

The worktree contains concurrent Razavi resistor changes in symbols, its plan,
and non-overlapping `render.ts`/renderer-test miter-style hunks. This target
will preserve those hunks, limit changes to a separate route-anchor bridge and
its regression coverage, and use intentional hunk staging.

## Owned Files

- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/render-svg/src/render.ts` (route-anchor bridge hunk only)
- `packages/render-svg/src/render.test.ts` (route-anchor bridge test hunk only)
- `plan/2026-08-10-reusable-wire-endpoints/plan.md`
- `plan/log.md`

## Read-Only Files

- `apps/editor/src/App.tsx`
- `packages/edit-engine/src/transaction.ts`
- `packages/derived/src/routes.ts`
- `packages/symbols/**`

## Shared Dependencies

- A degree-one `route-anchor` Junction is a reusable dangling wire endpoint.
- A degree-two `route-anchor` remains dotless; a branch Junction remains the
  visual authority for explicit three-or-more-way connections.
- Route geometry and endpoint topology remain exact; bridges are render-only.

## Expected Work

1. Add a browser regression proving a free endpoint can be selected as a later
   wire source and connected to a component.
2. Add one sharp SVG bridge for the two route segments meeting at a dotless
   degree-two route-anchor, eliminating separate butt-cap seams.
3. Add focused SVG coverage for a direct orthogonal route-anchor join.

## Validation

- Focused renderer Vitest and manual-editor Playwright coverage.
- Editor production build, `git diff --check`, and status review.

## Experience Signal (for human review)

None.

## Commit Intent

Commit as:

```text
fix(editor): reconnect free wire endpoints without route seams
```

## Outcome

- A free `route-anchor` is covered by a browser regression as a later wire
  source, then connected to a component terminal.
- The SVG renderer adds a render-only miter bridge when exactly two routes meet
  at a dotless `route-anchor`. It leaves route endpoints and waypoints intact;
  explicit branch Junctions still own visible dots.
- Validation passed: focused renderer Vitest (1/1), focused manual-editor
  Playwright (1/1), and the editor production build. `git diff --check` passed.
