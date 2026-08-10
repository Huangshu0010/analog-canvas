# Repair CI Baseline Without Product Changes

## Goal

Make the repository's existing GitHub Actions CI command chain pass while
preserving the accepted editor interaction, geometry, rendering parameters,
and visual output exactly as they are now. Restrict changes to mechanical
formatting, stale expectations/goldens, and schema validation that currently
rejects values already produced by the implementation.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## agent/fix-ci-baseline
<modified/deleted documentation paths and plan/log.md>
?? plan/2026-08-10-remove-redundant-visual-doc-redirects/
```

Those dirty paths belong to a separate user-owned documentation cleanup. They
do not overlap the CI code/test files. They remain read-only and must not be
formatted, staged, committed, or otherwise rewritten by this target.
`plan/log.md` is also read-only because it has overlapping user changes; this
target records its outcome here until the log can be updated safely.

## Owned Files

- The six files reported by `pnpm format:check`
- Stale tests under `packages/derived/src/`, `packages/render-svg/src/`, and
  `packages/symbols/src/`
- Stale Playwright scenarios under `apps/editor/e2e/`
- Renderer golden fixtures referenced by failing tests
- Phase 7 export golden fixtures regenerated from the current exporter
- Agent snapshot schema/test files needed to accept already-produced
  fractional diagnostic bounds
- Release smoke assertions needed to validate the current Service Worker
  contract instead of an obsolete cache-name literal
- `plan/2026-08-10-repair-ci-baseline/plan.md`

## Read-Only Files

- All dirty paths present at target start, including `plan/log.md`
- Product implementation in `apps/editor/`, geometry/rendering implementation,
  symbol assets, and accepted Razavi profile values
- `.github/workflows/ci.yml`

## Shared Dependencies

- The accepted Razavi visual contract and current generated assets
- Rich-text layout metrics shared by editor hits, export bounds, and snapshots
- Agent snapshot schema and derived diagnostic bounds
- The exact CI command order in `.github/workflows/ci.yml`

## Expected Work

1. Apply Prettier only to the six files already rejected by CI.
2. Remove duplicate stale literal expectations while retaining behavior-level
   assertions, and synchronize tests/goldens with the already accepted output.
3. Align snapshot validation with fractional diagnostic bounds already emitted
   by derived geometry, without changing those bounds or any visual behavior.
4. Run every CI command locally in workflow order and repair only additional
   test/golden drift exposed by those commands.
5. Replace the obsolete release-smoke cache-name literal with assertions on
   the current Service Worker shell contract, without changing the worker.
6. Align browser tests with the current reviewed component palette, grouped
   File menu, canvas text editor, semantic hit targets, and fixture-loading
   surface.
7. Review the final diff to prove that product implementation and accepted
   visual assets remain unchanged.

## Validation

- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm release:verify`
- `pnpm exec playwright install --with-deps chromium` when required by the
  local environment
- `pnpm test:e2e`
- `git diff --check`
- `git status --short --branch`

The full CI chain is required because the current first-step formatting failure
masks downstream test, release, and browser gates.

## Experience Signal (for human review)

CI remained red long enough for stale expectations to accumulate behind the
first failing step. A human may later decide whether this warrants a lesson on
keeping each gate independently observable.

## Commit Intent

Prepare the isolated repair as:

```text
test(ci): synchronize validation with accepted behavior
```

## Outcome

Synchronized the CI baseline without changing editor, geometry, routing, or
rendering implementation. The repair consists of the six required Prettier
updates, current generated catalog hashes, stale unit/E2E expectations,
regenerated visual/export goldens, fractional validation for already-derived
diagnostic bounds, and a release smoke assertion on the observable Service
Worker contract rather than its obsolete cache-name literal.

The legacy rich-text gates were replaced with behavior-level checks: layout
tests now exercise supplied metrics instead of requiring a `0.8` subscript
scale, and the browser test verifies that the user-authored `R_LOAD` label is
preserved verbatim instead of requiring an implicit underscore-to-subscript
conversion.

Validation completed:

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test` (62 files, 365 tests)
- `pnpm release:verify`
- `pnpm test:e2e` (58 tests)
- `git diff --check`

The locally installed Chromium satisfied Playwright, so reinstalling the same
browser was unnecessary. `plan/log.md` remains untouched by this target due to
the overlapping user-owned documentation cleanup recorded above; this outcome
is retained here for later log integration.
