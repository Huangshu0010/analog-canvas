---
status: active
experience: none
---

# Complete schematic hierarchy authoring and protocol v12

## Goal

Advance the Project format from schema 11 to a bounded schema 12 that makes
schematic hierarchy authorable and maintainable without introducing a generic
multi-view/layout architecture. Reuse the existing Document-as-cell,
subcircuit Instance binding, Symbol Resolver, Project Connectivity Index,
DesignNetlist export, Edit Engine, editor interaction reducer, and four-operation
Agent surface. Deliver formal cell ports, safe Cell lifecycle operations,
project-structural undo/redo, hierarchy-aware navigation, canonical
v11-to-v12 compatibility, and deterministic save/reopen/export behavior.

## State and Ownership

Start state from `git status --short --branch` after creating the target branch
from the latest `origin/main`:

```text
## codex/schematic-hierarchy-v12
?? .worktrees/
```

The untracked `.worktrees/` directory predates this target, is unrelated to the
owned files below, and will remain untouched. The branch starts at
`030ba760478cdf3357ab06dadbb5a049747bdaaa`, the current `origin/main`.

This target owns the existing schematic-hierarchy contracts and their direct
consumers:

- `packages/model/src/schema/`, `packages/model/src/factories.ts`, and focused model tests
- `packages/project-protocol/src/` and compatibility tests/fixtures
- `packages/edit-engine/src/` and focused transaction tests
- `packages/symbols/src/hierarchical-block*` and resolver coverage
- `packages/derived/src/` hierarchy/connectivity consumers and focused tests
- `packages/netlist/src/` hierarchy extraction and focused tests
- `packages/agent-adapter/src/` hierarchy snapshot/transaction contract and generated artifacts
- `apps/editor/src/document/`, `apps/editor/src/features/hierarchy/`, relevant editor shell/interaction modules, and focused tests
- focused hierarchy browser tests under `apps/editor/e2e/`
- current normative hierarchy/protocol/user documentation and the new ADR
- this plan, `plan/root-audit.md`, and `plan/log.md`

Shared dependencies are canonical Project serialization, the strict
SchematicEdit union, ordinary Instance/Net/Route behavior, symbol pin identity,
Project replacement/session invalidation, generated Agent/OpenAPI artifacts,
and structural SPICE/Spectre output. Existing device, routing, drafting,
annotation, and visual-reference behavior stays outside the target except where
the hierarchy contract must consume it unchanged.

## Work

1. Freeze a deliberately schematic-only schema-12 decision. Keep Documents as
   reusable Cell definitions; do not add generic Cell/View/Layout containers.
   Add stable formal-port identity and presentation to the existing
   `Document.netlist` interface, strengthen Project hierarchy references, and
   replace the rolling compatibility adapter with deterministic v11-to-v12.
2. Extend the existing Edit Engine/controller boundary for atomic Project
   structure commits with undo/redo. Add the smallest Cell/port operations
   needed for create, rename, delete, reorder, and caller-safe reconciliation;
   do not create a second mutation language.
3. Replace rectangle-as-protocol behavior with a formal hierarchy creation
   workflow that may use the rectangle gesture only as input. Render and select
   the committed block through the existing Instance/Symbol paths. Add real
   child-cell Port placement/editing and a bounded Cell management surface.
4. Make navigation instance-path aware while continuing to use the existing
   project index and hierarchy frames. Distinguish deleting an Instance from
   deleting an unreferenced Cell definition; reject top/referenced/cyclic or
   dangling structural states.
5. Extend existing derived connectivity, netlist export, and Agent snapshot /
   transact representations to consume the same formal-port facts. Preserve
   the four Agent operations and scoped authorization instead of introducing a
   parallel hierarchy endpoint.
6. Update canonical fixtures, current specs, user guidance, generated
   artifacts, focused tests, and browser coverage. Remove only superseded
   schema-11 compatibility behavior whose v12 replacement is proven.

## Validation

- focused model, project-protocol, edit-engine, symbols, derived, netlist, Agent, and editor unit/module tests
- focused hierarchy Playwright workflows
- canonical save/reopen and v11-to-v12 migration coverage
- deterministic SPICE/Spectre hierarchy export coverage
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

Because this target advances the persisted Project schema and crosses model,
mutation, editor, Agent, and export boundaries, branch-wide verification is
required before delivery. The mainline gate and remote required checks remain
required before merge to `main`.

## Test Impact

- Decision: tests-updated
- Contracts: schema-12 persistence; direct v11 migration; stable formal ports;
  hierarchy reference integrity; create/delete/undo; parent-child connectivity;
  shared Cell reuse; navigation paths; Snapshot parity; deterministic export
- Primary checks: focused tests beside every changed boundary plus the hierarchy
  browser workflow and branch verification

## Commit Intent

Commit as a small reviewable series on `codex/schematic-hierarchy-v12`, grouped
by protocol/model, structural mutation, editor behavior, Agent/export parity,
and final documentation/fixtures. Push the completed branch for remote review.

## Outcome

Delivered a schematic-only schema 12 without adding generic Cell/View/Layout
containers. Documents are reusable Cell definitions; ordinary subcircuit
Instances remain hierarchy edges; formal terminals now have stable identity,
direction, Net binding, and an ordinary Port Instance. Project structural
transactions provide atomic add/remove Cell and interface changes, optimistic
`structureRevision`, caller-safe rename/delete reconciliation, and editor
undo/redo. The editor can create, place, enter, navigate, and safely delete
Cells, and expose/rename/delete connected Port markers. Agent API 2.0 retains
its four operations and carries structural edits inside `transact`; netlist
export and SPICE import consume the same interface facts. Rectangle conversion
is retained only as an input gesture and commits the standard hierarchy model.

Validation passed: focused model/protocol/edit/symbol/derived/netlist/SPICE/
Agent/editor Vitest runs; hierarchy, drafting, and project-file Playwright
workflows; generated Agent/MCP checks; `pnpm test:impact -- --base origin/main`;
and `pnpm verify:branch` (144 test files / 874 tests, workspace build, production
smoke). `git diff --check` passed. The unrelated untracked `.worktrees/`
directory remains untouched.

## Delivery follow-up

Remote PR #119 exposed a release-boundary regression after the original
focused and branch validation: the packaged MCP release smoke's circuit
response is rejected by the Agent HTTP client schema. This plan is active again
until the produced response and its canonical client schema agree, the focused
release smoke passes, and the required remote checks are green. The untracked
`.worktrees/` directory remains unrelated and untouched.

Local repair validation: `pnpm ci:release` passes after adding the required
schema-12 `project.structureRevision` fact to the packaged MCP relay fixture.
The same remote run supplied a new Linux MCP tarball digest after the hierarchy
bundle changed; this delivery follow-up also refreshes that integrity pin and
requires a new green remote release-contract result.
The first remote browser shard also identified a retired empty-canvas assertion
that expected no Cell navigation. The current hierarchy UX intentionally shows
that navigation from the initial canvas, so the focused browser test must
assert its visibility instead of preserving the obsolete absence contract.
