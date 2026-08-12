---
status: completed
experience: none
---

# WP-R8 — ERC Engine (framework + core rules)

## Goal

Land the ERC engine (roadmap §8 R8) in `packages/derived/src/diagnostics/erc.ts`,
emitting the unified ADR 0015 `Diagnostic` envelope (`domain: "erc"`), driven by
the `ProjectConnectivityIndex` (R2) and the persisted `NoConnect` records (R7).
This target delivers the framework plus a representative, fully-tested rule set;
role/hierarchy-specific rules are deferred (below).

## Scope (rules in this target)

- `ERC_DUPLICATE_INSTANCE_NAME` — two instances in one Document share a
  normalized display/`spice.name`. Error.
- `ERC_DUPLICATE_NET_NAME` — two Nets in one Document share a normalized name
  with no explicit merge. Error.
- `ERC_NO_CONNECT_CONFLICT` — an endpoint is both on a Net and declared
  NoConnect (defensive; schema also rejects). Error.
- `ERC_UNCONNECTED_PIN` — a visible pin (terminal) with no Net membership and no
  NoConnect. Warning. (v1-conservative required-pin policy: all visible pins;
  passive-pin tolerance refinement deferred.)

Deferred to follow-on (need specialized fixtures + symbol-role/hierarchy data):
`ERC_FLOATING_GATE`, `ERC_FLOATING_BULK`, `ERC_MISSING_MODEL`,
`ERC_UNSUPPORTED_MODEL`, `ERC_PORT_COUNT_MISMATCH`, `ERC_PORT_NAME_MISMATCH`,
`ERC_HIERARCHY_TARGET_MISSING`, `ERC_HIERARCHY_INTERFACE_STALE`,
`ERC_ILLEGAL_PIN_NAME`. The framework here is the extension point.

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0..R7 committed)
```

Owned paths:

- `packages/derived/src/diagnostics/erc.ts` (NEW)
- `packages/derived/src/diagnostics/erc.test.ts` (NEW)
- `packages/derived/src/index.ts` (re-export)
- `plan/2026-08-12-wp-r8-erc-engine/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: `packages/derived/src/connectivity-index.ts`, `net-highlight.js`,
`endpoint.js`; `packages/model` (NoConnect). No editor/UI code.

Shared: the `Diagnostic` envelope matches ADR 0015; `domain: "erc"` is distinct
from `visual`/`spice`.

## Work

1. `diagnostics/erc.ts`:
   - `ErcDiagnostic` = ADR 0015 `Diagnostic` with `domain: "erc"`.
   - `runErcChecks(project, index, resolver): readonly ErcDiagnostic[]`.
   - Each rule produces a stable id, code, severity, confidence, gateEligible,
     message, `primary` locator, `related` locators, and typed parameters.
   - Deterministic ordering by `(documentId, code, primary.objectId)`.
2. `index.ts` re-export.
3. `erc.test.ts`: per rule — positive (fires), negative (clean project passes),
   NoConnect suppression for `ERC_UNCONNECTED_PIN`, and conflict for
   `ERC_NO_CONNECT_CONFLICT`; duplicate-name detection for instance and net.

## Validation

- `pnpm typecheck`
- `pnpm exec vitest run packages/derived/src/`
- `pnpm exec prettier --check` on new `.ts`
- `git diff --check`

## Commit Intent

```text
feat(derived): add ERC engine emitting the unified diagnostic envelope (WP-R8)
```

## Outcome

Landed the ERC engine framework plus a representative, fully-tested rule set,
emitting the unified ADR 0015 `Diagnostic` envelope (`domain: "erc"`), driven by
the `ProjectConnectivityIndex` (R2) and the persisted `NoConnect` records (R7).
Electrical rules are kept strictly separate from visual/routing observations.

- `packages/derived/src/diagnostics/erc.ts`: `ErcDiagnostic` (ADR 0015 envelope),
  `ErcLocator` (with terminal/port/no-connect kinds), and `runErcChecks(project,
  index, resolver)`. Rules: `ERC_DUPLICATE_INSTANCE_NAME` (error),
  `ERC_DUPLICATE_NET_NAME` (error), `ERC_NO_CONNECT_CONFLICT` (error, defensive —
  the schema invariant already rejects), `ERC_UNCONNECTED_PIN` (warning,
  v1-conservative required-pin policy: every visible, non-implicit, non-hidden
  pin must have a Net or a NoConnect). Deterministic ordering.
- `packages/derived/src/index.ts`: re-export.
- `packages/derived/src/diagnostics/erc.test.ts` (6 tests): clean project silent;
  unconnected pins flagged and suppressed by NoConnect; implicit pin not
  required; duplicate instance name; duplicate net name; defensive NoConnect
  conflict.

Validation: workspace `pnpm typecheck` passed; `vitest run packages/derived/src/`
passed (109 tests, was 103); `prettier --check` on new `.ts`; `git diff --check`
clean.

Deferred (role/hierarchy-specific, need specialized fixtures + symbol-role
policy): `ERC_FLOATING_GATE`, `ERC_FLOATING_BULK`, `ERC_MISSING_MODEL`,
`ERC_UNSUPPORTED_MODEL`, `ERC_PORT_COUNT_MISMATCH`, `ERC_PORT_NAME_MISMATCH`,
`ERC_HIERARCHY_TARGET_MISSING`, `ERC_HIERARCHY_INTERFACE_STALE`,
`ERC_ILLEGAL_PIN_NAME`. The framework and locator/envelope shape are the
extension point. Also deferred: the passive-pin tolerance refinement to the
required-pin policy.

`status: completed`, `experience: none`.
