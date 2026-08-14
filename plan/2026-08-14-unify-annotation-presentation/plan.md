---
status: completed
experience: none
---

# Unify annotation presentation geometry

## Goal

Establish one derived presentation geometry for every SchematicAnnotation so
the SVG glyph, editor hit target, marquee, text editor, export bounds, and
visual diagnostics use identical position, alignment, rotation, and bounds.
Repair the resulting 90-degree instance-label mismatch and atomic deletion of
a VDD rail selected together with its power label.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean before branch creation. This target is owned on
`codex/unify-annotation-presentation`; it does not change schema 9, persisted
annotation shape, electrical topology, or Agent API.

- `packages/derived/src/annotation-presentation.ts` (new)
- `packages/derived/src/index.ts`
- `packages/derived/src/*annotation*.test.ts` (new or existing focused tests)
- `packages/derived/src/visual.ts`
- `packages/render-svg/src/render.ts`
- `fixtures/exports/phase-7-dense-analog/*` (generated formal-export goldens)
- `apps/editor/src/features/wiring/route-interaction-geometry.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/routing.test.ts`
- `docs/specs/schematic-model.md`
- `docs/specs/editor-interaction.md`
- `plan/root-audit.md`
- `plan/log.md`

Read-only/shared dependencies: `packages/model` schema 9, symbol geometry,
and Edit Engine transaction union. The only edit-engine behavior change is
deduplicating derived power-label removals in one existing atomic transaction.

## Work

1. Introduce a derived AnnotationPresentation resolver that is the sole normal
   source for annotation glyph placement and measured bounds. A dangling anchor
   alone uses `fallbackPosition`.
2. Make the renderer and editor hit/marquee/text-overlay surfaces consume that
   resolver. Keep current-marker route-specific visuals inside the same
   derived contract.
3. Correct instance-label follow/rotation persistence so the stored object
   offset and fallback describe one visible text origin after rotation.
4. Expose power-label removals from visual-route deletion and exclude them from
   the generic explicit-annotation removal set, preserving atomic deletion of
   a marquee containing a rail, label, and component.
5. Add rotation, rail-move/hit, and composite-delete regressions; update the
   two current contracts and close out the plan/log.

## Validation

- `pnpm test:local <affected derived, edit-engine, render-svg, and editor unit tests>`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep <annotation/VDD regressions>`
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): unify annotation presentation geometry
```

## Outcome

Implemented one derived `AnnotationPresentation` contract and removed the
persisted semantic/glyph split for automatic instance labels. Renderer,
editor text hit/marquee/edit bounds, export bounds, and visual label diagnostics
now consume the same resolved object anchor position. Power-rail deletion
publishes its derived label IDs so a mixed selection does not submit a second
annotation-removal edit.

Validation passed: 80 focused derived/editor/edit-engine/render tests,
`pnpm typecheck`, `pnpm format:check`, `git diff --check`, and the focused
Playwright VDD rail creation/deletion flow. `pnpm --filter @icm/editor build`
was attempted but is blocked after Vite transforms modules by the existing
`version-static-service-worker` plugin attempting to read missing
`apps/editor/dist/index.html`; no Vite/build configuration is owned by this
target. This review branch is not a mainline delivery.

Mainline CI on 2026-08-14 subsequently confirmed that the editor build is
healthy when run in the full workspace sequence. It stopped only at the formal
export golden for `schematic.svg`; that output must be reviewed and, if it
reflects the intentional unified annotation bounds, regenerated before this
target can return to completed.

The reviewed golden now reflects the intentional non-clipping label bounds.
After regeneration, frozen-lockfile installation and `pnpm ci:check` passed:
562 unit tests, 103 browser E2E tests, all workspace builds, export/PWA/
production/release checks, and the formal export goldens. The earlier direct
editor-build failure was an invocation-order artifact and is not reproducible
in the canonical CI sequence.
