---
status: completed
experience: none
---

# Add conservative floating gate and bulk ERC policy

## Goal

Extend the existing ERC engine with deterministic role-aware diagnostics for
floating MOS gates and hidden bulk presentation, without guessing model data or
changing electrical connectivity.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns only derived ERC policy and its unit
fixtures. It deliberately leaves model binding evidence, diagnostics UI, and
generic role semantics for separate targets.

- `packages/derived/src/diagnostics/erc.ts`
- `packages/derived/src/diagnostics/erc.test.ts`
- `plan/2026-08-12-connectivity-recovery-c8b/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model` pin and Net schema
- `packages/symbols` reviewed pin roles and symbol variants
- `packages/derived/src/connectivity-index.ts` endpoint-to-Net index

## Work

1. Treat explicit `gate` and `bulk` pin roles as specialized ERC policy rather
   than issuing duplicate generic unconnected-pin diagnostics.
2. Report a gate that has no Net or only an internal one-terminal Net, unless
   explicitly marked No Connect.
3. Report an unconnected bulk and a three-terminal-hidden bulk on a non-safe
   local body Net; accept named supply/global Net conventions and NoConnect.
4. Add positive, negative, hidden-variant, and NoConnect suppression tests.

## Validation

- `corepack pnpm exec vitest run packages/derived/src/diagnostics/erc.test.ts`
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(erc): diagnose floating gates and hidden bulk risks
```

## Outcome

Added role-sensitive `ERC_FLOATING_GATE` and `ERC_FLOATING_BULK` checks. Gate
warnings cover missing or one-terminal internal Nets; bulk warnings cover
missing Net membership and a three-terminal-hidden bulk on a non-safe local
body Net. Explicit NoConnect and conventional global/supply Net membership
suppress the respective warnings. Focused ERC tests and workspace typecheck
passed.
