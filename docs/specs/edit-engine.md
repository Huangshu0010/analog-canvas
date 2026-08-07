# Schematic Edit Engine

Status: `accepted`

Version: `1.6`

Owning phase: `Phase 0/1/8`

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

| Term        | Meaning                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| Transaction | One atomic ordered list of typed edits against one Document revision     |
| Dry run     | Full validation and diff prediction without mutation or revision advance |
| Preflight   | Validation performed before any candidate mutation is committed          |

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

The executable union contains `noop`, `add_instance`, `remove_instance`,
`place_instance`, `move_instance`,
`rotate_instance`, `mirror_instance`, `set_route_points`, `add_junction`,
`remove_junction`, `move_junction`, `make_flightline`, `connect_endpoints`,
`merge_nets`, `set_net_name`, `disconnect_endpoint`, `upsert_annotation`,
`remove_annotation`, `set_layout_group`, `remove_layout_group`,
`set_layout_constraint`, `remove_layout_constraint`, `align_instances`,
`undo`, and `redo`. Later phases extend the typed union and versioned schemas;
they do not create separate mutation endpoints.

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
- Locked annotation and layout-intent records cannot be replaced or removed.
- Moving or aligning an instance translates its attached annotations by the
  same delta in the same atomic transaction.
- A locked layout group or constraint rejects transforms of any referenced
  instance, so a multi-object transaction cannot move only an unlocked subset.
- Instance/topology authoring sets `sourceStatus` to
  `connectivity-modified`; geometry-only edits preserve the prior status
  transition.

Phase 8 topology operations have these preconditions:

- `add_instance` requires a globally unused object ID and resolvable Symbol.
- `remove_instance` requires no Net, annotation, group, or constraint
  reference.
- `connect_endpoints` creates a caller-named local Net when both endpoints are
  unowned, or attaches an unowned endpoint to the other endpoint's Net.
- `set_net_name` requires a non-empty trimmed name. A name already owned by a
  different Net is rejected; the caller must explicitly `merge_nets`.
- `move_junction` preserves topology and must be paired with any required
  `set_route_points` edits in the same transaction. Routes protected by locked
  geometry reject the move.
- `add_junction` normally requires an existing Net. `createNet: true` permits
  creation of the named empty local Net in the same edit, enabling a free wire
  endpoint without a second mutation path.
- Connected-instance deletion remains a composed transaction rather than a
  destructive `remove_instance` flag: Routes are first repointed to replacement
  Junctions, terminals and annotations are removed explicitly, and only then is
  the unreferenced instance removed.
- Endpoints on different Nets require an explicit preceding `merge_nets` edit
  in the same transaction.
- `merge_nets` retargets routes, junctions, annotations, and layout references
  before removing the source Net.
- `disconnect_endpoint` requires all route geometry that uses the endpoint to
  be removed explicitly first.

## Operations and state transitions

```text
schema → document identity → revision → preflight → candidate apply
→ deterministic validation → commit revision + 1
```

`STALE_REVISION`, `DOCUMENT_MISMATCH`, and validation errors are typed failures.
Undo and redo require a `DocumentHistory` session. They restore prior validated
Document content while creating a new monotonically increasing revision; they
never decrement or reuse a revision. A new normal edit clears the redo stack.

## Persistence boundary

Only the resulting Document and its revision are persisted. Transactions,
preflight state, diffs, diagnostics, and history implementation data are
runtime state unless a later recovery contract explicitly snapshots them.

## Valid example

One transaction adds two resistors, connects two pins into a caller-named Net,
and adds its Route. It commits one revision and sets `sourceStatus` to
`connectivity-modified`; failure of any later edit restores the exact input.

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
- GUI/Agent parity tests for Phase 8 authoring operations

## Open decisions

- Persistent history, history compaction, and recovery integration remain
  deferred; Phase 1 history is validated in-memory session state.
