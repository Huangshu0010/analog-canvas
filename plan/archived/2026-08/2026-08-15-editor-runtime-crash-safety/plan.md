---
status: completed
experience: none
---

# Editor Runtime Crash Safety - Minimal Three Layers

## Goal

Keep the editor page alive when rendering or transaction code throws, using
the evidence-bounded minimum agreed in review instead of the full four-layer
proposal:

1. a root Error Boundary so a render crash shows a recovery screen instead
   of a blank page;
2. a last-good-scene fallback for formal scene building (the one confirmed
   white-screen path) with a visible degraded status;
3. an `INTERNAL_ERROR` transaction fence at the document-controller choke
   point: unknown engine or re-validation exceptions become typed rejections
   with Project, revision, and histories left consistent, and the UI clears
   transient interaction state on that code.

Explicitly deferred (no observed failure they would catch): the stable-shell
workspace split, a full `runCommand` executor, and commit-time render
preflight.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/editor-runtime-crash-safety
```

The main worktree holds another worker's active dirty target
(`codex/compact-library-overlay-properties`), so this target runs in a
dedicated worktree checked out from main `da43d33`; that worktree is clean
and untouched.

Owned paths (in the worktree):

- `packages/edit-engine/src/transaction.ts` (additive `INTERNAL_ERROR`
  error-code member only)
- `apps/editor/src/document/document-controller.ts` and its test
- `apps/editor/src/app/App.tsx` (scene guards, transact fence, crash probe)
- `apps/editor/src/app/scene-safety.ts` (new) and its test
- `apps/editor/src/app/crash-test-hooks.ts` (new, DEV-only test hooks)
- `apps/editor/src/components/editor-error-boundary.tsx` (new) and its test
- `apps/editor/src/main.tsx`, `apps/editor/src/styles.css`
- `apps/editor/e2e/runtime-crash-safety.spec.ts` (new)
- this plan and `plan/log.md`

Read-only: recovery coordinator/store/contract, file service, edit-engine
semantics beyond the additive code, PWA assets, CI definitions.

## Work

1. `EditorErrorBoundary` class component with a `role="alert"` crash screen
   (message + Reload editor button) mounted in `main.tsx` around `Root`;
   log `componentDidCatch` to console.
2. `buildSceneSafely` pure helper; App wraps `buildSvgScene` (formal scene,
   copy preview) with a last-good ref and a degraded status effect; the
   fit-view `contentScene` falls back to the default framing; no fallback on
   the very first render (the root boundary owns that case).
3. `INTERNAL_ERROR`: document-controller catches throws from
   `history.transact` and from post-commit Project re-validation, resets
   histories from the unchanged Project, and returns a typed rejection; the
   App transact wrapper also converts wrapper-level throws into synthetic
   rejections and clears transient interaction state on `INTERNAL_ERROR`.
4. DEV-only crash hooks (`__ICM_TEST_RENDER_CRASH__`,
   `__ICM_TEST_SCENE_CRASH__`) so browser tests can force each failure mode;
   production builds eliminate them via `import.meta.env.DEV`.
5. Tests: controller INTERNAL_ERROR (engine throw and post-commit
   re-validation throw, Project/revision/undo consistency, subsequent
   transact still applies), scene-safety helper outcomes, crash-screen
   static render, and browser tests for boundary reload and degraded-scene
   recovery.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm test:local packages/edit-engine/src/transaction.test.ts apps/editor/src/document/document-controller.test.ts apps/editor/src/app/scene-safety.test.ts apps/editor/src/components/editor-error-boundary.test.tsx`
- `corepack pnpm typecheck`
- `pnpm test:e2e:local apps/editor/e2e/runtime-crash-safety.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "recovery"`

## Commit Intent

Commit as:

```text
feat(editor): keep the page alive through render and transaction crashes
```

## Outcome

Delivered the three evidence-bounded layers. `EditorErrorBoundary` in
`main.tsx` shows a `role="alert"` recovery screen (reason + Reload editor +
recovery guidance) instead of a blank page. Formal scene building runs
through `buildSceneSafely` with a last-good-scene ref: a build failure keeps
the canvas at the previous coherent view, sets a visible degraded status,
rethrows only on the very first render (the root boundary owns that), and
recovers fresh rendering as soon as building succeeds again; the copy
preview and the fit-view bounds scene fall back quietly. The document
controller converts engine exceptions and post-commit re-validation failures
into typed `INTERNAL_ERROR` rejections (additive `EditErrorCode` member) and
rebuilds the histories from the unchanged Project so the next transaction
continues from a consistent revision; the App transact wrapper also converts
wrapper-level throws and clears transient interaction state on
`INTERNAL_ERROR`. DEV-only window hooks (`__ICM_TEST_RENDER_CRASH__`,
`__ICM_TEST_SCENE_CRASH__`) drive the browser tests and are eliminated from
production builds via `import.meta.env.DEV`. Tests: 3 scene-safety outcomes +
crash-screen static render, 2 controller INTERNAL_ERROR cases (engine throw
via prototype spy, re-validation throw via partial module mock, both
asserting unchanged Project/revision and a successful follow-up transaction),
and 2 browser tests (boundary reload round-trip; degraded stale-scene commit
that resumes fresh rendering). Validation: 736 unit tests green; 106 E2E
tests across runtime-crash-safety, drafting, component-insert, and the full
manual-editor spec green; typecheck, prettier, `git diff --check` clean.
Deferred by design: stable-shell split, full runCommand executor, and
commit-time render preflight (no observed failure they would catch).

status: completed
experience: none
