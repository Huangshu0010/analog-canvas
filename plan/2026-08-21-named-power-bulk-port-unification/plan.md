---
status: completed
experience: none
---

# Repeated Formal Port Markers

## Goal

Allow one formal `CellTerminal` to own multiple ordinary Port marker Instances
without duplicating the ordered Cell interface, Net, caller pin, or mutation
protocol.

## State and Ownership

The target began on `codex/named-power-bulk-semantics` at `3a0128b8` with an
unfinished broad implementation. After ADR 0036 and the named-power/MOS-bulk
hotfix landed through PR 137, the worktree was preserved in
`stash@{0}`, fast-forwarded to Main merge `70f769a2`, and restored. Four
overlapping power-rail/Edit-Engine conflicts were resolved in favor of the
validated Main implementation. The stash remains as a recovery copy until
this target is committed.

The remaining dirty paths belong to this target. They implement the schema-20
formal-marker cardinality change and its direct consumers; the completed
named-power and MOS-bulk code from ADR 0036 is now a read-only dependency.

Owned paths:

- `packages/model/` and `packages/project-protocol/` schema/version/migration
- formal-terminal consumers in `packages/derived/`, `packages/edit-engine/`,
  `packages/netlist/`, `packages/spice/`, `packages/render-svg/`, and
  `packages/symbols/`
- formal marker copy/delete/navigation behavior in `apps/editor/`
- mechanical Agent Snapshot schema compatibility
- ADR 0037, current specifications, this plan, and `plan/log.md`

Read-only shared dependencies:

- ADR 0036 named-power and MOS-bulk semantics
- `Net.terminals` as electrical truth
- the existing Project structural transaction boundary
- current Insert/Port Setup workflow and Razavi semantic text

No new Agent capability, Port object type, endpoint kind, or query/edit
protocol is in scope.

## Work

1. Replace singular `CellTerminal.interfaceInstanceId` with non-empty
   `interfaceInstanceIds` and add the bounded schema-19-to-20 upgrade.
2. Update validation, annotations, hierarchy summaries/navigation, symbol
   projection, import/export, and Agent Snapshot compatibility.
3. Make formal-marker copy append a marker to the existing terminal and Net.
4. Make deletion remove one marker while retaining a surviving terminal, and
   use the existing structural removal/caller checks for the final marker.
5. Add focused migration, copy, deletion, lifecycle, and export regressions;
   add a current GUI flow proving repeated-marker behavior.
6. Update normative documentation and generated artifacts required by the
   schema change.

## Validation

- focused model/project-protocol migration tests
- focused derived, hierarchy, edit-engine, clipboard, netlist, SPICE, render,
  and symbol tests
- focused repeated-formal-marker browser test
- generated Agent API and MCP resource checks
- `pnpm test:impact -- --base main`
- `pnpm verify:branch`
- before mainline delivery: clean `pnpm install --frozen-lockfile`, canonical
  `pnpm ci:check`, and green required remote checks
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: schema-19 migration, non-empty and unique marker membership,
  repeated marker copy/delete, one exported formal pin, and final-marker
  caller protection
- Primary checks: model/project-protocol compatibility tests, hierarchy and
  transaction tests, clipboard tests, netlist round-trip tests, and current
  hierarchy browser E2E

## Commit Intent

Commit as:

```text
feat(hierarchy): allow repeated formal port markers
```

## Outcome

Project schema 20 now lets one formal terminal own multiple ordinary Port
markers on one Net. Copy uses the existing Project structural transaction,
deleting a subset retains the terminal, and deleting the final marker retains
the existing caller-safety rule. All current consumers, rolling schema-19
migration, normative docs, fixtures, and generated compatibility artifacts
were updated without adding another Port or Agent protocol.

Validation passed: 149 focused cross-layer tests, 63 Agent-adapter tests, the
11-test hierarchy browser suite, generated Agent/MCP checks, test-impact,
`pnpm verify:branch` (165 files / 992 tests plus builds and production smoke),
and the clean mainline `pnpm ci:check` including 170 browser tests.
