---
status: completed
experience: none
---

# Schematic Lifecycle Mainline Gate

## Goal

Close the canonical `pnpm ci:check` failures discovered while delivering the
schema-18 schematic lifecycle branch, without weakening accepted behavior or
expanding product scope.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/schematic-instance-lifecycle-ux
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean at `92bb97e7`. The untracked dependency and
worktree directories are local infrastructure, remain out of scope, and will
not be staged.

Owned paths:

- failing editor E2E specifications for explicit Port insertion, editable
  bound RichText, current schema persistence, Copy, and deletion behavior;
- editor/model/edit-engine implementation only where a focused reproduction
  proves a real regression;
- this plan and `plan/log.md`.

Read-only shared dependencies include schema 18, annotation bindings,
selection/clipboard semantics, connectivity cleanup, and the explicit
free/formal Port insertion protocol.

## Work

1. Update obsolete Port, bound-text, and schema-version browser assertions to
   the accepted schema-18 protocol.
2. Reproduce Copy and connected-deletion failures independently; repair the
   smallest implementation contract if they are real regressions, otherwise
   update only stale expectations.
3. Run every previously failing test focused, then the complete canonical
   mainline gate from a frozen dependency state.

## Validation

- focused `pnpm test:e2e:local` runs for all 14 reported failures;
- `pnpm test:impact -- --base origin/main`;
- `pnpm install --frozen-lockfile` and `pnpm ci:check`;
- `git diff --check` and final status audit.

## Test Impact

- Decision: tests-updated
- Contracts: explicit Port insertion, schema-18 persistence, editable
  Net/terminal-bound RichText, repeated Copy placement, and safe connected
  deletion.
- Implementation tests will be added only for any confirmed product defect.

## Commit Intent

Commit as:

```text
test(editor): align lifecycle mainline gate
```

## Outcome

Closed all 14 canonical-gate failures. Copy was a real product regression:
paste incremented `netlist.reference` but retained the source
`schematicReference`, so schema validation rejected every copied instance.
Clipboard paste now allocates a bounded, unique schematic reference and keeps
the common schematic/netlist reference pair synchronized. The remaining
failures were stale browser contracts for explicit Port insertion, editable
Net-bound RichText, connected deletion, and schema-18 persistence.

Validation passed:

- Clipboard unit contract: 1 file / 8 tests;
- all 14 originally failing browser cases in focused runs;
- `pnpm test:impact -- --base origin/main`, typecheck, formatting and diff
  checks;
- canonical `pnpm install --frozen-lockfile` plus `pnpm ci:check`: static
  contracts, 162 unit files / 975 tests, all workspace builds, release and MCP
  smoke checks, and 167/167 browser tests.
