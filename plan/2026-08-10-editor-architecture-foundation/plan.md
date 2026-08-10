# Editor Architecture Foundation

## Goal

Reduce the editor shell's structural coupling without changing persisted
behavior: establish explicit document-session and canvas-interaction ownership,
remove unreachable duplicate UI, and give future editor features clear module
boundaries and focused tests.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## agent/fix-ci-baseline
M/D docs and archive paths owned by the CI/document cleanup target
M plan/log.md
?? plan/2026-08-10-remove-redundant-visual-doc-redirects/
```

The editor source and E2E paths are clean. Existing dirty documentation,
archive, symbol-reference, and shared log paths belong to another target and
remain read-only. This target will not stage or commit the shared dirty log.

## Owned Files

- `apps/editor/src/App.tsx`: exact session/interaction/UI-dead-code hunks only
- `apps/editor/src/editor-session.ts`
- `apps/editor/src/editor-session.test.ts`
- `apps/editor/src/interaction-state.ts`
- `apps/editor/src/interaction-state.test.ts`
- `apps/editor/src/component-library.tsx`
- `apps/editor/src/razavi-presentation.ts`
- `apps/editor/src/App.test.tsx`: presentation-policy import only
- `apps/editor/e2e/editor-fixtures.ts`
- `apps/editor/e2e/manual-editor.spec.ts`: shared-helper imports only
- `apps/editor/e2e/drafting.spec.ts`: shared-helper imports and focused
  interaction regressions only
- `plan/2026-08-10-editor-architecture-foundation/plan.md`

## Read-Only Files

- Existing dirty paths outside `apps/editor`
- `plan/log.md` until the concurrent owner has completed its changes
- `packages/model/**`, `packages/derived/**`, `packages/edit-engine/**`,
  `packages/render-svg/**`
- `docs/specs/**` and `docs/adr/**`

## Shared Dependencies

- `DocumentHistory` and the existing `transact -> applyResult` lifecycle remain
  the only committed mutation path.
- Project schemas, edit discriminants, VisualAnchor compatibility, formal SVG,
  and persisted data remain unchanged in this structural target.
- The accepted interaction behavior and current Playwright scenarios are the
  regression surface even where documentation cleanup is deferred.

## Expected Work

1. Extract pure active-document/project replacement and editor-session helpers
   so App no longer owns those small contracts inline.
2. Introduce a typed transient interaction-session union and pure transition
   helpers for activation/cancellation, then migrate App's mutually exclusive
   tool-session state incrementally.
3. Remove the unreachable modal component palette while preserving the active
   Library dock and shared filtering behavior.
4. Move duplicated Playwright menu/download helpers to one fixture module.
5. Add focused tests proving interaction activation and Escape cancellation
   cannot leave conflicting sessions active.
6. Extract the component Library's local UI state and the shared Razavi symbol
   presentation policy so neither the Library nor placement logic depends on
   `App` internals.
7. Record deferred cross-package work: canonical annotation edit names,
   VisualAnchor-only route markers, shared geometry/path serialization, and
   specification reconciliation.

## Validation

- Focused Vitest for editor-session and interaction-state modules
- Existing App Vitest
- Focused Playwright for tool switching, Escape cancellation, Library placement,
  and text/drafting behavior
- Editor dependency build and production build
- Owned-file Prettier, `git diff --check`, and final dirty-state audit

These checks cover the extracted state contracts and ensure the structural
change does not alter authoring, transaction, or command behavior.

## Experience Signal (for human review)

The accepted editor contract, runtime Help, and implementation have drifted;
the deprecated annotation edit/attachment compatibility layer also remains the
dominant runtime path after schema version 2. A later human-requested lesson may
be warranted after the canonical-contract migration is complete.

## Commit Intent

Commit as:

```text
refactor(editor): establish interaction architecture foundation
```

Commit only the exact owned paths; exclude all concurrent work.

## Outcome

- Extracted validated project/document session helpers from `App`.
- Replaced independent tool, component-placement, wire, and drafting-create
  state with one tagged interaction state and reducer. Tool switches now clear
  incompatible transient sessions by construction, and one Escape cancels the
  active interaction.
- Removed the unreachable modal component palette and its unused CSS; retained
  the active Library dock as the sole placement surface.
- Extracted the Library, its local search/collapse state, symbol grouping and
  thumbnails, plus the shared Razavi presentation policy.
- Consolidated duplicated Playwright command/download helpers and added a
  regression for switching between incompatible creation tools.
- Reduced `App.tsx` from roughly 7,566 to 7,090 lines while preserving the
  Project schema, edit transaction path, saved format, and visible workflows.

Validation completed on 2026-08-10:

- `pnpm typecheck`
- `pnpm exec vitest run apps/editor/src` — 14 files, 52 tests passed
- `pnpm exec playwright test` — 59 tests passed
- `pnpm --filter @icm/editor... build`
- `git diff --check`

The required shared `plan/log.md` update is intentionally deferred because it
was already dirty and owned by the concurrent documentation cleanup target.
No files from that target were edited or staged here.

Deferred architecture work remains: split transaction/command orchestration
and selection/drag controllers out of `App`, then migrate deprecated annotation
and route-attachment compatibility contracts at their package boundaries.
