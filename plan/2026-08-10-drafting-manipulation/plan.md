# Drafting Manipulation Commands

## Goal

Extract DraftingObject transformations from React pointer handlers and inspector
commands. App should manage gesture sessions and transaction/status effects;
pure manipulation code should own object-kind geometry changes and refusal
conditions.

## Dirty-State Decision

Editor architecture work through `730edac` is committed. Concurrent CI,
Playwright, test-slimming, documentation, plan-archive, reference, and shared
log changes are dirty but do not overlap this target's owned files. They remain
read-only and unstaged. Current fully-parallel Playwright configuration is the
validation surface.

## Owned Files

- `apps/editor/src/App.tsx`: drafting transformation helpers and their wrapper
  call sites only
- `apps/editor/src/canvas-geometry.ts`: shared center, bearing, and point
  rotation primitives used by App overlays and drafting commands
- `apps/editor/src/drafting-manipulation.ts`
- `apps/editor/src/drafting-manipulation.test.ts`
- `plan/2026-08-10-drafting-manipulation/plan.md`

## Read-Only Files

- All concurrent dirty paths, including E2E specs and Playwright config
- Existing derived drafting geometry implementation and tests
- Model and edit-engine schemas
- `plan/log.md`

## Shared Dependencies

- Derived drafting geometry remains the canonical resolved read model.
- Manipulation functions are pure and return a complete next DraftingObject or
  an explicit refusal; they never call `transact`, set React state, or emit UI
  status.
- Pointer sessions retain one-preview/one-pointerup-transaction behavior.
- Attached anchors are never silently detached by translation, endpoint drag,
  rotation, or bearing edits.
- Construction lines retain the two-vertex minimum and vertex insertion
  straightens only the split segment.
- Style edits remain limited to arrow, construction-line, and rectangle and
  refuse locked objects.

## Expected Work

1. Extract drag origin, translation, handle application, vertex/waypoint
   insertion and deletion, style patching, tangent control, rotation, and
   bearing transformations.
2. Encode locked, attached-arrow, unsupported-kind, and minimum-vertex outcomes
   explicitly where App needs distinct status behavior.
3. Replace App's inline object reconstruction with thin transaction/status
   wrappers and keep gesture session orchestration local.
4. Add focused unit tests for every DraftingObject kind and refusal invariant.

## Validation

- Focused drafting manipulation and App unit tests
- Focused drawing move/cancel, handle drag, vertex edit, rotation, bearing,
  style, lock, and persistence Playwright flows
- Full editor Vitest and Playwright suites under current configuration
- `pnpm typecheck`, editor build, `git diff --check`, status audit

## Commit Intent

Commit only owned paths as:

```text
refactor(editor): extract drafting manipulation commands
```

Shared maintenance-log work remains deferred to its concurrent owner.

## Outcome

- Added a pure drafting-manipulation boundary for drag origins, translations,
  handle edits, vertex and waypoint commands, style patches, rotations,
  bearings, and curve tangent edits.
- Reduced `App.tsx` by 287 lines while leaving gesture lifecycle,
  transactions, selection, and user-facing status in the React layer.
- Preserved attached-anchor refusal behavior, construction-line minimums,
  locked-object rules, and one-transaction pointer completion.
- Added seven focused contract tests across arrows, construction lines, and
  rectangles, including locked and attached-anchor cases.

## Validation Result

- Focused Vitest: 18 passed.
- Focused drafting Playwright: 8 passed.
- Full editor Vitest: 77 passed across 19 files.
- Full Playwright: 59 passed under the concurrent fully-parallel setting.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; the existing Vite large-chunk advisory remains.
- `git diff --check`: passed for owned files; final repository-wide check and
  status audit are recorded immediately before commit.
- `plan/log.md` remains unstaged because its dirty state belongs to the
  concurrent repository-maintenance target.
