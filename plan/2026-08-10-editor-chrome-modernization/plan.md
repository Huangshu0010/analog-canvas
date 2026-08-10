# Editor Chrome Modernization

## Goal

Modernize the browser editor's visual hierarchy and polish while preserving
all existing schematic authoring, persistence, import/export, recovery,
keyboard, pointer, accessibility, and Agent-boundary behavior.

## Dirty-State Note

Start state from `git status --short --branch` after creating the target branch:

```text
## codex/modernize-editor-chrome
```

The branch starts from current `main` with a clean worktree. No unrelated dirty
paths are present.

During the temporary baseline-comparison stash, concurrent untracked work
appeared at `apps/editor/src/canvas-drag-session.ts`, its test, and
`plan/2026-08-10-unified-canvas-drag-session/`. Those paths belong to another
target, do not overlap this target's CSS or plan, and will remain untouched and
unstaged. Validation results will distinguish them from this target.

## Owned Files

- `apps/editor/src/styles.css`
- `apps/editor/src/App.tsx` only if a non-behavioral class or accessible visual
  wrapper is required
- `apps/editor/src/App.test.tsx` only if static markup coverage must follow a
  non-behavioral wrapper
- `apps/editor/e2e/**` only for new visual-regression coverage, never to weaken
  existing functional expectations
- `plan/2026-08-10-editor-chrome-modernization/**`
- `plan/log.md`

## Read-Only Files

- `packages/model/**`
- `packages/edit-engine/**`
- `packages/derived/**`
- `packages/render-svg/**`
- `packages/exporters/**`
- `packages/agent-*/**`
- formal visual and export goldens under `fixtures/**`

## Shared Dependencies

- Accepted editor interaction contract in `docs/specs/editor-interaction.md`
- Stable two-column layout and persistent bottom Selection shelf
- Existing `data-testid`, accessible names, command labels, shortcuts, and
  focus behavior
- Formal canvas body and SVG/PNG/PDF export output, which must remain isolated
  from editor chrome theming
- GitHub Pages and offline PWA constraints; no remote font or icon dependency

## Expected Work

1. Establish the current editor unit/build baseline and preserve a desktop
   browser screenshot for comparison.
2. Refine semantic design tokens for typography, spacing, radii, borders,
   elevation, status colors, focus, and reduced motion.
3. Modernize the header, command menus, dock, search, component cards,
   Selection shelf, help dialog, feedback states, and canvas frame without
   changing their behavior or accessible names.
4. Add desktop-width adaptations that preserve every command and keep the
   canvas geometry stable across selection changes.
5. Validate functional tests, production build, browser interactions, and the
   absence of formal/export changes.

## Validation

- `pnpm exec vitest run apps/editor/src/App.test.tsx`
- `pnpm --filter @icm/editor build`
- `pnpm test:e2e`
- `pnpm format:check`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

The target changes a broad, user-visible editor surface while intentionally
leaving domain packages untouched. Static editor tests and the production
build cover markup and CSS integration; full browser e2e coverage is required
because pointer hit targets, menu focus, layout stability, and command
discoverability are credible styling risks. Type and formatting gates protect
shared build quality.

## Experience Signal (for human review)

The repository-wide Prettier gate is already red on six paths outside this
target (`packages/render-svg/src/style-profile.test.ts`, the formatted symbol
asset, three Razavi/PNG scripts, and `pnpm-lock.yaml`). The owned CSS and plan
file are formatted. Keep this pre-existing CI-baseline repair separate from the
editor chrome commit.

The repository-wide typecheck is also already red in
`packages/symbols/src/razavi-catalog.test.ts` because its local fixture type
omits `leadsPx`. This target does not own or modify that symbol-catalog test.

The first full browser run completed 30 of 49 tests. Most failures target
retired UI contracts already absent from current `main` (the expanded VSS
palette, `More / Add text`, a separate `Export` menu, and now-ambiguous
selectors). Route-coordinate failures will be compared against an unmodified
`main` baseline before close-out rather than attributed to CSS without
evidence.

A temporary unmodified-`main` comparison proved that the selected-segment test
already expects four points while current behavior produces three. Restoring
the canvas panel's original padding and height removed the only detected
style-induced coordinate difference: the direct-pin-corner browser test then
passes with the modern chrome applied.

## Commit Intent

Commit as:

```text
feat(editor): modernize the editor chrome
```
