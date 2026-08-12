---
status: active
experience: none
---

# Establish CI Delivery Gates and Retire Obsolete VSS Archive

## Goal

Restore a trustworthy green CI baseline without changing accepted editor
behavior, then make that baseline durable: a change must not enter `main`
until the same clean-environment checks pass locally and in GitHub Actions.
In parallel, determine whether the retired Visio/VSS archive can be removed
from the working tree, and only remove it when every active dependency and
historical-retention requirement has been explicitly resolved.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns the CI command surface, Actions
workflow, CI-specific test/golden repairs, the workflow rules in `AGENTS.md`,
and the VSS-retirement inventory and archival changes that are proven safe.

- `.github/workflows/ci.yml`
- `package.json` and a CI orchestration script if one is needed
- `AGENTS.md`, `README.md`, and `plan/README.md`
- stale tests and golden fixtures directly reported by the current CI run
- export font configuration and export golden fixtures only when visual output
  is verified equivalent on the supported runner
- VSS archive/tool/fixture/document paths only after the retirement audit
- `plan/2026-08-12-ci-delivery-and-archive-governance/plan.md`
- `plan/log.md`

Read-only until an explicit migration/deletion decision is recorded:

- `lib/circuit.vss`
- `tools/vss-import/**`
- `scripts/generate-visio-*.mjs`
- `fixtures/symbols/vss-ir/**`
- `fixtures/visual-reference/visio-*/**`
- historical plans and archived documentation

Shared dependencies:

- the accepted editor interaction and rendering behavior
- active Razavi visual authority under
  `fixtures/visual-reference/razavi-reference-v1/`
- ADR 0011 and the replacement PDF-vector evidence policy
- GitHub repository settings for `main`

## Work

1. Record the current failures from one immutable CI run and reproduce each
   locally where possible. Classify every failure as stale expectation,
   environment contract, cross-platform nondeterminism, or genuine product
   regression.
2. Add one checked-in command that runs the full CI contract in the same order
   as GitHub Actions, including a clean build before browser tests. Make the
   workflow call that command or the same underlying commands, so the two
   surfaces cannot drift.
3. Repair only the failures that are confirmed to be stale or environmental:
   format omissions; symbol-list, label-placement, and SVG golden expectations;
   E2E workspace build precondition; and deterministic export font/raster
   configuration. Do not alter accepted editor interaction, geometry, or
   product-visible styling merely to satisfy a test.
4. Run the complete CI contract in a clean workspace. Push a repair branch,
   inspect the GitHub Actions results, and keep the target active until all
   required jobs pass.
5. Make the mainline delivery rule explicit in `AGENTS.md`: focused checks are
   appropriate during development, but non-document changes may enter `main`
   only after the canonical CI command and remote required checks are green.
   Require agents to report and resolve a red remote result rather than
   treating `git push` as completion.
6. Configure GitHub `main` protection or a repository ruleset requiring the CI
   jobs and a pull-request merge path, provided the current token/repository
   permissions permit it. Record the exact external setting and any
   administrative action still needed.
7. Perform a VSS retirement audit separately from the CI repair: list every
   active reference, provenance record, generated artifact, and historical
   retention need. Choose one of: retain in an explicit archive location,
   remove from the working tree after a provenance snapshot, or defer because
   a dependency remains. Do not delete `lib/` in this target merely for
   tidiness.
8. If the audit proves the retirement set is independent and safe, execute it
   as a separately reviewable commit after CI is green; otherwise record the
   unresolved dependency and leave the archived files unchanged.

## Validation

- `pnpm install --frozen-lockfile` in a clean dependency/build state
- canonical local CI command
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm release:verify`
- `pnpm exec playwright install --with-deps chromium` when the environment
  requires installation
- `pnpm test:e2e`
- GitHub Actions jobs for the pushed repair branch all pass
- VSS-retirement reference audit returns no active product/build dependency
  before any archive deletion
- `git diff --check`
- `git status --short --branch`

The complete CI chain is required for the repair because independent jobs had
been failing behind a previously unprotected `main`. Focused checks remain the
normal development loop for subsequent bounded product work.

## Commit Intent

Use separate commits so delivery governance, CI repair, and any VSS archive
retirement remain independently reviewable:

```text
ci: establish reproducible mainline delivery gate
test(ci): synchronize checks with accepted behavior
chore(archive): retire resolved VSS development artifacts
```

## Outcome

Populate after the remote CI result and VSS retirement decision are known.
