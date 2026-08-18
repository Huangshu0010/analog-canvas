---
status: completed
experience: none
---

# Typed Netlist Authority

## Goal

Complete M3 of the four-operation Agent takeover roadmap. Schema-v8 Project
data must make typed `Document.netlist` / `Instance.netlist` and immutable
import provenance the only runtime authority for netlist reference, binding,
parameters, terminal order, and hierarchy. No runtime consumer may read or
write `spice.*` properties. This preserves structural SPICE import and source
status; it does not add simulation, PVT, waveform data, or design-netlist
export.

## State and Ownership

Start state:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean. This target owns the v7-to-v8 migration and all direct
runtime consumers of the retired `spice.*` fields. Existing M0--M2 model
migrations are read-only dependencies. This target must not start Project
controller, File Resource, session-state, semantic-control, or history work.

Owned paths include:

- `packages/model/src/{schema,persistence,migration-v7-to-v8,*test*}.ts`
- `packages/spice/src/{importer,*test*}.ts`
- `packages/edit-engine/src/{transaction,*test*}.ts`
- `packages/derived/src/{connectivity-index,project-search,diagnostics/erc,*test*}.ts`
- `packages/agent-adapter/src/{schema,snapshot,*test*}.ts` and generated API
  artifacts
- `apps/editor/src/{document/editor-session,features/component-insert,*test*}.ts`
- canonical current fixtures affected by schema-v8 serialization
- current model/Agent specifications only where the changed runtime contract
  requires correction

Shared dependencies:

- `DocumentHistory` remains the sole Document mutation boundary.
- source import remains transient in `@icm/spice`; imported Project provenance
  is bounded data, not embedded source files.
- Agent production v2 remains exactly `capabilities|snapshot|transact|render`.

## Work

1. Add schema-v8 typed terminal mapping and bounded immutable
   `importProvenance`; tighten Cell interface invariants. Write a deterministic
   v7-to-v8 migration that consumes legacy `spice.*` keys without guessing
   hierarchy identity.
2. Convert the SPICE importer and linked-child pass to emit only typed facts;
   retain mapping-registry metadata as ordinary non-SPICE presentation/source
   metadata where appropriate.
3. Convert Snapshot, hierarchy index/navigation, ERC, project search,
   component parameter display, and Edit Engine symbol-pin validation to the
   typed authority. Remove all production `spice.*` readers/writers.
4. Regenerate Agent schemas/artifacts and migrate canonical fixtures. Add
   regression tests for primitive/model/external/linked subcircuit import,
   terminal order, migration conflicts, hierarchy/erc/search/snapshot parity,
   and rejection of newly authored legacy fields.
5. Update the relevant current contract documentation and run proportional
   cross-package verification.

## Validation

- focused model migration/schema, SPICE importer, Edit Engine, Derived,
  editor parameter, and Agent schema/Snapshot tests
- `pnpm agent-api:artifacts` and its check
- `pnpm typecheck`, `pnpm docs:check`, `pnpm references:check`,
  `git diff --check`
- `pnpm verify:branch` before delivery because schema, import, editor, derived,
  and public Agent contract cross package boundaries

## Commit Intent

Commit as:

```text
feat(model): make netlist provenance typed
```

## Outcome

Completed schema-v8 typed netlist authority. `Instance.netlist` now carries
ordered source terminal mappings; `Instance.importProvenance` preserves bounded
source target/status evidence without becoming editable/electrical authority.
The v7-to-v8 migration consumes `spice.name`, `spice.target`,
`spice.param.*`, `spice.pin.*`, and `spice.childDocumentId` deterministically,
preserves target-only legacy evidence without guessing status, and never links
a child Cell by name alone.

The importer, Net construction, symbol replacement, hierarchy index/navigation,
ERC, search, parameter panel, MOS source policy, Agent Snapshot/OpenAPI, and
canonical fixtures now consume typed facts. Current model and transaction
schemas reject `spice.*` authoring; source audit found no remaining production
reader or writer. Compatibility references remain only in the migration,
explicit rejection diagnostics, and tests.

Validation passed: focused migration/import/ERC/Snapshot contracts, full unit
suite and `pnpm verify:branch`, generated Agent artifact write/check, typecheck,
documentation/reference checks, formatter, and `git diff --check`.
