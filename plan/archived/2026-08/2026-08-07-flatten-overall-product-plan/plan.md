# Flatten Overall Product Plan

## Goal

Refactor `docs/overall-product-plan.md` into a flatter system design that
preserves the accepted full-SPICE, explicit-junction, VSS symbol, graphical
language, human/AI editing, and validation contracts while clearly separating
build-time tooling, import-time parsing, runtime editing, external protocol,
and physical files.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. The current document already includes the separately
committed default schematic graphical-language refinement and is the only
product document being replaced by this target.

## Owned Files

- `docs/overall-product-plan.md`
- `plan/2026-08-07-flatten-overall-product-plan/plan.md`
- `plan/log.md`

## Read-Only Files

- `README.md`
- `AGENTS.md`
- `plan/README.md`
- `lib/circuit.vss`
- `netlists/`
- The user-supplied flattening proposal attachment

## Shared Dependencies

- Existing full-SPICE compatibility decision
- Existing explicit junction and crossing semantics
- Existing `textbook-monochrome-v1` graphical-language contract
- Existing plan-log-experience repository workflow

## Expected Work

1. Separate the build-time symbol pipeline, import-time SPICE pipeline, and
   runtime editing pipeline.
2. Collapse the persistent model to `CircuitProject -> SchematicDocument[]`
   and defer `SchematicPage`.
3. Mark syntax trees, Circuit IR, indexes, flightlines, diagnostics, and SVG as
   in-memory or derived rather than project files.
4. Replace per-operation external APIs with seven coarse protocol operations
   while retaining typed edits behind one transaction endpoint.
5. Rename the internal mutation component to `Schematic Edit Engine` and make
   the human GUI path explicit.
6. Reduce the user project layout to one project JSON, copied sources, and
   optional custom symbols.
7. Preserve the graphical-language, validation, and implementation contracts
   in the simplified architecture.

## Validation

- `git diff --check`
- `git status --short --branch`
- Check Markdown headings and fenced-code blocks for structural balance.
- Confirm the document contains the required contracts: three independent
  workflows, seven external operations, Project-to-Document persistence,
  deferred Page, transient Circuit IR, GUI-to-Edit-Engine human path,
  explicit junction/crossing behavior, full SPICE, VSS build-time isolation,
  minimal project files, and `textbook-monochrome-v1`.
- Confirm obsolete persisted paths and external per-command APIs are not
  presented as the MVP architecture.

These checks cover the documentation-only contract change without claiming
runtime, parser, rendering, or electrical validation.

## Experience Signal (for human review)


## Commit Intent

Commit as:

```text
Flatten overall circuit canvas architecture
```
