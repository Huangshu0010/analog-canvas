---
status: completed
experience: none
---

# S1 Descriptor and Properties Protocol

## Goal

Complete the remaining S1 authority contract on schema 14: move built-in
parameter definitions into Device Descriptors, make editor projections consume
that one descriptor surface, and provide typed field edits for ordinary
reference, binding, and parameter writes without changing the current
Properties gestures.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan [ahead 1]
```

The worktree is clean after the schema-14 foundation commit. This target owns
the descriptor/property contract and its direct consumers; no unrelated dirty
work is present.

Owned paths:

- `packages/devices/src/**`
- `packages/edit-engine/src/{edit-schema,transaction}.ts` and focused tests
- internal Agent schema consumers under `packages/{agent-adapter,agent-client}`
  and the generated request/OpenAPI fixtures required to keep the shared edit
  union fresh; this is not a public Agent release or API-version change
- descriptor-driven UI/projection code under
  `apps/editor/src/features/{component-insert,properties,netlist-export}` and
  direct app helpers/tests
- `packages/derived/src/instance-value.ts` and focused tests when its display
  role must derive from descriptors
- S1 current-contract documentation, target plan, and `plan/log.md`
- `plan/root-audit.md` solely to reconcile the S0/S1 current-target queue

Read-only shared dependencies:

- `docs/adr/0027-stage-1-netlist-authoring-protocol.md`
- `docs/roadmap/stage-1-schematic-foundation.md`
- schema-14 model, importer, analyzer, and existing Properties GUI regression
  tests

## Work

1. Replace descriptor `requiredParameters` as the sole parameter list with
   ordered parameter definitions containing the accepted metadata; derive
   required-name validation from those definitions.
2. Remove the editor-local parameter registry and project all insert-dialog,
   Properties draft, value preview, and initial netlist fields through the
   Device Descriptor adapter.
3. Add and use typed `set_instance_reference` and `set_instance_binding` edits;
   keep `set_instance_netlist` restricted to initialization/import/migration and
   preserve current immediate parameter, position, rotation, Value-toggle, and
   Discard behavior. Update the internal authoring compiler and its generated
   schemas because they derive from the same edit union, without changing the
   public Agent version or release state.
4. Add focused descriptor, edit, and GUI compatibility tests and update current
   documentation.

## Validation

- focused device, edit-engine, derived, and editor property tests
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: ordered descriptor parameter metadata is the one built-in field
  definition; typed field edits preserve the current Properties UI result.
- Primary checks: descriptor registry tests, transaction tests, component
  parameter tests, Properties/edit-session tests, and the impact selector.

## Commit Intent

Commit as:

```text
feat(properties): unify descriptor-backed field editing
```

## Outcome

Descriptor parameters are now ordered metadata on `DeviceDescriptor`; the
insert form, Properties parameter draft, required export validation, and Value
projection consume it instead of separate field lists. Existing GUI behavior is
preserved: parameter edits remain immediate, Discard applies the saved
baseline, source/passive units and MOS W/L fraction presentation are unchanged.

The normal field writers are `set_instance_reference`,
`set_instance_binding`, and `patch_instance_netlist_parameters`; whole-record
`set_instance_netlist` is now used only when an Instance first needs a netlist
record. The same edit union refreshes internal Agent-derived artifacts, with no
Agent API version or release change.

Validation passed: `pnpm typecheck`; focused unit contracts (10 files / 105
tests); `pnpm agent-api:artifacts:check`; `pnpm docs:check`; `pnpm test:impact
-- --base origin/main`; and `git diff --check`.

Commit status: committed locally as `c6fbe6f` on
`codex/phase1-schematic-foundation-plan`.
