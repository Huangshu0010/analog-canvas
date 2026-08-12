---
status: completed
experience: none
---

# Electrical Contact Integrity

## Goal

Make Razavi MOS placement and pin-to-pin snapping electrically truthful: an
accepted visual contact must write the corresponding Net membership, while the
three-terminal presentation retains an explicit, safe bulk policy. Correct the
PMOS artwork pin roles to match its Razavi orientation without silently
rewriting imported SPICE connectivity.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target intentionally continues on the current
branch: it contains the full connectivity-roadmap history and its CI-gate
ancestors; later `origin/main` changes are Cloudflare deployment files only.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/snap/`
- `apps/editor/src/presentation/razavi-presentation.ts`
- `apps/editor/src/features/component-insert/` (if placement needs a pure proposal)
- `packages/edit-engine/src/`
- `packages/symbols/assets/razavi-v1/{pmos.symbol.json,catalog.json}`
- generated Razavi catalog artifacts and focused tests
- `fixtures/projects/phase-5-dense-analog/` and its generated visual golden,
  updated as an explicit orientation migration so the known electrical fixture
  preserves its source/drain geometry after the catalog correction
- `fixtures/exports/phase-7-dense-analog/` generated formal outputs, updated only when
  the PMOS symbol-role correction changes its formally rendered artifact
- `plan/log.md`

Shared dependencies: the model's Net/terminal contract, the transaction edit
engine, and the Razavi catalog generator. Existing imported SPICE remains
read-only evidence: source D/G/S/B order must not be guessed or changed.

## Work

1. Characterize the M4/M5 failure as a document-level regression: visually
   touching pins must not remain absent from their Net, and manual three-terminal
   MOS must not acquire an unsafe implicit body short.
2. Move pin-contact proposal logic to a deterministic shared editor/edit-engine
   boundary and use it for component placement and pin-to-pin movement; reject
   ambiguous or incompatible Net contacts rather than creating a visual-only
   connection. Reconcile the same safe, unambiguous power-symbol contacts in
   pre-existing manual documents so an already visible VDD/GND contact does
   not remain a legacy ERC false positive.
3. Define a conservative Razavi three-terminal bulk policy: explicitly connect
   only a new/manual MOS body to its matching existing global supply when that
   supply is unambiguous; otherwise retain B and emit the existing diagnostic.
4. Correct PMOS top/bottom pin roles in the Razavi symbol source and generated
   catalog, preserving canonical imported SPICE D/G/S/B facts through explicit
   symbol migration rather than an implicit reinterpretation.
5. Migrate the owned dense-analog fixture's PMOS orientation explicitly, then
   add focused regression tests, regenerate protected catalog assets and any
   affected formal SVG golden, and validate behavior, types, formatting, and
   the applicable build/checks.

## Validation

- `corepack pnpm --filter @icm/editor test -- --run <focused tests>`
- `corepack pnpm --filter @icm/edit-engine test -- --run <focused tests>`
- `corepack pnpm symbols:razavi:check`
- `corepack pnpm typecheck`
- `corepack pnpm format:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): preserve electrical truth at Razavi MOS contacts
```

## Outcome

Implemented the electrical-contact boundary for manual Razavi authoring and
legacy manual documents. Exact, unambiguous VDD/GND pin contact now persists a
Net (new supply Nets are global); pre-existing power contacts are reconciled on
open/edit without ever merging two existing Nets. Hidden three-terminal MOS B
is retained and may join only its matching explicit global supply for manual,
unbound devices—never B=S and never imported/source-bound devices. PMOS source
and drain roles now match the canonical Razavi orientation, with the owned
fixture orientation and affected formal artifacts migrated explicitly.

Validation passed: frozen dependency install; complete `pnpm ci:check` (583
unit tests, 82 browser E2E tests, release/performance/export/smoke gates);
focused placement/bulk/PMOS regressions; catalog, Agent API, Phase 5 and Phase
7 generated-artifact checks; `git diff --check`.
