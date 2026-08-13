---
status: completed
experience: none
---

# AP1 — Exact Snapshot and Component Catalog

Work package WP-AP1 of the
[Agent Project lifecycle roadmap](../../docs/roadmap/agent-project-lifecycle-and-artifacts-plan.md).
Builds on the AP0 v3 contract freeze (ADR 0018).

## Goal

Make every writable persisted netlist/interface field readable by an Agent and
publish a machine-readable component catalog, via additive API v3 `snapshot`
targets. v1/v2 wire contracts stay unchanged.

## State and Ownership

Start state: clean worktree on `codex/agent-project-lifecycle` after AP0
(`86b6a51`).

Owned paths:

- `packages/agent-adapter/src/schema.ts`
- `packages/agent-adapter/src/snapshot.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/catalog.ts` (new)
- `packages/agent-adapter/src/snapshot.v3.test.ts` (new)
- `packages/agent-adapter/src/contract-characterization.test.ts` (update for v3)
- `fixtures/agent-api/` (regenerated)
- `plan/2026-08-13-ap1-exact-snapshot-catalog/plan.md`
- `plan/log.md`

Read-only/shared: `packages/model` (typed `instance.netlist`/`binding`,
`document.netlist`, `serializeProject`), `packages/symbols`
(`builtInSymbols`, `deviceNetlistDefinitions`). These are read, not edited.

## Work

1. Schema: add `AGENT_API_V3_VERSION = "3.0"`; widen `AgentApiVersionSchema`.
   Relax `AgentSnapshotRequestSchema` to accept v2/v3 with optional `target`
   (`document`|`project`|`catalog`) and optional `documentId`, superRefined so
   v2 keeps its exact shape and v3 requires `target` (and `documentId` for the
   `document` target). Add v3 instance netlist facts, cell interface, project
   snapshot, and catalog schemas; add `AgentSnapshotV3ResponseSchema`
   (discriminated on `target`) to the response union. Widen capabilities
   `apiVersions`/`operations` for v3.
2. snapshot.ts: add exact facts to the document view (typed
   `instance.netlist`/`binding`, `document.netlist` cell interface); add a v3
   document snapshot builder, a v3 project snapshot builder (cell interfaces +
   typed hierarchy edges + source summary), wired to a host-supplied optional
   `projectRevision`.
3. catalog.ts (new): build the catalog from `builtInSymbols` joined with
   `deviceNetlistDefinitions` (id, name, aliases, pins, variants, netlist device
   facts, decorative). Deterministic ordering.
4. service.ts: advertise v3 in capabilities; fork the snapshot handler on v3
   `target`, building the right view and returning the v3 response shape; widen
   `errorResponse`/`fail` apiVersion typing.
5. Regenerate `fixtures/agent-api/`.
6. Tests: v3 document/project/catalog snapshot content + determinism;
   schema-to-snapshot write/read parity for netlist/interface fields; catalog
   matches `builtInSymbols`; update the AP0 characterization test for v3.
7. Log entry.

## Validation

- `corepack pnpm test:local packages/agent-adapter/src/snapshot.v3.test.ts packages/agent-adapter/src/contract-characterization.test.ts packages/agent-adapter/src/snapshot.test.ts packages/agent-adapter/src/service.test.ts`
- `corepack pnpm agent-api:artifacts` then `:check` (regenerated artifacts match)
- `corepack pnpm typecheck`
- `corepack pnpm docs:check`, `git diff --check`

No runtime mutation; no e2e/build/full-suite gate required.

## Commit Intent

```text
feat(agent): v3 exact snapshot targets and component catalog
```

## Outcome

Added API v3 `snapshot` with three targets. The `document` target returns the v2
document snapshot plus the exact cell interface and every typed instance
netlist/binding/parameter fact (read from `document.netlist` /
`instance.netlist`, which v2 ignored). The `project` target returns all
documents' cell interfaces, typed hierarchy edges, and the source summary. The
`catalog` target publishes every `builtInSymbols` entry joined with its
`deviceNetlistDefinition` (device class, reference prefix, pin order, target
policy, required parameters). v1/v2 wire contracts are unchanged; capabilities
advertises the additive v3 version and snapshot versions. Regenerated
`fixtures/agent-api/`. Updated the AP0 characterization test to assert the v3
additions.

Validation completed: 39 adapter tests (incl. 6 new v3 tests) pass; generated
artifacts validated (`:check`); `pnpm typecheck`, `pnpm docs:check`, and
`git diff --check` pass.
