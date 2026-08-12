---
status: completed
experience: none
---

# WP-R7 — NoConnect Schema and v2 -> v3 Migration (foundation)

## Goal

Land the persisted foundation of WP-R7 (roadmap §8 R7, §6.1): add the `NoConnect`
electrical record to the Project schema, bump the schema version 2 -> 3 with an
idempotent migration that backfills empty `noConnects` (infers nothing), and
enforce the NoConnect invariants at the schema level. This unblocks the ERC
engine (WP-R8), which references NoConnect to suppress `ERC_UNCONNECTED_PIN`.

Deferred to follow-on targets: the typed `place_no_connect`/`remove_no_connect`
Edit Engine edits + clipboard/delete, the importer's `SourceBindingEvidence`
write, the Razavi No-Connect visual asset + hit + export, and Agent Snapshot
additive fields. Each needs its own bounded, e2e-validated target; the schema
shape is the prerequisite and is fully unit-testable now.

## Scope-risk note

A schema version bump is irreversible (roadmap §13) and affects every Project
load. Mitigation: the v2->v3 migration is a trivial backfill; the field is also
`.default([])` so a document missing it still validates; and the change is
gated by the **full** vitest suite (every fixture loads through the migration).

## State and Ownership

```text
## roadmap/connectivity-routing-debugging
(clean — R0..R6 committed)
```

Owned paths:

- `packages/model/src/schema.ts` (NoConnect schema + field + version bump +
  invariant + type export)
- `packages/model/src/migration-v2-to-v3.ts` (NEW)
- `packages/model/src/persistence.ts` (register the migration)
- `packages/model/src/index.ts` (re-export the migration if needed)
- `fixtures/projects/minimal/project.icproj.json` (regenerate to v3 canonical —
  required by the exact round-trip test)
- `packages/model/src/migration-v2-to-v3.test.ts` (NEW) and additions to
  schema/persistence coverage
- `plan/2026-08-12-wp-r7-noconnect-schema/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: edit-engine, importer, agent, render, editor (untouched this target).

Shared: `CURRENT_PROJECT_SCHEMA_VERSION` (2 -> 3) is a repo-wide contract; the
full test suite is the gate.

## Work

1. `schema.ts`:
   - `CURRENT_PROJECT_SCHEMA_VERSION = 3`.
   - `NoConnectEndpointSchema` (terminal | port discriminated union) and
     `NoConnectSchema` (`id`, `endpoint`, optional `reason`).
   - `noConnects: z.array(NoConnectSchema).default([])` on
     `SchematicDocumentBaseSchema`.
   - superRefine invariant after the net-membership loop: a NoConnect endpoint
     must reference an existing instance/pin or port, must not belong to any Net,
     and must not duplicate another NoConnect endpoint.
   - `export type NoConnect = z.infer<typeof NoConnectSchema>` (+ endpoint type).
2. `migration-v2-to-v3.ts`: pure idempotent function; for each document add
   `noConnects: []` when absent; set `schemaVersion: 3`.
3. `persistence.ts`: `defaultProjectMigrations.register(2, migrateV2ToV3)`.
4. Regenerate `fixtures/projects/minimal/project.icproj.json` to v3 canonical via
   `serializeProject(parseProject(current))`.
5. Tests: migration backfills and is idempotent; a v2 fixture loads through the
   migration; round-trip stays canonical; NoConnect invariant rejects a Net
   conflict and a duplicate endpoint; a clean NoConnect parses; future-version
   rejection still holds.

## Validation

- `pnpm typecheck`
- `pnpm test` (FULL vitest — the schema bump touches every fixture load)
- `pnpm exec prettier --check` on changed `.ts`
- `git diff --check`

## Commit Intent

```text
feat(model): add NoConnect record with v2->v3 schema migration (WP-R7)
```

## Outcome

Landed the persisted foundation of WP-R7: the `NoConnect` electrical record,
schema version 2 -> 3 with an idempotent backfill migration, and the schema-
level NoConnect invariants. Full-suite validated: R7 adds **zero** new test
failures.

- `packages/model/src/schema.ts`: `CURRENT_PROJECT_SCHEMA_VERSION = 3`;
  `NoConnectEndpointSchema` (terminal | port), `NoConnectSchema`; document field
  `noConnects: z.array(NoConnectSchema).default([])`; superRefine invariant
  (NoConnect endpoint must exist, must not belong to a Net, no duplicate);
  `NoConnect`/`NoConnectEndpoint` type exports.
- `packages/model/src/migration-v2-to-v3.ts`: idempotent backfill
  (`noConnects: []` per document, version 3), infers nothing.
- `packages/model/src/persistence.ts`: registered the migration.
- Cascade (deliberate, schema-version-driven): added `noConnects: []` to typed
  `SchematicDocument` literals in `factories.ts`, `importer.ts`, and three test
  helpers; updated `persistence.test.ts` migration-chain to include a 2->3 hop;
  updated `platform-web` assertion to `schemaVersion: 3`; regenerated the three
  exact-round-trip fixtures (minimal, phase-1-manual, phase-3-routing) to v3
  canonical via a one-shot generator.

Validation: `pnpm typecheck` passed; `pnpm test` (full vitest) — 524 passed, 8
failed. The 8 failures are **pre-existing and unrelated to R7**: confirmed by
`git stash` of all R7 changes (the same 8 fail on the clean branch). They are
the in-flight instance-label-placement / golden-SVG / Razavi-catalog
regeneration owned by the separate `codex/ci-delivery-gate` target (the files
that were dirty at session start). R7 introduces no new failures.
`prettier --check` on changed `.ts`; `git diff --check` clean.

Deferred (follow-on targets): typed `place_no_connect`/`remove_no_connect`
Edit Engine edits + clipboard/delete, importer `SourceBindingEvidence` write,
Razavi No-Connect visual asset + hit + export, Agent Snapshot additive fields.

`status: completed`, `experience: candidate` (the schema-bump cascade — every
typed `SchematicDocument` literal and every exact-round-trip fixture must be
updated together — is a reusable lesson worth extracting if R8/R9 confirm it
generalizes).
