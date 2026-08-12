---
status: completed
experience: none
---

# Diagnose stale imported pin mappings

## Goal

Detect persisted `spice.pin.P*` import evidence that no longer maps one-to-one
to the resolved symbol's electrical pins, without imposing SPICE naming rules
on manually authored instances.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target is a pure derived ERC change. Only explicitly
persisted positional import facts are checked; missing `spice.pin.*` properties
remain valid for manual instances.

- `packages/derived/src/diagnostics/erc.ts`
- `packages/derived/src/diagnostics/erc.test.ts`
- `plan/2026-08-12-connectivity-recovery-c8d/plan.md`
- `plan/log.md`

## Work

1. Parse positional imported pin evidence deterministically.
2. Diagnose an unknown pin name, invalid non-string pin fact, or duplicate
   mapping against a resolved symbol.
3. Add positive and non-imported negative cases.

## Validation

- focused ERC Vitest
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(erc): diagnose stale imported pin mappings
```

## Outcome

Added `ERC_ILLEGAL_PIN_NAME` for explicit positional SPICE pin facts. The rule
reports unknown, non-string, and duplicate pin mappings against a resolved
symbol, while instances without import facts remain outside the check. Focused
ERC tests and workspace typecheck passed.
