---
status: completed
experience: none
---

# Plan Device Protocol and Compatibility Architecture

## Goal

Produce the implementation-ready architecture plan for an independent device
protocol module and Project compatibility boundary. The plan preserves all
current schema-11 device behavior and defines a bounded, current-only runtime
compatibility policy without creating historic schema, fixture, or migration
registries.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .worktrees/
```

The untracked `.worktrees/` directory predates this target, is unrelated to
the planning record, and remains untouched. This target owns only:

- `plan/2026-08-17-device-protocol-compatibility-architecture/plan.md`
- `plan/2026-08-17-device-protocol-compatibility-architecture/architecture.md`
- `plan/log.md`

Read-only dependencies are the current model, persistence, symbol/netlist,
Edit Engine, and compatibility contracts. In particular, this planning target
does not alter schema 11, device behavior, Project fixtures, generated assets,
or any executable package.

## Work

1. Record the current authoritative boundaries and the non-negotiable behavior
   preservation rule for existing devices.
2. Define independent `model`, `devices`, `symbols`, and `project-protocol`
   responsibilities with a dependency direction that avoids cycles.
3. Define the single-root-version, rolling N-1 direct-read compatibility
   policy, including rejection and save behavior.
4. Define the smallest implementation sequence, test ownership, release rules,
   and explicit non-goals so the architecture does not grow into a speculative
   recovery or version-matrix system.
5. Review the plan against current accepted ADR 0022, ADR 0023, model,
   connectivity, and Edit Engine contracts; record the result in `plan/log.md`.

## Validation

- Review architecture assertions against the current contract sources named
  above.
- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target creates a planning-only architecture record. It changes
  no executable implementation, generated artifact, runtime behavior, or
  persisted protocol; existing schema-11 and rolling v10-to-v11 contracts
  remain the implementation protection.

## Commit Intent

Commit as:

```text
docs(plan): define device protocol and compatibility architecture
```

## Outcome

Completed the reviewed architecture plan on
`codex/device-protocol-compatibility-plan`. It establishes independent model,
devices, symbols, and Project-protocol responsibilities; locks existing
schema-11 device behavior during refactoring; retains one root Project version
and one rolling direct N-1 adapter; and explicitly excludes a migration chain,
persisted module-version matrix, historical fixture archive, and speculative
recovery system. Documentation-link and test-impact checks passed with no
implementation paths changed. The plan remains a planning record; a future
implementation target must create an accepted ADR before changing executable
protocol or device behavior.
