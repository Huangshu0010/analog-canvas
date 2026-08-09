# Pages Dependency Build Fix

## Goal

Repair the GitHub Pages build so a clean GitHub Actions runner builds the
editor's internal workspace dependencies before Vite bundles the editor.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## codex/fix-pages-dependency-build
```

The worktree is clean. The failed Pages run `31311029301` proves the scoped
editor build cannot resolve `@icm/edit-engine` on a fresh checkout because its
dependency output has not yet been built.

## Owned Files

- `.github/workflows/pages.yml`
- `plan/2026-08-09-pages-dependency-build-fix/**`
- `plan/log.md`

## Read-Only Files

- `apps/editor/**`
- all workspace package source and package manifests

## Shared Dependencies

- pnpm workspace dependency-closure filter syntax
- Vite resolution of workspace packages' generated `dist` entries
- GitHub Pages artifact deployment workflow

## Expected Work

1. Replace the editor-only build command with the editor dependency closure
   build command.
2. Verify the exact fresh-runner build sequence locally.
3. Commit, push, merge the focused workflow repair, then rerun Pages.

## Validation

- `pnpm install --frozen-lockfile`
- `ICM_PAGE_BASE_PATH=interactive-circuit-maker pnpm --filter @icm/editor... build`
- `git diff --check`
- `git status --short --branch`

The workflow-only repair has one failure mode: dependency order on a clean
checkout. The dependency-closure build command exercises precisely that
contract without repeating unrelated suite work.

## Experience Signal (for human review)

None.

## Commit Intent

Commit as:

```text
fix(pages): build editor workspace dependencies
```

## Result and Validation (2026-08-09)

- Changed the Pages build command to `pnpm --filter @icm/editor... build`.
  It selects the editor and all local workspace dependencies, allowing pnpm to
  build package `dist` entries before Vite resolves editor imports.
- Passed: `pnpm install --frozen-lockfile` and
  `ICM_PAGE_BASE_PATH=interactive-circuit-maker pnpm --filter @icm/editor...
  build`. Model, symbols, derived, SPICE, edit-engine, render-svg, exporters,
  and the editor built in dependency order.
- Passed: `git diff --check`.
