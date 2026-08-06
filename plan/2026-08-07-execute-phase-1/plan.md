# Execute Phase 1 Core Editor Slice

## Goal

Complete the Phase 1 exit gate with a user-visible, browser-based manual editor
slice that places and transforms a hand-authored circuit through typed edits,
supports monotonic undo/redo and canonical save/reopen, and exports a
deterministic textbook-monochrome SVG without editor overlays.

This target is the second bounded target under the active Phase 0–7 goal.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean at Phase 0 commit `e7532ea`.

## Owned Files

- root package, TypeScript, test, and Playwright configuration
- `apps/editor/`
- `packages/edit-engine/`
- `packages/model/` tests or narrowly required compatible model additions
- `packages/symbols/`
- `packages/render-svg/`
- Phase 1 hand-authored Project and SVG fixtures under `fixtures/`
- `docs/specs/edit-engine.md`
- `docs/specs/symbol-dsl.md`
- `docs/specs/visual-language.md`
- `docs/specs/README.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-1-core-editor-slice.md`
- `plan/2026-08-07-execute-phase-1/`
- `plan/log.md`

## Read-Only Files

- accepted Phase 0 ADRs
- `docs/overall-product-plan.md`
- Phase 2–7 roadmap files
- `lib/circuit.vss`
- `netlists/`
- `.reference-src/`

## Shared Dependencies

- Phase 0 Project/Document, geometry, persistence, transaction, Circuit IR, and
  Symbol Resolver contracts.
- Native SVG remains the selected Phase 1 canvas; no Reference canvas library
  becomes a dependency.
- GUI gestures must commit through `packages/edit-engine` and must not mutate
  the Project model during previews.
- `textbook-monochrome-v1` formal rendering excludes hit targets, selection,
  grid, and other editor overlays.

## Expected Work

1. Expand the accepted edit union with placement, move, rotation, mirror,
   undo, and redo behavior while preserving atomic revision semantics.
2. Add a revision-monotonic Document history session and direct-engine tests.
3. Add 5–8 product-owned initial symbols and deterministic symbol transforms.
4. Add `packages/render-svg` with formal-layer SVG output and goldens.
5. Replace the shell with a functional native SVG editor: unplaced panel,
   grid, selection/hit targets, drag placement/move, transforms, undo/redo,
   save/reopen, viewport controls, and SVG export.
6. Add focused component tests and Playwright acceptance scenarios.
7. Accept the initial visual-language contract and update the Phase 1 specs.
8. Run the full Phase 1 validation surface and record completion evidence only
   if the exit gate is proven.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- edit-engine operation, atomicity, dry-run, and history tests
- symbol transform and deterministic SVG golden tests
- Project save/reopen semantic equality and absence of session state
- Playwright place, select, move, rotate, mirror, undo, redo, save, reopen, and
  export scenarios
- formal SVG structural inspection for absent overlay/hit-target layers
- `git diff --check`
- `git status --short --branch`

The editor, shared mutation path, renderer, and browser integration all change,
so full workspace checks plus focused browser acceptance are required.

## Experience Signal (for human review)

None at target start.

## Outcome

Completed on `2026-08-07`.

- Implemented the shared typed edit/history path, product-owned provisional
  symbols, deterministic formal SVG renderer, and the functional native-SVG
  editor slice.
- Added canonical hand-authored and rendered Project fixtures, an SVG golden,
  41 passing unit/component tests, and one passing Playwright workflow covering
  the Phase 1 user journey.
- Browser visual review found no application overflow or console diagnostics.
  A screenshot initially appeared clipped because it was displayed at the
  browser's 1.5x device-pixel scale; DOM geometry measurements confirmed the
  full toolbar was within the viewport, so no speculative CSS change was made.
- No reusable experience note was extracted automatically.

## Commit Intent

Commit as:

```text
Complete Phase 1 core editor slice
```
