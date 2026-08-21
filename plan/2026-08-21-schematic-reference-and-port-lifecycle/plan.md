---
status: completed
experience: none
---

# Schematic Reference and Port Lifecycle

## Goal

Unify every Instance, including ordinary and formal Ports, under one visible
schematic-reference and placement lifecycle without fabricating a netlist
reference for non-emitting Ports.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/schematic-instance-lifecycle-ux
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean. The two untracked paths are local dependency and
worktree infrastructure, owned outside this target, and will remain untouched.

- `packages/model/`, `packages/project-protocol/`, `packages/edit-engine/`
- `packages/derived/`, `apps/editor/src/`
- affected tests, documentation, `plan/log.md`

Shared: the root Project schema and one-version migration boundary; typed
annotation bindings; netlist export must continue to use only
`Instance.netlist.reference`.

## Work

1. Advance the Project schema and add a stable schematic-reference authority
   for every Instance, distinct from the optional emitting netlist reference.
2. Migrate schema-16 Projects deterministically, preserve export semantics, and
   bind visible Reference labels to the schematic reference.
3. Make normal and formal Ports show their reference by default while retaining
   the formal terminal name as separate interface text.
4. Remove the UI-only formal-Port return exclusion, make placement locking
   symmetric, and update focused lifecycle, display, migration, and UI tests.
5. Update normative documentation and record factual validation.

## Validation

- `pnpm test:local <affected test paths>`
- focused `pnpm test:e2e:local <spec> --grep <pattern>` where practical
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: schematic and netlist references are independent; Ports share
  placement lifecycle; visible reference labels resolve the schematic source.
- Primary checks: model, project-protocol, derived, edit-engine, editor unit,
  and affected browser lifecycle tests.

## Commit Intent

Commit as:

```text
feat(protocol): unify schematic references and port lifecycle
```

## Outcome

Implemented Project schema 17 with an independent `Instance.schematicReference`
that is populated by current writers and the direct schema-16 migration. The
visible Reference annotation now resolves that authority, while netlist export
continues to use only `Instance.netlist.reference`. Formal Cell Ports now show
both their `P#` reference and terminal name, and share the ordinary Placement
Tray return/re-place lifecycle without losing terminal or net facts.

Validation passed: focused unit contracts (17 files / 172 tests), the focused
formal-Port browser lifecycle (1 test), targeted regression tests (2 files /
14 tests), format, documentation links, test-impact, diff checks, complete
workspace unit-test execution, workspace build, and production preview smoke.
