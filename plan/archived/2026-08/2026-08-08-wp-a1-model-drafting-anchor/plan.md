---
status: completed
experience: none
---

# WP-A1: Model, Migration, Edit Engine, and Derived Anchor Resolver

Status: `proposed` — awaiting human review before editing shared contracts.

## Goal

Implement the persisted data model, the versioned schema-1->2 migration, the
typed Edit Engine transaction kinds, and the general `VisualAnchor` resolver
for the Text & Peripheral Editing System frozen in WP-A0 / ADR 0010. This is
the shared-contract foundation; no rendering or UI work (WP-A2/A3/A4).

Concretely:
- Bump `CURRENT_PROJECT_SCHEMA_VERSION` 1 -> 2 and register the idempotent
  migration in `defaultProjectMigrations`.
- Add `DraftingLayer` (`objects`, `guides`), `RichTextDocument`/`RichTextRun`
  (six-node AST), `VisualAnchor` (`free | object | route`), the
  `DraftingObject` union, and `Guide` to `SchematicDocument`.
- Narrow `annotations` to SchematicAnnotation
  (`instance-label | net-label | power-label | route-marker`) and migrate the
  old `plain-text`/`figure-caption`/`current`/`voltage` per the ADR table.
- Add the six Edit Engine edits (`upsert_schematic_annotation`,
  `remove_schematic_annotation`, `upsert_drafting_object`,
  `remove_drafting_object`, `set_guide`, `remove_guide`) with lock checks,
  delete cascade, and stable ordering.
- Promote `routeAttachmentPlacement()` (packages/derived/src/routes.ts:73) into
  a general `VisualAnchor` resolver returning resolved position/rotation plus
  unresolved-anchor diagnostics.

## Dirty-State Decision

A known concurrent worker (user-confirmed) is iterating symbol/arrowhead
calibration in `packages/symbols/**` and `scripts/generate-visio-*.mjs`. That
work does NOT overlap this target's owned paths. However, WP-A1 changes
shared contracts (model schema, edit-engine union, derived resolver) that the
concurrent worker's packages depend on through `node_modules` dist copies.

Risk control: WP-A1 is committed with all dependent packages rebuilt and the
workspace typecheck + full suite green for the files this target owns. If the
concurrent worker's uncommitted symbol changes leave `render.test.ts` /
`razavi-catalog.test.ts` red at commit time, those failures are documented as
not owned by this target (their stale goldens/expectations), and this target's
own focused suites (model, edit-engine, derived) must be green. The concurrent
worker's dirty files are never staged by this target.

## Sequencing (revised after WP-A0 review)

Old annotation kinds are consumed by the renderer, editor, and agent-adapter,
so the version switch cannot land atomically while those stay read-only. WP-A1
is staged per ADR 0010:

- **A1a** — add v2 types, the migration function, and the anchor resolver.
  `CURRENT_PROJECT_SCHEMA_VERSION` stays `1`; old kinds remain accepted; v2 is
  parse-only. No renderer/editor/agent-adapter edits.
- **A1b / WP-A2** — add minimal compatible consumption in the renderer and the
  Snapshot (read drafting objects; keep rendering old kinds until the switch).
  Owned by those packages, not this plan.
- **Integration gate** — once every consumer is green on both old and new
  shapes, flip `CURRENT_PROJECT_SCHEMA_VERSION` to 2, rename/typed
  `topologyHash` -> `electricalTopologyHash`, and remove the old runtime kinds
  in one commit. `main` is never left in a "migrates but text/markers vanish"
  state.

This plan owns **A1a** and the **integration gate**. A1b consumption is
declared read-only here and owned by WP-A2.

## Owned Files (A1a)

- `plan/2026-08-08-wp-a1-model-drafting-anchor/plan.md`
- `packages/model/src/schema.ts` (new v2 schemas; keep v1 kinds accepted)
- `packages/model/src/factories.ts` (createEmptyDocument emits a drafting layer;
  emits schemaVersion per current constant)
- `packages/model/src/migration-v1-to-v2.ts` (new, idempotent migration)
- `packages/model/src/persistence.ts` (register the migration; do NOT bump the
  constant in A1a)
- `packages/model/src/schema.test.ts`, `persistence.test.ts` (migration tests)
- `packages/edit-engine/src/transaction.ts` (six new edit schemas + execute,
  additive; resolver-validated floating-symbol)
- `packages/edit-engine/src/transaction.test.ts` or focused test (new edits)
- `packages/derived/src/anchor.ts` (new, general VisualAnchor resolver +
  `electricalTopologyHash` helper)
- `packages/derived/src/routes.ts` (`routeAttachmentPlacement` delegates to the
  general resolver; identical results for `route` anchors)
- `packages/derived/src/anchor.test.ts` (new)
- `packages/model/src/index.ts`, `packages/derived/src/index.ts`,
  `packages/edit-engine/src/index.ts` (exports)
- `fixtures/projects/text-*/expected-schema2.json` (new, post-migration
  expectation JSON for the three WP-A0 fixtures)
- `plan/log.md`

## Owned Files (integration gate, separate commit, after A1b)

- `packages/model/src/schema.ts` (bump `CURRENT_PROJECT_SCHEMA_VERSION` to 2;
  remove old runtime kinds)
- `packages/agent-adapter/src/snapshot.ts` (`topologyHash` ->
  `electricalTopologyHash`)
- `packages/agent-adapter/src/service.ts` (`editCategory` for new edits)

## Read-Only Files

- `packages/render-svg/src/**`, `apps/editor/src/**`,
  `packages/agent-adapter/src/**` — A1b consumption is owned by WP-A2. A1a does
  not edit them; the gate edits only `snapshot.ts`/`service.ts` as listed.
