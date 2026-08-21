---
status: completed
experience: none
---

# Stack top-Cell Port export semantics onto unified Port interaction

## Goal

Stack `codex/top-cell-port-net-semantics` onto
`codex/insert-unification` so one branch can be tested as a whole. Preserve the
unified Library/Insert/Port Setup flow, Free Port same-name Net lifecycle, and
Razavi labels while adding correct top-Cell formal interfaces and non-emitting
Free Port netlist export.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-unification...origin/codex/insert-unification
```

Both source worktrees are clean. The branches share `origin/main`; the target
branch contains six Port/Insert commits and the source branch contains one
top-Cell/export commit. Owned paths are the union touched by commit
`60d52ebb`, plus the current Port Setup component/tests, this plan, and
`plan/log.md`.

Shared contracts:

- Free Net Port owns `Net.name`, is non-emitting, and same-folded names share
  one electrical Net.
- Formal Cell Pin owns a `CellTerminal` and is available in every Document,
  including the top Document.
- `P`, Library Port, and Insert Port retain one dedicated Port Setup surface;
  top-level quick placement defaults to Free Net Port while Formal Cell Pin is
  an explicit choice.
- No new persisted model type, Edit Engine operation, or Agent API endpoint is
  introduced by the stack.

## Work

1. Integrate commit `60d52ebb`, resolving UI/browser/docs conflicts in favor
   of the current unified Port Setup flow.
2. Enable the Formal Cell Pin choice at top level without changing the current
   top-level Free Port default or child-Cell formal default.
3. Retain the source branch's netlist extraction ordering and Free Port
   omission/validation, then align browser tests with the unified interaction.
4. Reconcile ADR/spec/user documentation and both factual plan logs without
   dropping either target's history.

## Validation

- focused Port Setup and netlist unit tests
- focused hierarchy and manual-editor Port browser tests
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: top Cell formal header export; Free Port omission and validation;
  unified Port Setup entry; same-name Net merge and final lifecycle cleanup.
- Primary checks: netlist current-contract tests plus actual top Formal Pin and
  Free Port browser flows.

## Commit Intent

Integrate the source commit with preserved provenance, then commit bounded
conflict-resolution follow-up as:

```text
fix(editor): reconcile stacked port semantics
```

## Outcome

Stacked the source target as `dff2568c` while preserving the current dedicated
Port Setup, scoped Insert controller, generated Free Port names, Razavi text,
same-name electrical merge, and final-Net cleanup. Top and child Documents now
both expose Free Net Port and Formal Cell Pin explicitly. Top defaults to Free
Net Port for the direct `P` workflow; child Documents default to Formal Cell
Pin. Netlist extraction uses formal terminal names before anonymous names,
omits connected Free Port markers, and rejects unconnected markers.

Validation passed: 29 focused unit tests, 5 combined browser Port workflows,
typecheck, formatting, documentation links, test-impact, diff checks, and
`pnpm verify:branch` (164 unit files / 986 tests, all workspace builds, and
production preview smoke).

The source branch remains unchanged. The integrated branch is ready for the
user's unified GUI/netlist test.
