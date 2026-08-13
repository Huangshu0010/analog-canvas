---
status: completed
experience: none
---

# First-Class Port Presentation

## Goal

Eliminate the current dual authority between `Document.ports` and editable
`port`/`port-filled` Symbol instances. Persist Port visual presentation on the
first-class Port record, migrate schema-v5 Projects (including all terminal,
route, Net, NoConnect, and layout references), remove Port symbols from the
product/Agent palette, and make GUI and Agent author Ports through typed edits.

## State and Ownership

Start state:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean after `d110861`. This target owns model schema v6 and its
migration, edit-engine Port edits, formal rendering, GUI palette/placement,
Agent catalog/request/snapshot contracts, canonical fixtures, and focused
tests/docs/plan log. It does not remove VDD/ground visual assets, change
RichText/VisualAnchor, or perform the typed-netlist migration.

Shared dependencies:

- generated Razavi catalog remains a legacy-asset reader during migration but
  must no longer be a product insertion catalog for `port`/`port-filled`;
- route geometry and Net membership are read-only contracts except for the
  deterministic migration remap;
- schema v5 power-domain migration is an immediate predecessor and must remain
  in the registered chain.

## Work

1. Add `Port.presentation` (`hollow`/`filled`/`supply`) and schema v5-to-v6
   migration. Convert placed/unplaced legacy port instances into true Ports;
   preserve connectivity by rewriting Net terminals, Route endpoints,
   NoConnects, labels, layout references, and Cell port order.
2. Add atomic Port create/remove/rename/direction/presentation edits and make
   placement/movement operate on the same Port. Reject removal with unresolved
   electrical/visual references rather than silently creating debris.
3. Render Port presentation solely from the Port record. Remove `port` and
   `port-filled` from built-in product catalog, GUI insertion, and Agent
   catalog; retain only migration inputs until the later asset-retirement
   target.
4. Give GUI a first-class Port creation entry and give Agent production Schema
   and OpenAPI a valid `add_port` example. Ensure Snapshot returns presentation.
5. Rewrite canonical fixtures/demos and add migration, transaction, renderer,
   palette, and Agent regression tests.

## Validation

- focused model migration/schema, edit-engine, render, symbols, editor, and
  Agent tests
- `pnpm agent-api:artifacts` plus check
- `pnpm typecheck`, `pnpm docs:check`, `git diff --check`
- `pnpm verify:branch` before delivery

## Commit Intent

```text
feat(model): make Ports first-class visual endpoints
```

## Outcome

Implemented schema v6 and migrated legacy `port` / `port-filled` Symbol
instances to first-class Port records with explicit presentation. Net terminals,
Route endpoints, NoConnects and Cell interface order migrate together; current
Port creation, render, Snapshot, Agent authoring and GUI quick place all use
the same Port record and typed edit union. Retired Port Symbols remain readable
only as migration assets and are absent from product/Agent catalogs. Canonical
fixtures, routing test fixtures and visual goldens now express Ports directly.

Validation passed: focused model/edit/render/editor/Agent tests; full
`pnpm test:local` (115 files, 712 tests); typecheck; Agent artifacts write and
check; docs/reference/visual golden checks; `git diff --check`; and
`pnpm verify:branch`.
