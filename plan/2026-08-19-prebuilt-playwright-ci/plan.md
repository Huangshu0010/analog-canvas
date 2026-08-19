---
status: completed
experience: none
---

# Run browser CI in a prebuilt Playwright environment

## Goal

Remove per-job Chromium download and Linux dependency installation from
browser-dependent GitHub Actions jobs by using the official Playwright image
that exactly matches this repository's `@playwright/test@1.62.1` dependency.
Keep local validation commands self-sufficient.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

`.worktrees/` is user-owned and unrelated. It will not be modified. This target
owns:

- `.github/workflows/ci.yml`
- `plan/2026-08-19-prebuilt-playwright-ci/plan.md`
- `plan/log.md`

Read-only dependencies: `playwright.config.ts`, release-smoke scripts, and the
Playwright image manifest. The image must match the package version and expose
Node 24, Chromium, and required Linux dependencies.

## Work

1. Verify the official `mcr.microsoft.com/playwright:v1.62.1-noble` image and
   record an immutable Linux amd64 reference in CI.
2. Run release and E2E jobs in that image, remove their runtime Chromium install
   steps, and preserve a local browser-installing release command.
3. Correct the E2E argument forwarding so each declared browser shard runs its
   assigned half of the suite rather than the complete suite.
4. Add focused static command coverage and validate the workflow on GitHub.

## Validation

- Container preflight: Node version, Playwright version, and Chromium launch.
- `pnpm ci:static`
- `pnpm test:impact -- --base origin/main`
- `pnpm ci:e2e --shard=1/2`
- `git diff --check`
- GitHub required checks for the review branch.

## Test Impact

- Decision: no-test-change
- Contracts: CI browser jobs use an immutable, version-matched environment;
  local release validation remains able to provision its own browser.
- Primary checks: workflow static validation plus branch GitHub Actions E2E and
  release checks.

## Commit Intent

Commit as:

```text
ci: use prebuilt Playwright browser image
```

## Outcome

Implemented the immutable `v1.62.1-noble` Playwright image for the release and
browser jobs, preserving the documentation-only fast path with a lightweight
Node image. The image tag was resolved to
`sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e`.
Release no longer performs a browser installation in CI; the local
`ci:release` command remains self-sufficient.

The browser matrix command had an extra argument separator, which made every
declared shard run the whole suite. It now forwards `--shard` correctly; the
first shard selects 77 tests.

Validated locally: Prettier, `pnpm ci:static`, test-impact, `pnpm
release:verify`, an all-suite single-worker browser run (154/154), and a
shard-list check. On this Windows host, the default 16-worker browser run has
unrelated resource timeouts (61/77 when running the correct first shard), so
the stable local command was used for browser validation. Docker Desktop is not
running, so the container launch preflight and Linux runner behavior await the
review-branch GitHub Actions run.

The implementation was merged to `main` by PR #127. GitHub Actions completed
successfully: static (30s), unit (49s), release (1m 03s), browser shard 1/2
(3m 16s), and browser shard 2/2 (3m 45s). The container image initialized
successfully in all browser-dependent jobs.
