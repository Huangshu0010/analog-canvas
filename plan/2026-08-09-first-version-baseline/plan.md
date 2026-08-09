# First Version Baseline

## Goal

Turn the reviewed, expected first-version worktree into a reproducible Git
baseline before beginning the separate GitHub Pages publishing target. This
baseline is a local-first browser circuit editor. It does not expose an Agent
API, MCP surface, account system, backend, or server-side Project storage.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## feat/razavi-fidelity-diff-harness...origin/feat/razavi-fidelity-diff-harness [ahead 2, behind 1]
M editor, model, edit-engine, renderer, documentation, plan log, and lockfile paths
?? browser platform package, completed target plans, local diagnostics, and generated artifacts
```

The user confirmed that the broad implementation set is the expected first
version. The untracked `.zcode/`, fidelity text-diff reports,
`agent-bandpass-layout.*` exports, and `probe-conflicts.mjs` are local tool,
diagnostic, or generated outputs and are not release inputs. They will be
ignored, not deleted. The remote-only hierarchy commit is patch-equivalent to
the local commit except for its maintenance-log wording; reconcile it by a
non-destructive rebase only after the baseline is committed.

## Owned Files

- `.gitignore`
- all currently modified and untracked first-version editor, package, test,
  documentation, and `plan/` paths listed by `git status`
- `plan/2026-08-09-first-version-baseline/**`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- existing committed fixture assets and historical plans not already untracked
- the local diagnostic/generated outputs named above

## Shared Dependencies

- Project schema and edit transaction contracts
- Vite base-path and PWA service-worker scope
- browser-only persistence interfaces
- Git remote branch history

## Expected Work

1. Classify the worktree and ignore only confirmed local/generated outputs.
2. Run focused build/test/type checks appropriate to the editor, persistence,
   routing, and drafting changes; record any unrelated failures precisely.
3. Review the staged baseline, update the factual maintenance log, commit it,
   and non-destructively reconcile the patch-equivalent remote commit.
4. Leave a clean worktree ready for a separately planned Pages deployment
   workflow.

## Validation

- focused platform-web, edit-engine, derived, render, and editor checks
- `pnpm --filter @icm/editor build`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

The baseline spans shared editor contracts and release shell behavior, so it
requires focused regression coverage plus editor build/type verification. A
full end-to-end suite is run only if the focused checks expose an integration
risk that needs broader confirmation.

## Experience Signal (for human review)

Several independently completed targets accumulated in one shared worktree.
This is recorded as release-integration evidence only; no reusable lesson is
extracted unless the human requests one.

## Commit Intent

Commit as:

```text
feat(editor): establish local-first browser editor baseline
```

## Progress and Validation (2026-08-09)

- Added narrowly scoped ignore rules for local Codex scratch, temporary fidelity
  diagnostics, and generated Agent-layout exports. Those files remain on disk
  and are deliberately not deleted or staged.
- Passed: `pnpm exec vitest run packages/platform-web/src/browser-recovery.test.ts
  packages/platform-web/src/file-system-access.test.ts
  packages/edit-engine/src/routing.test.ts packages/edit-engine/src/drafting.test.ts
  packages/derived/src/drafting-geometry.test.ts
  packages/render-svg/src/drafting-render.test.ts` (6 files, 50 tests).
- Passed: `pnpm --filter @icm/platform-web build` and
  `pnpm --filter @icm/editor build`.
- `pnpm typecheck` is blocked solely by six pre-existing
  `packages/symbols/src/razavi-catalog.test.ts` accesses to removed `leadsPx`
  fixture data; no type error points at the baseline's changed files.
- The combined drafting/manual Playwright invocation exceeded its 120-second
  command budget without a completed report, so it is not claimed as passing.
- `git diff --check` is clean.
