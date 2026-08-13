---
status: completed
experience: none
---

# Bound transient canvas state and runtime retention

## Goal

Remove stale Smart Snap guide remnants on interrupted editor interactions and
place explicit, deterministic bounds on the runtime retention paths identified
by the cache audit.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns the editor's transient interaction
lifecycle, in-memory document history policy, production static-cache version
policy, their focused tests, and its factual log entry.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/canvas/canvas-drag-session.ts`
- `apps/editor/src/canvas/canvas-drag-session.test.ts`
- `apps/editor/e2e/drafting.spec.ts`
- `packages/edit-engine/src/history.ts`
- `packages/edit-engine/src/history.test.ts`
- `apps/editor/public/sw.js`
- `apps/editor/vite.config.ts`
- `docs/specs/edit-engine.md`
- `docs/specs/editor-interaction.md`
- `plan/log.md`

Shared/read-only dependencies: the Project schema, editor shortcut contract,
and local-host static response headers remain unchanged. The target must not
put editor-only transient state into Project persistence or the Agent API.

## Work

1. Establish one editor-owned transient cleanup boundary that cancels an active
   canvas drag and removes Smart Snap DOM guides. Invoke it for interaction
   reset, Escape cancellation, page visibility loss, and unmount; retain
   object-specific drag restoration through each session's `onCancel`.
2. Add focused coverage for cancellation/lost capture and an E2E assertion that
   Smart Snap guide DOM does not survive Escape.
3. Add a bounded, configurable in-memory undo/redo policy to `DocumentHistory`
   with a conservative default and direct tests. Keep revisions and normal
   undo/redo semantics intact within the retained window.
4. Make the production Service Worker static cache version build-derived so
   activation removes previous static shells; retain the exclusion of Project
   data and recovery records from Cache Storage.

## Validation

- `pnpm vitest run apps/editor/src/canvas/canvas-drag-session.test.ts packages/edit-engine/src/history.test.ts`
- focused Playwright drafting scenarios covering cancellation
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): bound transient canvas state and runtime caches
```

## Outcome

Completed. A unified editor cleanup boundary now cancels active canvas drags
and clears imperative Smart Snap SVG children on reset, tool change, insertion
dialog entry, Escape, page hide, and unmount. The Edit Engine retains 64 undo
or redo snapshots per opened Document by default, with a validated configurable
limit. Production builds fingerprint the static service-worker cache from the
emitted `index.html`, so activation removes superseded static shells.

Focused canvas/history Vitest (11 tests), the Smart Snap Escape Playwright
scenario, editor production build, workspace typecheck, targeted Prettier, and
`git diff --check` passed. The repository-wide `pnpm format:check` was also
run; it still reports three pre-existing unrelated files:
`packages/derived/src/connectivity.ts`,
`packages/derived/src/instance-label-placement.ts`, and
`packages/symbols/src/razavi-catalog.test.ts`.
