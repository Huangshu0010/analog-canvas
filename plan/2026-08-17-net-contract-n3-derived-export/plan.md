---
status: completed
experience: none
---

# Net Contract N3 — Derived, ERC, and Export Convergence

## Goal

Make global Net equivalence a derived ProjectConnectivityIndex fact and make
ERC and deterministic netlist extraction consume the same model Net contract.
Do not alter persisted Net shape, route geometry, or visual diagnostic policy.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated worker infrastructure and
will remain untouched.

- `packages/model/src/net-contract.ts`
- `packages/model/src/net-contract.test.ts`
- `packages/derived/src/connectivity-index.ts`
- `packages/derived/src/net-highlight.ts`
- `packages/derived/src/net-highlight.test.ts`
- `packages/derived/src/diagnostics/erc.ts`
- `packages/derived/src/diagnostics/erc.test.ts`
- `packages/netlist/src/extract.ts`
- `packages/netlist/src/extract.test.ts`
- `plan/2026-08-17-net-contract-n3-derived-export/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model/src/schema/*`
- `packages/edit-engine/src/transaction.ts`
- `packages/derived/src/connectivity.ts`
- `packages/derived/src/diagnostics/diagnostic.ts`
- `packages/netlist/src/ir.ts`
- `docs/roadmap/net-contract-unification-plan.md`

## Work

1. Extend the shared model contract with global-name validity in addition to
   folded duplicate detection.
2. Add derived global-equivalence groups and trace hops to the Project index.
3. Replace ERC and export-local duplicate/global-name logic with the shared
   contract and remove the repeated-power suppression workaround.
4. Add focused positive/negative tests for cross-Cell global trace and
   ERC/export diagnostic parity.

## Validation

- `pnpm test:local packages/model/src/net-contract.test.ts packages/derived/src/net-highlight.test.ts packages/derived/src/diagnostics/erc.test.ts packages/netlist/src/extract.test.ts`
- `pnpm --filter @icm/model build`
- `pnpm --filter @icm/derived build`
- `pnpm --filter @icm/netlist build`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: global Net names are explicit, global groups trace across Cells,
  and ERC/export report matching name-contract violations.
- Primary checks: focused model, derived ERC/trace, and netlist extraction
  tests named above.

## Commit Intent

Commit as:

```text
feat(net): converge derived and export semantics
```

## Outcome

Extended the model Net contract with unnamed-global validation, added derived
global-name equivalence groups and trace hops, and moved ERC/export naming
diagnostics onto that common contract. The historical ERC repeated-power
suppression was removed; the following repair target will canonicalize legacy
duplicates rather than hiding them. Focused model/derived/netlist tests and all
three package builds passed.
