---
status: completed
experience: none
---

# Restore MOS Supply Defaults

## Goal

Restore the current manual-authoring rule that an unbound NMOS bulk defaults to
the global ground Net and an unbound PMOS bulk defaults to the global VDD Net,
creating the canonical Net when it does not yet exist. Preserve the existing
explicit `bulk-dashed` workflow as a higher-priority override that atomically
removes the implicit binding before connecting the chosen body-bias Net.

This is a current `supply-default` contract, not restoration of symbol aliases,
legacy VDD components, name-only compatibility routing, or old Project/API
versions. Imported/source-bound MOS devices with missing fourth-node evidence
remain unresolved rather than guessed.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-transport-watchdog...origin/codex/agent-transport-watchdog
```

The worktree is clean. This correction follows the completed current-contract
clean break on the same branch and owns only the MOS default/override contract.

Owned paths:

- `packages/model/src/schema.ts` and focused schema tests/fixtures
- `packages/derived/src/mos-bulk.ts` and focused tests
- `packages/edit-engine/src/transaction.ts` and focused tests
- `apps/editor/src/presentation/razavi-presentation.ts` and focused tests
- `apps/editor/src/features/component-insert/placement-connectivity.ts`,
  `vdd-rail.ts`, their callers, and focused tests
- Agent Snapshot schema/status artifacts when the status vocabulary changes
- current MOS connectivity/editor specifications
- this plan, `plan/root-audit.md`, and `plan/log.md`

Read-only dependencies include current `nmos`/`pmos`, Ground, and Port symbol
assets. The existing App `bulk-dashed` transaction is exercised without
redesign. Ground placement and VDD rail construction are in scope because they
must reuse the supply-default Net rather than create a disconnected duplicate.

## Contract

1. Explicit B Net membership always wins.
2. A configured cell-level MOS bulk default wins over the supply default.
3. A manual unbound NMOS uses/creates canonical global Net `net-global-0`, name
   `0`, `powerDomain: ground`; PMOS uses/creates `net-global-vdd`, name `VDD`,
   `powerDomain: vdd`.
4. The implicit B membership is persisted with a `supply-default` binding.
5. Drawing a `bulk-dashed` route clears either implicit binding and connects B
   to the chosen explicit Net atomically.
6. Source-bound/imported MOS instances never receive a guessed supply default.
7. Later Ground placement and VDD rail construction reuse the existing global
   supply-default Net; they do not create same-domain parallel global Nets.

## Validation

- Derived resolution tests for explicit > cell > supply ordering and imported
  unresolved behavior.
- Edit Engine tests for canonical Net creation/reuse and explicit override.
- Editor presentation tests for placement/entry materialization.
- Agent Snapshot/schema artifact checks for the current status vocabulary.
- Focused unit tests, `pnpm verify:branch`, `git diff --check`, and final status.

## Commit Intent

```text
fix(mos): restore overridable supply bulk defaults
plan: complete MOS supply default correction
```

## Outcome

Manual MOS authoring now materializes a current `supply-default`: NMOS B uses
or creates canonical global ground and PMOS B uses or creates canonical global
VDD. Configured cell defaults remain higher priority, while source-bound MOS
instances remain unresolved when fourth-node evidence is missing. The existing
`bulk-dashed` gesture atomically clears either implicit binding and reconnects
B explicitly.

Ground placement merges into an existing global ground supply Net and VDD rail
construction reuses an existing global VDD supply Net, preventing disconnected
same-domain duplicates. Agent Snapshot and generated API artifacts expose the
new status.

Validation passed: 550 unit tests, focused browser coverage for both explicit
bulk override and VDD-rail reuse, `pnpm verify:branch`, frozen-lockfile install,
and full `pnpm ci:check` including all 97 browser E2E tests.
