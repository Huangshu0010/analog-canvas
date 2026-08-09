# GitHub Pages Release Preparation

## Goal

Make the GUI-only, local-first editor publishable as a GitHub repository Pages
site. The deployment publishes static editor assets only; it must expose no
Agent API, MCP surface, backend endpoint, user registration, or server-side
Project data.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## feat/razavi-fidelity-diff-harness...origin/feat/razavi-fidelity-diff-harness
```

The worktree is clean after the first-version baseline commit. Local tool
scratch and generated diagnostics are ignored by tracked rules and are outside
this target.

## Owned Files

- `.github/workflows/pages.yml`
- `docs/user/getting-started.md`
- `plan/2026-08-09-github-pages-release-preparation/**`
- `plan/log.md`

## Read-Only Files

- `apps/editor/**` (the baseline already makes Vite/PWA paths base-aware)
- `apps/local-host/**`
- model, edit-engine, and persistence package contracts

## Shared Dependencies

- GitHub Pages official Actions and Pages repository settings
- Vite `ICM_PAGE_BASE_PATH` convention
- browser recovery/local formal-file behavior

## Expected Work

1. Add a least-privilege GitHub Actions workflow that builds the editor with
   the repository-name Pages base path, uploads only `apps/editor/dist`, and
   deploys only after a `main` push or explicit dispatch.
2. Document user and repository-admin steps, including the local-only data
   boundary and the required Pages source setting.
3. Validate the exact Pages-path production build and statically audit the
   browser bundle source for Agent/backend/credential surfaces.

## Validation

- `ICM_PAGE_BASE_PATH=interactive-circuit-maker pnpm --filter @icm/editor build`
- inspect the built HTML asset/manifest paths
- focused source audit for Agent/MCP/credential/network surface
- `git diff --check`
- `git status --short --branch`

The deployment is static and the current baseline already covers editor
runtime behavior. This target validates the release path and its product
boundary rather than repeating the full editor regression suite.

## Experience Signal (for human review)

None.

## Commit Intent

Commit as:

```text
ci(pages): deploy the local-first editor
```

## Result and Validation (2026-08-09)

- Added `.github/workflows/pages.yml`. It has read-only content permission
  plus the scoped Pages/OIDC deployment permissions, builds only the editor
  with `ICM_PAGE_BASE_PATH=${{ github.event.repository.name }}`, uploads only
  `apps/editor/dist`, and deploys only on a `main` push or manual dispatch.
- Added the user-facing Pages operation and data-boundary documentation.
- Passed: `ICM_PAGE_BASE_PATH=interactive-circuit-maker pnpm --filter
  @icm/editor build`. The generated HTML references
  `/interactive-circuit-maker/` assets and the manifest is relative-path
  scoped.
- Passed: focused static source audit found no Agent/MCP/credential/authentication
  or backend request surface. The only `fetch` calls are the existing Service
  Worker's same-origin static-shell handling.
- Passed: Prettier for the new workflow, updated user guide, and this plan;
  `git diff --check` passed. `plan/log.md` retains its independently existing
  Prettier warning and was not reformatted wholesale.
