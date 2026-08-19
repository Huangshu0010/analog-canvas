---
status: active
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

At close-out, record the migrated shape, audit disposition, validation, and
commit status, then set `status: completed`.
