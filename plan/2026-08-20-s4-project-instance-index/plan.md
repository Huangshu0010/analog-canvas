---
status: completed
experience: none
---

# S4 Project Instance Index and Batch Property Planner

## Goal

Implement the Stage 1 project-level read/edit foundation for Instance Table
work without creating table-local property semantics or changing the current
single-object Properties, selection, keyboard, or canvas workflows.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan [ahead 4]
```

The worktree is clean after S3. This target owns derived project-instance
projection, bounded typed bulk netlist edits/planning, project transaction
integration, and the new explicit Instance Table surface. S3 ReferenceIndex,
S1/S2 field/property behavior, existing project history, selection, and
hierarchy remain shared dependencies; their existing GUI behavior is
read-only compatibility scope.

## Work

1. Build a definition-level `ProjectInstanceIndex` with one row per
   `documentId + instanceId`, S3 reference evidence, descriptor/binding and
   typed parameter projections, locators, and caller-path context.
2. Add one bounded, atomic `bulk_patch_instance_netlist` edit and a batch
   planner that delegates to typed field semantics instead of JSON-path or
   table-specific payloads. Establish explicit compatible/unchanged/
   incompatible/blocked preview results.
3. Add an explicit Instance Table that reads the index and offers a minimal
   active-Cell/whole-Project filter and supported batch field edits. It must
   not alter current Properties or canvas selection behavior implicitly.
4. Complete the S3-defined scoped Reference planner needed by the table:
   deterministic per-Cell fill-gaps/continuous preview, preserve/exclude
   handling, and the same bounded typed bulk edit. This is a direct dependent
   contract omitted from the earlier single-reference S3 target, not a second
   allocator.
5. Prove one project-history undo boundary, per-document revisions, capacity
   rejection, hierarchy definition semantics, Reference preview, and existing
   Properties/browser behavior with focused tests.

## Validation

- focused derived, edit-engine/project transaction, editor, and property tests
- focused Instance Table browser behavior
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`

## Test Impact

- Decision: tests-updated
- Contracts: definition-level uniqueness, one field protocol, atomic bounded
  bulk mutations, preview diagnostics, and non-interference with existing
  single-object GUI behavior.

## Commit Intent

```text
feat(instances): add project index and batch property foundation
```

## Outcome

Delivered a definition-level `ProjectInstanceIndex` with descriptor, typed
netlist, reference-diagnostic, locator, and caller-path projections. Added the
bounded atomic `bulk_patch_instance_netlist` engine edit (5,000 assignments
accepted; 5,001 rejected), the shared batch property planner, and deterministic
per-Cell Reference fill-gaps/continuous planner. The explicit Edit-menu
Instance Table supports active-Cell/project scope, filtering, diagnostic
review, parameter/model bulk updates, and reference-renumber preview without
changing the existing Properties dock or canvas selection workflow.

Validation passed: TypeScript typecheck; focused unit/component contracts
(50 tests); browser Instance Table batch flow; existing Properties browser
regression; test-impact against `origin/main`; docs links; and diff check.

Commit status: committed locally with this target's implementation changes.
