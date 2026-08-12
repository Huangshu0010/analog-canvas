---
status: completed
experience: none
---

# Extract Selection Inspector Details

## Goal

Separate the read-only editor metrics and diagnostic lists from selection
actions in `App.tsx`, with one diagnostic summary contract that prevents
structural issues and visual observations from being filtered and rendered by
competing logic.

## State and Ownership

Start state from `git status --short --branch`:

```text
## agent/fix-ci-baseline
```

The worktree is clean. This target owns:

- `apps/editor/src/App.tsx` (diagnostic derivation and read-only inspector block)
- `apps/editor/src/selection-inspector-details.tsx`
- `apps/editor/src/selection-inspector-details.test.tsx`
- `plan/2026-08-10-extract-selection-inspector-details/plan.md`
- `plan/log.md` (close-out entry only)

Read-only dependencies are the derived visual-diagnostic contract, SPICE
diagnostic contract, editor styles, and existing manual-editor E2E specs. The
selection action sections and their command callbacks remain owned by
`App.tsx`.

## Work

1. Introduce a typed, read-only inspector snapshot and a single visual
   diagnostic summarizer.
2. Move the metrics, import-diagnostic, structural-diagnostic, and observation
   rendering into a focused component.
3. Replace the App block with the new view-model boundary and cover diagnostic
   partitioning/rendering with deterministic tests.

## Validation

- Focused Vitest for diagnostic summary/rendering and App rendering
- Focused Playwright checks for route-derived inspector counts and
  imported-document metrics
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- Changed-file Prettier
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
refactor(editor): extract selection inspector details
```

## Outcome

Added a typed read-only inspector snapshot, one visual-diagnostic summary, and
a focused component for metrics and diagnostics. `App.tsx` now retains only
the state/command ownership and passes a view model into the inspector. The two
diagnostic lists no longer each traverse every diagnostic and hide the other
category; structural issues and observations are partitioned once and rendered
once, while preserving all visible content and selection callbacks.

Validation passed: 13 focused Vitest tests, two focused manual-editor
Playwright flows, repository typecheck, editor production build, changed-file
Prettier, and `git diff --check`. The existing large-chunk build warning remains
unchanged.
