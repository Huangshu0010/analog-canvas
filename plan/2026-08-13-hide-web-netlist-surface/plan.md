---
status: completed
experience: none
---

# Hide Web Netlist Surface

## Goal

Keep the deterministic netlist model, migration, extractor, and printers in the
branch while temporarily removing every user-visible netlist authoring/export
surface from the web editor, then deliver the combined branch to `main` through
a draft pull request.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/netlist-export-system...origin/codex/netlist-export-system
```

The worktree is clean and the current branch already contains `origin/main` at
`56e929c`. No unrelated dirty files are present.

Owned paths:

- `apps/editor/src/app/App.tsx` and its focused tests
- `apps/editor/e2e/` tests that assert the public web command/property surface
- `apps/editor/src/styles.css` only if hidden-surface styles become dead
- `apps/editor/package.json` and `pnpm-lock.yaml` to remove the editor's now-dead
  direct runtime dependency on `@icm/netlist`
- this target plan and `plan/log.md`

Read-only retained implementation:

- `packages/model/`, `packages/symbols/`, `packages/netlist/`, and netlist
  migrations/import facts
- Edit Engine typed netlist operations and generated Agent contracts
- `apps/editor/src/features/netlist-export/netlist-authoring.ts`, which remains
  an internal insertion helper unless removing its use is required to hide UI

## Work

1. Remove SPICE/Spectre commands, explanatory text, and diagnostics from the
   File menu and remove their browser-download orchestration from `App`.
2. Remove Cell netlist interface controls and Instance Reference/Model controls
   from Properties while preserving ordinary component parameter editing.
3. Replace positive public-surface tests with assertions that no netlist terms,
   controls, or downloads are exposed in the web editor.
4. Validate retained lower-level netlist behavior separately so hiding the UI
   does not discard the implementation.
5. Run the full delivery gate, commit, push, and open a draft PR to `main`.

## Validation

- focused App and lower-level netlist unit tests
- focused Playwright assertion that the File and Properties surfaces expose no
  netlist commands or semantic fields
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): hide web netlist surface
```

## Outcome

Removed every public web surface for netlist export and authoring: the
SPICE/Spectre download commands, export explanation and diagnostics, Cell
interface controls, Instance Reference/Model controls, and imported-model
source text. The existing SPICE importer remains visible, while the internal
model, migrations, automatic reference/parameter facts, extractor, printers,
and typed Edit Engine/Agent contracts remain available for later exposure.

Committed as `96d1d8f`, refreshed current `main` with merge commit `d19cf58`,
and opened draft PR #31. Focused tests, the complete local delivery gate, a
100-scenario reduced-concurrency browser run, and all six GitHub Actions checks
passed. One pre-existing canvas-width timing assertion failed on the first
remote browser run and passed unchanged when the failed workflow was rerun.
