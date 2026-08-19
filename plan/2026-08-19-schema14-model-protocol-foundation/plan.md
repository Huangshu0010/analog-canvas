---
status: completed
experience: none
---

# Schema-14 Model and Protocol Foundation

## Goal

Implement the S0 persisted schema-14 foundation in the model and Project-file
boundary: remove the legacy electrical property bag, relocate imported terminal
mapping, add formal/external interface shapes, migrate schema 13 directly, and
prove the new current-only runtime shape. Preserve all editor-visible behavior;
Properties and descriptor UI migration are separate targets on top of this
contract.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The worktree is clean. This target follows the accepted ADR 0027 and owns the
shared persisted-model boundary; no unrelated dirty work is present.

Owned paths:

- `packages/model/src/schema/**`
- `packages/model/src/**test.ts`
- `packages/project-protocol/src/**`
- `packages/spice/src/importer.ts` and its focused compiler/import tests
- `packages/edit-engine/src/{edit-schema,transaction,hierarchy-planner,project-transaction}.ts`
- `packages/netlist/src/extract.ts`
- schema-shape consumers in `apps/editor/src` required to keep the existing
  Properties/placement behavior compiling against the current model
- focused current-schema fixtures and protocol tests
- `docs/specs/schematic-model.md`
- `docs/specs/project-file-format.md`
- `docs/specs/persistence-and-recovery.md`
- `docs/overall-product-plan.md`
- `docs/user/schematic-hierarchy.md`
- `docs/specs/edit-engine.md`, `docs/specs/editor-interaction.md`, and
  `docs/user/project-compatibility.md` for executable schema/edit-contract
  wording exposed by full-suite documentation checks
- `docs/adr/0026-definition-level-cell-symbol-presentation.md` only for its
  superseded current-version reference
- `scripts/audit-schema13-properties.mjs`
- `plan/2026-08-19-schema14-model-protocol-foundation/plan.md`
- `plan/root-audit.md`
- `plan/log.md`

Read-only shared dependencies:

- ADR 0022–0027 and `docs/roadmap/stage-1-schematic-foundation.md`
- `packages/edit-engine`, `packages/netlist`, `packages/spice`,
  `packages/devices`, and `apps/editor` consumers of the current schema
- generated Agent artifacts; regeneration is included only if the schema
  contract requires it

## Work

1. Complete and record a deterministic audit of non-empty schema-13 legacy
   properties in repository fixtures and compatibility inputs.
2. Define schema-14 model schemas and project-level validation for typed import
   provenance, formal parameters, external subcircuit definitions, and the
   three-state subcircuit binding contract.
3. Replace the rolling schema-12-to-13 reader with a direct schema-13-to-14
   adapter that migrates only audited, non-ambiguous values and reports
   ambiguity structurally.
4. Update current-format documentation and focused fixtures/tests; adapt only
   necessary producers/consumers to compile while retaining their present GUI
   behavior.

The full-suite contract tests additionally require updating schema-version and
typed-edit names in the documents above. This is a bounded documentation
correction caused by the shared schema target, not a separate product decision.

The audited migration must use a scoped fixture-aware transformation, not a
textual repository-wide replacement: `terminals` is also the electrical Net and
Cell-interface authority, so only `Instance.netlist.terminals` may relocate to
provenance.

Audit evidence as of 2026-08-19: eight tracked Project inputs initially
contained exactly three non-empty legacy property records. `R1.value = 10k` in
`phase-1-manual` migrated to `netlist.parameters.value`; the two undefined
`role` values in `phase-5-dense-analog` were deliberately removed rather than
inventing a generic replacement. Re-running the audit after fixture migration
reports no non-empty legacy property records.

## Validation

- focused `@icm/model` and `@icm/project-protocol` tests
- affected typecheck/build command(s)
- `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: strict schema-14 validation, rolling v13-to-v14 migration,
  rejection of conflicting legacy facts, and canonical current-only save/load.
- Primary checks: focused model and project-protocol test files plus the
  repository impact selector.

## Commit Intent

Commit as:

```text
feat(protocol): establish schema 14 netlist foundation
```

## Outcome

Implemented the schema-14 current-only runtime shape: Instance electrical facts
now live in typed netlist fields, imported terminal mapping lives in typed
provenance, Cell formal parameters and external definitions normalize to
explicit arrays, and hierarchy targets use stable IDs or explicit unresolved
state. The direct schema-13 adapter migrates audited electrical values,
preserves source evidence, rejects parameter conflicts, and lowers inconsistent
external interfaces to unresolved targets rather than inventing a resolution.

The existing GUI interaction remains behaviorally unchanged; its transient
insertion request now uses `parameters` terminology and persists through the
same typed netlist writer. Agent API source and generated artifacts reflect the
shared current contract, but its public API version/release boundary is
unchanged.

Validation passed: `pnpm test` (146 files / 894 tests), `pnpm typecheck`,
`pnpm build`, Agent/MCP artifact regeneration, `pnpm docs:check`,
`pnpm test:impact -- --base origin/main`, `git diff --check`, and the schema-13
property audit (8 Project inputs; no non-empty legacy properties). Commit
status: committed locally on `codex/phase1-schematic-foundation-plan`;
push/PR remain a separate delivery action.
