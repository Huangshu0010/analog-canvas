---
status: completed
experience: none
---

# Deduplicate test contracts

## Goal

Reduce local and CI test maintenance and execution weight by assigning each
important behavior one primary test layer, consolidating repeated fixtures and
removing redundant cross-layer assertions without changing product behavior or
weakening retained contracts.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/test-contract-dedup
```

The worktree is clean and the branch starts at current `origin/main`. A
separate worktree owns the netlist-export target, so its implementation and
tests are read-only here.

- Owned: existing non-netlist tests under `apps/editor/e2e/`, `apps/editor/src/`,
  and `packages/`
- Owned: shared non-netlist test fixtures/helpers when consolidation is proven
- Owned: test-runner configuration only if measurement demonstrates a safe,
  behavior-neutral improvement
- Owned: this target plan and `plan/log.md`
- Read-only: `packages/netlist/`
- Read-only: `apps/editor/src/features/netlist-export/`
- Read-only: netlist contract additions under model, symbols, and edit-engine
- Read-only: all product implementation unless a test exposes an independent
  defect, which would require a separate target

## Work

1. Inventory test files, discovered cases, large suites, repeated fixture
   construction, and cross-layer assertions.
2. Build a concise ownership matrix for model, edit engine, derived geometry,
   renderer, editor unit tests, browser workflows, and visual goldens.
3. Remove only demonstrably redundant assertions/scenarios and consolidate
   repeated non-netlist fixtures or helpers.
4. Keep one primary gate per behavior plus integration coverage at real layer
   boundaries; retain explicit rejection, migration, history, and visual
   contracts.
5. Compare discovery, runtime, and validation results before closing.

## Validation

- focused tests after each consolidation
- `pnpm test`
- Playwright discovery and affected focused browser scenarios
- `pnpm typecheck`
- `pnpm build` when shared test imports or configuration changes
- `git diff --check`
- `git status --short --branch`

The full browser suite is not the default editing loop. Run focused affected
scenarios locally; the canonical full suite remains a delivery gate.

## Commit Intent

Commit as:

```text
refactor(test): deduplicate behavioral contracts
```

## Outcome

Removed 368 lines and added 28 focused lines without changing product code.
The retained ownership matrix is now explicit in the suite structure:

- model owns semantic-text parsing cases;
- renderer owns SVG composition, not parser matrices;
- connectivity index owns normalized identity, typed edges, geometry, object
  lookup, and hierarchy rather than old/new self-parity;
- Agent snapshot owns the canonical electrical-topology hash contract, while
  Agent/Edit Engine parity owns cross-path Document and SVG equality;
- Browser tests own user-visible wiring, while shortcut mapping, production
  smoke, catalogue completeness, visual goldens, and renderer details remain
  in their cheaper deterministic gates.

Deleted the obsolete eight-case deletion-gate file, four same-source
connectivity fixture comparisons, duplicate Agent stale/hash checks, duplicate
renderer text coverage, and four redundant Playwright scenarios. Reduced the
symbol-preview browser matrix from ten symbols to two representative primitive
families. No netlist-export path was touched.

Validation passed: 107 Vitest files / 654 tests with two workers, 81 focused
tests during consolidation, three focused Playwright scenarios, Playwright
discovery at 95 tests in five files, TypeScript typecheck, Prettier, and
`git diff --check`. The full browser suite remains the remote delivery gate.
