# Editor Selection Controller

## Goal

Make editor selection a single, explicit transient-state contract. Replace the
scattered combinations of `setVisualSelection`, per-kind setters, and manual
clearing with atomic reducer actions while preserving mixed box/select-all
selection and every current interaction.

## Dirty-State Decision

The prior editor architecture target is committed at `06a97b0`. The remaining
dirty documentation, archive, spec, symbol-reference, shared `plan/log.md`, and
`plan/2026-08-10-remove-redundant-visual-doc-redirects/` paths belong to a
separate documentation cleanup target. They do not overlap this target and
remain read-only.

## Owned Files

- `apps/editor/src/App.tsx`: selection state declaration and selection writes
  only
- `apps/editor/src/selection-controller.ts`
- `apps/editor/src/selection-controller.test.ts`
- `plan/2026-08-10-selection-controller/plan.md`

## Read-Only Files

- Existing dirty files outside this target
- `plan/log.md`
- `apps/editor/src/visual-selection.ts` and its existing tests: canonical data
  shape and pure normalization helpers remain unchanged
- Model, edit-engine, derived, renderer, symbol, and exporter packages

## Shared Dependencies

- `VisualSelection` remains editor-only transient state and is never persisted.
- Mixed selection produced by box selection and Ctrl+A remains supported.
- Object-specific selection remains exclusive unless additive instance
  selection is explicitly requested.
- Endpoint selection remains separate because it carries route endpoint and
  prelude-edit context, but selecting it atomically clears visual selection.

## Expected Work

1. Add a pure selection reducer with replace, replace-kind, select-only,
   clear-kinds, and reset actions.
2. Add a small hook exposing semantic commands rather than raw React setters.
3. Migrate App writes to atomic commands, especially route, annotation,
   drafting, endpoint, diagnostic, box, paste, and select-all flows.
4. Add reducer tests for exclusivity, additive instance toggling, mixed
   selection, normalization, and reset.

## Validation

- Focused selection-controller and existing visual-selection unit tests
- Existing App unit tests
- Focused Playwright selection, text, route, drafting, and Ctrl+A scenarios
- Full editor Vitest and Playwright suites because selection crosses every
  authoring subsystem
- `pnpm typecheck`, editor production build, `git diff --check`, and final
  status audit

## Commit Intent

Commit only the owned paths as:

```text
refactor(editor): centralize visual selection state
```

The shared maintenance log remains deferred while its concurrent owner is
active.

## Outcome

- Added a pure reducer and React controller for all `VisualSelection` writes.
- Replaced App's raw state setter, four per-kind wrapper setters, supplemental
  clearing helper, and repeated multi-setter sequences with semantic atomic
  actions.
- Exclusive route, annotation, drafting, endpoint, and instance selection now
  clears incompatible kinds in one transition. Mixed box, diagnostic, and
  Ctrl+A selection remains an explicit normalized replacement operation.
- Additive instance selection is one tested reducer transition rather than a
  closure embedded in App.
- Reduced `App.tsx` from 7,090 to 7,016 lines. No persisted model, edit schema,
  canvas geometry, or visible command changed.

Validation completed on 2026-08-10:

- `pnpm typecheck`
- focused controller, visual-selection, and App Vitest — 18 tests passed
- focused Playwright selection regressions — 7 tests passed
- full `pnpm exec vitest run apps/editor/src` — 15 files, 57 tests passed
- full `pnpm exec playwright test` — 59 tests passed
- `pnpm --filter @icm/editor... build`
- `git diff --check`

The existing dirty documentation target and shared `plan/log.md` were not
edited. The next structural target should isolate the active-document history,
transaction, and recovery lifecycle from App before splitting geometry-heavy
canvas controllers.
