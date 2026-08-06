# Phase 6 - Agent API

Status: `proposed`

## Objective

Expose the current Document to external or embedded Agents through a small,
transport-independent API while keeping all correctness, revision, permission,
and mutation rules inside the existing Schematic Edit Engine.

## User-visible outcome

An authorized Agent can inspect a bounded region or net, propose a dry run,
atomically apply typed edits, receive deterministic diffs and diagnostics, and
request a local render for visual review without reading or replacing the full
Project file.

## In scope

- Agent Circuit API v1 with `capabilities`, `query`, `transact`, and `render`;
- TypeScript service interface and JSON Schema/OpenAPI representation;
- in-process adapter and, if required by the selected host, localhost HTTP;
- document-scoped permissions and connectivity-edit permission;
- query scopes, response limits, truncation, and source-span opt-in;
- expectedRevision, dry run, operation limits, atomic apply, and typed errors;
- structured diff and diagnostics;
- formal versus overlay render options;
- Agent API usage, operations, routing, and analog-layout guidance;
- parity tests between GUI and Agent-triggered edits.

## Out of scope

- MCP server or MCP dependency;
- bundling a specific LLM provider;
- autonomous planning as a core application responsibility;
- Agent access to arbitrary filesystem paths;
- raw SVG, Project JSON, JavaScript, or whole-Document replacement APIs;
- multiplayer conflict resolution.

## Dependencies

- Phase 3 and Phase 5 exit gates;
- accepted `agent-api.md`, `edit-engine.md`, and visual/routing specs;
- stable describer, diagnostics, renderer, and Edit Engine operations.

## Work packages

### WP-6.1 - API contract and capabilities

- Goal: define versions, permissions, limits, query scopes, operation schemas,
  result errors, and compatibility policy.
- Main modules: `packages/agent-adapter`, docs/specs.
- Required specs: `agent-api.md`; no-MCP ADR.
- Validation surface: schema examples and compatibility tests.

### WP-6.2 - Query and bounded context

- Goal: expose selection, objects, region, net, changes, constraints, and
  diagnostics without returning unbounded Project data.
- Main modules: core describer and Agent adapter.
- Required specs: query response and truncation rules.
- Validation surface: scope, limits, redaction, and stable text/JSON fixtures.

### WP-6.3 - Transact and render

- Goal: adapt external requests to the same Edit Engine and renderer used by
  the GUI.
- Main modules: Agent adapter, core edit, render-svg.
- Required specs: transaction, permission, and render contracts.
- Validation surface: stale revision, dry run, permission denial, edit parity.

### WP-6.4 - Agent guidance and examples

- Goal: document preferred layout and routing judgment separately from hard
  program invariants.
- Main modules: `docs/agent` and example fixtures.
- Required specs: accepted visual and routing contracts.
- Validation surface: reproducible example transcripts and resulting Projects.

## Deliverables

- Agent Circuit API v1 TypeScript and JSON schemas;
- capabilities/query/transact/render implementations;
- permissions and limits;
- structured diff and diagnostics responses;
- optional localhost transport selected by an ADR;
- Agent usage, layout, analog, routing, and example documents;
- GUI/Agent edit parity suite.

## Acceptance scenarios

```text
Agent calls capabilities
→ queries one selected region
→ receives bounded structured context at revision 42
→ dry-runs align_instances
→ applies the same transaction
→ receives revision 43, diff, and no diagnostics
→ renders only the changed region
```

```text
Human changes the Document after Agent query
→ Agent submits expectedRevision 42
→ API returns STALE_REVISION with actual 43
→ no partial edit is applied
```

## Deterministic validation

- JSON Schema/OpenAPI conformance tests;
- capabilities version and operation-set snapshots;
- query scope, truncation, and permission tests;
- dry-run and atomic transaction tests;
- stale revision and locked-object rejection tests;
- GUI/Agent result parity tests;
- render overlay inclusion/exclusion goldens.

## Risks and decisions

| Risk or decision | Handling |
|---|---|
| API becomes a mirror of every internal function | Keep four operations and typed payload unions |
| Agent receives excessive data | Require scope and enforce response budgets |
| Prose is treated as safety enforcement | Hard rules remain in schema, permissions, and validators |
| Transport choice leaks into core | Keep TypeScript service transport-independent |

## Exit gate

- All four API operations are versioned, schema-validated, bounded, and tested;
- Agent edits have identical semantics to GUI edits;
- no API permits raw document replacement, arbitrary file access, or bypass of
  the Edit Engine;
- layout guidance and at least three end-to-end examples are reviewed.
