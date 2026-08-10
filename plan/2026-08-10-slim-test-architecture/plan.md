# Slim Test Architecture

## Goal

Reduce test-system maintenance weight without removing behavioral coverage or
changing editor, model, geometry, routing, rendering, export, or recovery
behavior. Make independent gates observable, stop wasting runs superseded by a
new commit, skip the redundant post-merge run for documentation-only changes,
shard the browser suite, and replace historical phase/work-package labels with
durable behavior descriptions.

## Dirty-State Decision

The worktree contains an independently owned documentation/archive cleanup and
its plan. Those paths, including `plan/log.md`, are read-only for this target.
Recent editor architecture and recovery targets are committed through
`1a17c2b`; their product files are clean. The shared E2E command helpers were
already extracted in `06a97b0`, so this target will reuse them rather than
claiming or duplicating that work.

## Owned Files

- `.github/workflows/ci.yml`
- `playwright.config.ts`
- Test descriptions/comments containing obsolete phase, stage, priority, or
  work-package gate identifiers under `apps/editor/e2e/` and `packages/`
- `plan/2026-08-10-slim-test-architecture/plan.md`

## Read-Only Files

- All unrelated dirty documentation paths and `plan/log.md`
- Product implementation under `apps/editor/src/` and non-test package source
- Test bodies, fixtures, goldens, and assertions except where validation
  exposes a genuine infrastructure defect
- `apps/editor/e2e/editor-fixtures.ts`, whose helper extraction is already
  complete

## Shared Dependencies

- CI must continue to run formatting, pinned-reference validation, typecheck,
  all Vitest tests, the complete release verification chain, Chromium setup,
  and every Playwright scenario for code changes.
- GitHub Pages deployment is separate and remains untouched.
- Pull requests always emit the required CI checks. Documentation-only
  filtering applies only to the duplicate `main` push after merge, and must not
  suppress workflow, source, fixture, package metadata, reference JSON, or test
  changes.
- Playwright shards must retain the complete test set and disable matrix
  fail-fast so both halves report independently. Tests use isolated browser
  contexts and must not depend on declaration order.

## Expected Work

1. Add workflow concurrency cancellation for superseded runs.
2. Skip only the redundant `main` push run when every changed path is
   documentation/plan content; keep pull-request checks visible for branch
   protection.
3. Split static, unit, release, and E2E validation into independently visible
   jobs; enable test-level Playwright parallelism and shard E2E into two
   balanced workers.
4. Expand the opaque release step into named checks while preserving the exact
   `release:verify` command order and one workspace build.
5. Remove historical `Phase`, `Stage`, `P0/P1`, and `WP-*` labels from test
   names/comments where the behavior itself is already stated. Preserve real
   fixture names and electrical pin names such as `P1`.
6. Validate that test discovery/counts and all behavior remain unchanged.

## Validation

- Prettier check for the workflow and touched TypeScript files
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm release:verify`
- `pnpm exec playwright test --list` with the same test count
- `pnpm test:e2e`
- Local shard 1/2 and shard 2/2 test-list union covers all Playwright tests
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit only the owned paths as:

```text
refactor(test): streamline validation architecture
```

## Outcome

- Split the former serial validation job into independently visible static,
  unit/integration, release, and browser jobs.
- Expanded release verification into named steps while preserving its exact
  build, performance, export-golden, icon, production-preview, package, and
  packaged-smoke order.
- Added workflow concurrency cancellation so a newer commit supersedes an
  older run on the same ref.
- Kept pull-request checks unconditional for branch-protection compatibility;
  only documentation-only `main` pushes skip the redundant post-merge run.
- Enabled test-level Playwright parallelism and two CI shards. Discovery is
  balanced 30/29, and the union is exactly the complete 59-test suite.
- Removed obsolete phase, stage, priority, and work-package identifiers from
  test descriptions/comments without deleting or changing any assertion.

GitHub's current official workflow and Playwright sharding documentation were
used to verify the concurrency, path-filter, matrix, and `--shard=x/y` syntax.
A read-only repository check found that `main` currently has no branch
protection rule requiring the previous job name.

Validation completed against both an isolated clean worktree and the latest
committed editor architecture baseline (`730edac`):

- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- focused renamed tests: 11 files, 102 tests
- current full `pnpm test`: 68 files, 389 tests
- `pnpm release:verify`
- Playwright discovery: 59 total, shards 30 + 29, no missing or extra tests
- current full `pnpm test:e2e`: 59 tests in 33.5 seconds
- `git diff --check`

The previous non-parallel local E2E run took about 63 seconds; test-level
parallelism reduced the same behavioral suite to about 34 seconds without
reducing coverage. `plan/log.md` remains untouched because it belongs to the
concurrent documentation/archive target.