- `packages/symbols/**`, `scripts/generate-visio-*.mjs` — concurrent worker's.
- `docs/specs/**`, `docs/adr/0010-*.md` — frozen in WP-A0/A0.1; this target
  implements them, it does not re-open them.

## Shared Dependencies

- `CURRENT_PROJECT_SCHEMA_VERSION` and `CircuitProjectSchema` — the canonical
  persisted truth; A1a extends the schema additively, the gate bumps the
  version.
- The Edit Engine `SchematicEditSchema` discriminated union — extended
  additively; existing edit kinds keep their meaning and payloads.
- `routeAttachmentPlacement()` — currently `current`-marker-specific; promoted
  to the general resolver, preserving its existing results for `route` anchors.
- Symbol Resolver — the Edit Engine uses it to validate
  `floating-symbol.symbolId` is `decorative: true` and terminal-free; the model
  Zod schema does not enforce this.
- All fixture Projects currently at `schemaVersion: 1` under
  `fixtures/projects/**` — must migrate cleanly; their `electricalTopologyHash`
  must be unchanged.

## Expected Work (A1a)

1. **Model schemas**: define `RichTextDocumentSchema`, `RichTextRunSchema`
   (four node kinds; `span` has four styles; bounds: depth 4, 64 runs, 256
   chars/run, non-empty fraction parts), `VisualAnchorSchema` (`free | object |
   route` with `fallbackPosition` on object/route), `GuideSchema`, the
   `DraftingObject` discriminated union, and `DraftingLayerSchema`. Add
   `drafting` to `SchematicDocumentSchema`. Add the narrowed SchematicAnnotation
   (`route-marker` with `markerKind`) **alongside** the old kinds; do not remove
   old kinds in A1a. Enforce `object`-anchor target kind (Instance/Port/
   Junction) in the schema.
2. **Migration**: write `migrateV1ToV2` applying the ADR table. The `voltage`
   rule is deterministic: resolvable `attachedObjectId` -> object-anchor
   `route-marker/voltage`; else free `DraftText` + migration diagnostic; never
   guess a Route/segmentIndex/t. Register it; do NOT bump the constant. Prove
   idempotency and `electricalTopologyHash` stability.
3. **Edit Engine**: add the six edit kinds additively. Delete semantics:
   deleting an anchor target is non-cascading and non-rejecting; the same
   transaction updates `fallbackPosition` and marks the anchor unresolved;
   content locks do not block fallback maintenance. `upsert_drafting_object`
   for a floating-symbol validates `symbolId` via the Symbol Resolver and
   rejects non-`decorative`/terminal-bearing entries.
4. **Derived**: implement `resolveVisualAnchor()` generalizing
   `routeAttachmentPlacement()`; return resolved position/rotation and, for an
   unresolved anchor, `fallbackPosition` + a diagnostic (no persisted warning
   boolean). Implement `electricalTopologyHash` (instances/ports/Nets/
   hierarchy only). Keep `routeAttachmentPlacement` results identical for
   `route` anchors.
5. Add the three `expected-schema2.json` post-migration expectation fixtures.

## Validation

- `npx vitest run packages/model packages/edit-engine packages/derived` — the
  three packages this target owns must be fully green.
- Migration tests: old schema-1 fixtures (WP-A0 fixtures + existing
  `fixtures/projects/**`) migrate to the v2 shape deterministically and match
  the `expected-schema2.json` expectations; re-migration is a no-op;
  `electricalTopologyHash` unchanged; every old annotation kind maps per the
  ADR table, including the deterministic `voltage` rule and its diagnostic.
- Edit Engine tests: each new edit commits atomically, respects locks, and
  undoes cleanly; target-delete updates `fallbackPosition` and leaves the
  attached object in place (no cascade, no reject); floating-symbol validation
  rejects non-`decorative`/terminal entries via the resolver.
- Anchor resolver tests: `route`/`object`/`free` anchors resolve; a deleted
  Route/object yields a fallback + diagnostic, never silent re-attach; a
  stretched Route keeps the marker at the same proportional `t`; an `object`
  anchor targeting a DraftingObject is rejected.
- `npx tsc -p tsconfig.check.json --noEmit` clean for the workspace (dependent
  packages rebuilt). Because A1a keeps old kinds accepted, renderer/editor/
  agent-adapter typecheck stays green without editing them.
- `git diff --check`, `git status --short --branch`.
- Full suite as a regression guard; any failures must be attributable to the
  concurrent worker's uncommitted symbol work (stale goldens), not to this
  target's files.

The integration gate commit additionally requires the full workspace (including
renderer/editor/agent-adapter after A1b) to be green before the version flip.

## Risk note for human review

This is the highest-risk workpackage because it mutates the persisted schema
and the edit union. The six frozen decisions (ADR 0010, revised in A0.1) are
assumed final: `VisualAnchor.fallbackPosition` + object-target restriction +
non-cascading delete; RichText four-node-kind + bounds; deterministic
`voltage` migration; `electricalTopologyHash`; resolver-validated decorative
symbol; and A1a/A1b/gate sequencing. After A1a lands, changes to these require
another migration.

## Commit Intent

```text
feat(model): v2 drafting types, schema-1->2 migration, and VisualAnchor resolver (WP-A1a)
<gate> feat(model): switch to schema 2 and electricalTopologyHash (WP-A1 gate)
```

## Outcome

Completed. The factual entries in `plan/log.md` dated 2026-08-08 record the
additive model/migration/anchor work (A1a), renderer and Agent-adapter
consumption (A1b), and the schema-2 integration gate. This plan is historical
schema-migration evidence and is retained in the archive.
