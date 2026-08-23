---
status: completed
experience: none
---

# Connectivity Evidence schema

## Goal

Introduce the persisted, owner-addressable Connectivity Evidence layer and a
rolling schema-21 to schema-22 migration without yet rewriting every Net
producer or resolver. Preserve current behavior while making name, label, and
SPICE-source authority explicit and reversible for the following targets.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/codex/project-net-lifecycle
```

The dedicated worktree is clean. This target is stacked after commits
`8cb124e5` and `796b6cf6`; there are no overlapping user or worker changes.

- `packages/model/src/schema/common.ts`
- `packages/model/src/schema/connectivity.ts`
- `packages/model/src/schema/document.ts`
- `packages/model/src/schema/types.ts`
- `packages/model/src/factories.ts`
- `packages/model/src/schema.test.ts`
- `packages/model/src/protocol-documentation.test.ts`
- `packages/project-protocol/src/version.ts`
- `packages/project-protocol/src/transforms/project.ts`
- `packages/project-protocol/src/protocol.test.ts`
- `packages/project-protocol/src/persistence.test.ts`
- `packages/spice/src/importer.ts`
- `packages/spice/src/compiler.test.ts`
- `packages/edit-engine/src/routing.test.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction.test.ts`
- `apps/editor/src/demos/demo-project.ts`
- `apps/editor/src/demos/routing-demo.ts`
- `fixtures/projects/compatibility-corpus.json`
- `fixtures/projects/minimal/project.icproj.json`
- `fixtures/projects/phase-1-manual/project.icproj.json`
- `fixtures/projects/phase-3-routing/project.icproj.json`
- `fixtures/projects/phase-5-dense-analog/project.icproj.json`
- `fixtures/projects/instance-value-display/project.icproj.json`
- `fixtures/projects/rejected-missing-top/project.icproj.json`
- `fixtures/agent-api/agent-circuit-request.schema.json`
- `fixtures/agent-api/agent-circuit-response.schema.json`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `apps/mcp-server/src/resources.generated.ts`
- `docs/specs/project-file-format.md`
- `docs/specs/schematic-model.md`
- `docs/specs/circuit-ir.md`
- `docs/specs/persistence-and-recovery.md`
- `docs/specs/editor-interaction.md`
- `docs/user/project-compatibility.md`
- `docs/user/schematic-hierarchy.md`
- `docs/overall-product-plan.md`
- `docs/current/README.md`
- `docs/adr/0039-connectivity-evidence.md`
- `docs/adr/README.md`
- `apps/editor/src/document/project-file-service.test.ts`
- `apps/editor/src/document/browser-recovery-contract.test.ts`
- `apps/editor/src/document/browser-recovery-store.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts` (schema-valid test fixture mutation)
- `plan/2026-08-23-connectivity-evidence-schema/plan.md`
- `plan/2026-08-23-cell-reset-lifecycle/plan.md` (metadata correction only)
- `plan/log.md`

Derived connectivity, exporter, and UI paths are read-only in L3. The SPICE
importer is owned because it constructs current Projects directly and must emit
source assertions rather than an empty placeholder. If compilation or
canonical fixtures require another mechanical current-schema update, scope will
be recorded before touching them.

## Work

1. Add strict evidence variants for name claims, SPICE source assertions, and
   explicit equivalence, with stable owner references and bounded members.
2. Persist `connectivityEvidence` per Document and validate every Net/member and
   owner reference, including unique evidence IDs in the Document namespace.
3. Advance the Project schema to 22 and replace the rolling reader with one
   schema-21 adapter that deterministically migrates Net names, label ownership,
   and imported source membership into evidence.
4. Retain legacy `Net.name` and `Net.origin` as transitional projections during
   L3 so behavior remains unchanged until L4 producer migration; document that
   evidence becomes the authority only when the resolver migration lands.
5. Add migration/idempotence/rejection tests and update the normative format
   documents.
6. Extend the existing `merge_nets` reference-closure primitive so deleting a
   source Net retargets every persisted evidence reference, deduplicates
   equivalence members, and removes equivalence assertions that collapse below
   two members. This is required for schema-22 validity; producer semantics
   otherwise remain transitional until L4.

## Validation

- `pnpm test:local packages/model/src/schema.test.ts packages/project-protocol/src/protocol.test.ts packages/project-protocol/src/persistence.test.ts`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: gate-review, static contracts, and test-impact.
- Affected gates: workspace units plus hierarchy and project-file browser
  contracts because the current Project schema and factory cross both paths.
- Final gates: canonical `pnpm ci:check` and remote required checks before
  mainline delivery.
- Canonical Project and generated Agent fixture paths are unclassified by the
  advisory gate, so the actual diff requires branch verification. Agent API
  and MCP resources are regenerated because their nested Document schemas must
  reflect schema 22; this does not enable Agent lifecycle commands.
- Risk: this is a persisted schema boundary. Rolling compatibility must remain
  exactly current plus previous; old merge lineage cannot be reconstructed and
  is not fabricated. Generated artifacts are changed only through their
  canonical generators; source-state expansion remains outside L3.

## Test Impact

- Decision: tests-updated
- Contracts: schema-22 validates owned evidence; fresh Documents write an
  explicit empty evidence list; schema-21 names/labels/import origins migrate
  deterministically; schema-20 becomes unsupported; current serialization
  round-trips evidence without mutation; `merge_nets` cannot leave evidence
  pointing at the removed source Net.
- Primary layer: model and project-protocol unit tests, followed by affected
  hierarchy/project-file browser gates.

## Commit Intent

Commit as:

```text
feat(model): add connectivity evidence schema
```

## Outcome

Project schema 22 now persists owner-addressable name claims, SPICE-source
assertions, and explicit Net equivalence. The rolling schema-21 reader derives
stable evidence without fabricating unavailable merge history; schema 20 is no
longer accepted. New Projects, canonical fixtures, demo Projects, recovery,
generated Agent/MCP contracts, and direct SPICE import all write schema 22.

Evidence is reference-closed through the existing `merge_nets` atomic edit:
ordinary evidence follows the retained Net, equivalence members deduplicate,
and collapsed equivalence assertions are removed. Conflicting name claims are
valid persisted evidence for the future resolver; legacy `Net.name` and
`Net.origin` remain transitional projections until the producer and consumer
migrations.

Validation passed: focused model/protocol/import and transaction suites (up to
58 tests per focused run), hierarchy browser (12), project-file browser (10),
Agent browser (1), manual-editor browser (98), all 185 unit files / 1194 tests,
workspace build, production preview smoke, generated Agent/MCP freshness,
test-impact, and diff checks.
