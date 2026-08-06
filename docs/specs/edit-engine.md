# Schematic Edit Engine

Status: `accepted`

Version: `1.0-envelope`

Owning phase: `Phase 0/1`

Primary owner: `packages/edit-engine`

## Purpose

Define the only committed mutation path for both GUI and Agent operations,
including revision checks, dry runs, atomicity, results, and diagnostics.

## Consumers

- editor GUI tools
- Agent adapter
- history and undo/redo
- model validators and diagnostics

## Terminology

| Term | Meaning |
|---|---|
| Transaction | One atomic ordered list of typed edits against one Document revision |
| Dry run | Full validation and diff prediction without mutation or revision advance |
| Preflight | Validation performed before any candidate mutation is committed |

## Data model or interface

```typescript
interface EditTransaction {
  transactionId: string;
  documentId: string;
  expectedRevision: number;
  actor: { kind: "human" | "agent"; id: string };
  dryRun?: boolean;
  edits: SchematicEdit[];
}
```

The Phase 0 executable union contains only `noop`, proving the envelope without
prematurely freezing Phase 1–5 edit payloads. Later phases extend the typed
union and versioned schemas; they do not create separate mutation endpoints.

## Invariants

- A transaction targets exactly one Document.
- `expectedRevision` must equal the current revision.
- The complete payload is schema-validated before application.
- All edits apply or none apply.
- A rejected transaction returns the original Document object and revision.
- A successful committed transaction advances revision exactly once.
- Dry run returns a proposed revision and deterministic diff but preserves the
  current Document and revision.
- GUI and Agent callers cannot bypass Document validation.

## Operations and state transitions

```text
schema → document identity → revision → preflight → candidate apply
→ deterministic validation → commit revision + 1
```

`STALE_REVISION`, `DOCUMENT_MISMATCH`, and validation errors are typed failures.
Undo and redo are future typed edits that create new monotonically increasing
revisions; they do not decrement revision.

## Persistence boundary

Only the resulting Document and its revision are persisted. Transactions,
preflight state, diffs, diagnostics, and history implementation data are
runtime state unless a later recovery contract explicitly snapshots them.

## Valid example

A `noop` transaction at revision 0 commits revision 1 with an empty
`changedObjectIds` array. The same transaction with `dryRun: true` reports
proposed revision 1 while returning revision 0.

## Rejected example

A transaction with `expectedRevision: 8` against revision 9 returns
`STALE_REVISION`; no edit is evaluated and the original Document is returned.

## Compatibility and migration

New edit kinds are additive within a versioned union. Changing the meaning of
an existing kind requires a new API/schema version or explicit compatibility
adapter.

## Deterministic validation

- stale revision and Document mismatch tests
- schema rejection before apply
- atomic no-op and dry-run tests
- later GUI/Agent parity tests

## Open decisions

- History retention and compaction are finalized in Phase 1.
