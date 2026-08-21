---
status: completed
experience: none
---

# Unified Port Naming and RichText Presentation

## Goal

Separate Port geometry, Net/Cell-terminal semantic naming, and annotation
presentation. Allow explicit free Net Ports and formal Cell Pins in child
documents, keep semantic renames electrically authoritative, and persist
RichText only as a same-text annotation formatting override.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/schematic-instance-lifecycle-ux
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean. The untracked local dependency/worktree paths
are out of scope and remain untouched.

- `packages/model/`, `packages/edit-engine/`, `packages/derived/`
- `apps/editor/src/`
- affected tests, documentation, validation-contract bounds, and `plan/log.md`

Shared: Net and Cell-terminal identity, hierarchy caller pin reconciliation,
netlist export, Port insertion intent, annotation bindings, and Project
persistence. The current branch's uncommitted `CellTerminal.schematicLabel`
experiment is owned by this target and will be replaced rather than committed.
Branch verification also exposed a canonical JSON formatting drift committed
by the immediately preceding target in
`fixtures/projects/phase-5-dense-analog/project.icproj.json`; this target owns
only the deterministic reserialization needed to restore the existing corpus
gate.

## Work

1. Keep semantic names in `Net.name` and `CellTerminal.name`; permit bound
   `net-name`/`cell-terminal-name` annotations to retain a RichText formatting
   override only when its normalized text matches the semantic source.
2. Route canvas text commits by intent: character changes rename the Net or
   Cell terminal through their existing electrical planners, while format-only
   changes update only the annotation.
3. Make Port insertion role explicit. A free Net Port binds its visible text to
   the connected Net; a formal Cell Pin additionally creates a CellTerminal.
   Remove document-position inference and Port `P#` reference display.
4. Define deterministic create/attach naming defaults without imposing global
   equality between terminal and Net names, then update Properties terminology,
   contracts, docs, and focused unit/browser tests.

## Validation

- `pnpm test:local <affected test paths>`
- `pnpm test:e2e:local <affected specs> --grep <pattern>`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: Port labels are Net/terminal semantic projections; RichText
  overrides cannot create aliases; free/formal roles are explicit; semantic
  renames preserve Net/interface/caller invariants; formatting changes do not.
- Primary checks: model annotation/document schema, derived annotation text,
  edit-engine name planners, Port insertion, and free/formal Port browser flows.

## Commit Intent

Commit as:

```text
feat(editor): unify port naming and rich text
```

## Outcome

Implemented one Port protocol across free Net Ports and formal Cell Pins.
Insertion now carries an explicit role and deterministic semantic name;
object-anchored annotations project `Net.name` or `CellTerminal.name`; canvas
character edits rename that semantic owner; and formatting-only edits persist
a schema-validated, same-text `Annotation.formatOverride`. Properties exposes
the correct semantic owner, hierarchy terminal renames remain atomic across
callers, and Port labels remain tied to Placement Tray lifecycle without a
visible `P#` identity.

Validation passed:

- focused unit contracts: 6 files / 72 tests;
- complete hierarchy browser specification: 9 tests;
- repaired gate regressions: 2 files / 18 tests;
- `pnpm test:impact -- --base origin/main`;
- `pnpm verify:branch`: static contracts, 162 unit files / 975 tests, all
  workspace builds, and production preview smoke;
- `git diff --check` and final worktree audit.
