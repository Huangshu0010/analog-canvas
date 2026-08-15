---
status: active
experience: none
---

# WP-5 - Browser Hardening and Release Delivery

## Goal

Prove the complete browser failure matrix with real IndexedDB and deliver
through the mainline gate: hard renderer crash restore, simultaneous tabs
with separate working copies, quota-exceeded simulation, Cache Storage
isolation, an extended production smoke check, stale localStorage-era
comments removed, and the release note for the recovery delivery.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/robust-page-persistence-recovery
```

Clean after WP-4 commit `f825ff3`.

Owned paths:

- `apps/editor/e2e/recovery-hardening.spec.ts` (new)
- `scripts/editor-production-smoke.mjs` and the committed smoke report under
  `fixtures/editor-production-smoke/` (regenerated)
- `apps/editor/src/document/recovery-scheduler.ts` (stale header comment only)
- `docs/release/browser-recovery-v2.md` (new release note)
- this plan and `plan/log.md`

Read-only: all recovery modules and specs from WP-0..WP-4, PWA assets, CI
workflow definitions.

## Work

1. Crash test: CDP `Page.crash` after settled writes, revive, restore the
   latest committed revision through the recovery dialog.
2. Two tabs in one context (shared origin storage, per-tab sessionStorage):
   each tab edits its own working copy; after reloading both, each restores
   its own content and the store holds both sessions.
3. Quota simulation: in-page patched IndexedDB puts reject with
   `QuotaExceededError`; assert the persistent warning, the statusbar label,
   a working editor, and a direct download.
4. Cache Storage isolation: after edits and a save, no cached response body
   contains Project markers.
5. Extend the production smoke to assert the same isolation against the
   built PWA's caches and regenerate the golden report.
6. Fix the scheduler's stale localStorage header comment; add the
   `browser-recovery-v2` release note.
7. Run `pnpm verify:branch`, then the clean-state mainline gate
   (`pnpm install --frozen-lockfile`, `pnpm ci:check`), push, and wait for
   the required remote checks.

## Validation

- `git diff --check`
- `git status --short --branch`
- `pnpm test:e2e:local apps/editor/e2e/recovery-hardening.spec.ts`
- `pnpm verify:branch`
- clean-state `pnpm install --frozen-lockfile` + `pnpm ci:check`
- pushed review branch with green required GitHub Actions checks

## Commit Intent

Commit as:

```text
test(editor): prove project recovery failure modes
```

## Outcome

Added `recovery-hardening.spec.ts`: abrupt tab death (`close({runBeforeUnload:
false})`; CDP `Page.crash` cannot be used because it destroys the whole
Playwright context) followed by a fresh tab restoring the latest committed
revision; two tabs in one context editing and restoring their own working
copies with both sessions coexisting; an in-page quota simulation rejecting
recovery puts while the editor stays alive with the persistent warning,
statusbar label, and direct download; and Cache Storage isolation asserting
no cached response contains Project markers. The recovery dialog gained the
top-document revision in each generation line so same-named Projects are
distinguishable (this also fixed a real ReferenceError where the card map
used an undefined `summary` identifier — caught by the two-tab run). The
production smoke now asserts the same cache isolation against the built PWA
and fails on `project-data-in-cache`, with the golden report regenerated
(`projectDataIsolation: "clean"`). Removed the scheduler's stale
localStorage-era header comment and added the
`docs/release/browser-recovery-v2.md` release note. Local environment note: a
`pnpm` shim (corepack) was placed on PATH because recursive scripts spawn
`pnpm` by name.

Remote-check repair: the required "Browser tests (2/2)" job failed on
`moves internal wiring ... copies the routed subgraph` (retry included). An
instrumented probe reproduced it deterministically on this branch (and never
on main): the debounced recovery write publishes coordinator state, and every
App re-render was replacing the formal scene because the inline
`dangerouslySetInnerHTML={{ __html }}` literal changes prop identity each
render — killing live drag previews and their pointer capture. Fixed by
memoizing the innerHTML prop objects (`sceneInnerHtml`,
`copyPreviewInnerHtml`); MutationObserver evidence shows the `<g>` subtree is
no longer replaced across recovery re-renders, the drag survives the write
window (probe 3/3, formerly 3/3 failing), and the flaky test passed 5/5 plus
the 102-test affected E2E regression and 271 unit tests. Validation:
hardening spec 4/4, typecheck, prettier, docs-link check, and the production
smoke in both modes against a fresh build, all green; `pnpm verify:branch`
and the clean-state mainline gate (`pnpm install --frozen-lockfile`,
`pnpm ci:check`, 121/121 E2E) passed before push.

status: completed
experience: none
