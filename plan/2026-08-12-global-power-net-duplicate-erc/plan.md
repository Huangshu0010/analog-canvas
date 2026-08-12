---
status: completed
experience: none
---

# Global power-Net duplicate ERC exemption

## Goal

Accept multiple independently placed Ground/VDD symbols that normalize to the
same global power-domain name, while preserving `ERC_DUPLICATE_NET_NAME` for
ordinary same-name local or non-power Nets.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/razavi-bulk-semantics...origin/codex/razavi-bulk-semantics
```

The worktree is clean. This target owns:

- `packages/derived/src/diagnostics/erc.ts`
- `packages/derived/src/diagnostics/erc.test.ts`
- target plan and `plan/log.md`

Shared dependency: model-level `powerDomainForNet()` power-symbol classifier.

## Work

1. Exempt only same-domain, global VDD or ground Net groups from the duplicate
   Net-name ERC rule.
2. Add regression coverage for multiple Ground symbols and retain the existing
   ordinary duplicate-name failure case.

## Validation

- focused ERC tests
- `corepack pnpm typecheck`
- `corepack pnpm format:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(erc): accept repeated global power Nets
```

## Outcome

Completed a narrow ERC correction. `ERC_DUPLICATE_NET_NAME` now exempts a
same-name group only when every Net is global and every Net is classified from
its symbol terminals as the same `ground` or `vdd` power domain. Ordinary
duplicate local/signal Nets retain the existing error. Added a two-Ground
regression alongside the existing ordinary duplicate-name test.

Validation passed: focused ERC tests (16), workspace typecheck, format check,
and `git diff --check`.
