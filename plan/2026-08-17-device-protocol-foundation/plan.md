---
status: active
experience: none
---

# Establish Device Protocol and Compatibility Foundation

## Goal

Accept and implement the behavior-preserving foundation for independent device
protocol and Project compatibility modules. Establish the current device
behavior contract, extract the source layout needed for a current-only model,
and introduce the device/project-protocol package boundaries without changing
schema-11 Project bytes, device behavior, or current v10-to-v11 compatibility.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/device-protocol-compatibility-plan...origin/codex/device-protocol-compatibility-plan
?? .worktrees/
```

The untracked `.worktrees/` directory predates this target, is unrelated, and
remains untouched. This target owns:

- ADR 0024 and current documentation references
- `packages/model/src/schema/` current-schema source extraction and public
  re-exports
- new `packages/devices/` and `packages/project-protocol/` package contracts
- migration of direct device/netlist and Project persistence consumers
- focused model, devices, symbols, protocol, netlist, and editor contracts
- package/workspace configuration required by those owned packages
- this target plan, `plan/log.md`, and `plan/root-audit.md`

Read-only shared contracts include schema 11 Project JSON, fixture corpus,
Razavi visual assets, typed Edit Engine union, connectivity invariants, and
Agent public artifacts. Any required change to a generated artifact or a
persisted Project shape expands the plan before work proceeds.

## Work

1. Accept ADR 0024, record current schema/device invariants, and update the
   current documentation reading set.
2. Add behavior-characterization tests that make descriptor/Symbol/netlist
   parity and existing current Project serialization explicit.
3. Split the model schema source by responsibility while preserving public
   exports, schema-11 validation, and canonical serialization exactly.
4. Create `@icm/devices` as the single built-in descriptor registry, migrate
   netlist consumers and Symbol parity validation, then remove duplicate
   definition authority.
5. Create `@icm/project-protocol` as the sole parse/migrate/serialize boundary,
   move the rolling direct adapter and diagnostics into it, and migrate editor
   file/recovery and programmatic callers.
6. Prove current and previous Project behavior, built-in device behavior,
   netlist output, and editor save/reopen behavior remain unchanged.

## Validation

- focused model schema/persistence and device-registry contracts
- focused netlist extraction/printer contracts
- focused editor file/recovery and Project browser workflow contracts
- `pnpm typecheck`
- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `pnpm verify:branch`, justified because the target changes model,
  persistence, symbols, netlist, editor file/recovery, and package boundaries
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: schema-11 model/serialization equivalence; direct v10-to-v11
  compatibility; descriptor/Symbol/netlist parity; device behavior; staged
  file-open and recovery semantics.
- Primary checks: focused package tests beside the extracted contracts;
  `apps/editor/e2e/project-file.spec.ts`; `pnpm test:impact -- --base main`.

## Commit Intent

Commit in reviewable boundaries, beginning with:

```text
docs(protocol): accept device protocol module architecture
```

## Outcome

At close-out, record the extracted package boundaries, compatibility behavior,
validation, and commit evidence. Do not claim completion until current schema
11, current device behavior, and rolling v10-to-v11 compatibility all have
direct evidence.
