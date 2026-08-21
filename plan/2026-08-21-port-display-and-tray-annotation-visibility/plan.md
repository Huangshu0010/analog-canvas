---
status: completed
experience: none
---

# Schematic Label Authority, Port Display, and Tray Annotation Visibility

## Goal

Make RichText `schematicName` the single default user-visible instance label
authority (with a non-ID fallback to the internal schematic/netlist
reference), while hiding instance-owned visual annotations in the Placement
Tray and making a formal Cell Port's terminal name its only visible
identifier.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/schematic-instance-lifecycle-ux
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean. The untracked local dependency/worktree paths
are out of scope and remain untouched.

- `packages/derived/`, `packages/render-svg/`, `apps/editor/src/`
- `packages/model/`, `packages/project-protocol/`, `packages/edit-engine/`
- affected fixtures, tests, documentation, and `plan/log.md`

Shared: Project schema compatibility, annotation bindings, and the Cell
terminal interface contract. `Instance.id` remains the sole lifecycle identity.

## Work

1. Correct generic instance-label bindings so default labels resolve through
   `schematicName`, fall back only to `schematicReference` or
   `netlist.reference`, and materialize RichText `schematicName` when edited.
   Keep `instance-designator` as an optional, read-only network identifier;
   remove the duplicate user-facing schematic-reference/alias inputs.
2. Add one shared presentation predicate so instance-owned annotations render
   and accept hits only while their instance is placed.
3. Change formal Cell Port presentation to render only `CellTerminal.name` in
   the Reference slot; prevent formal Ports from owning or accepting a
   schematic reference.
4. Advance the Project schema and migrate schema-17 default designator
   projections to schematic-name projections, while converting formal Port
   projections to terminal-name-only and removing their redundant
   `schematicReference` data.
5. Update creators, importer, fixtures, documents, and focused lifecycle,
   render, migration, and browser tests.

## Validation

- `pnpm test:local <affected test paths>`
- `pnpm test:e2e:local <affected specs> --grep <pattern>`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: `Instance.id` is never visible; generic default labels are
  RichText `schematicName` with a schematic/netlist-only fallback; retained
  instances leave no visible/clickable object labels; re-placement restores
  retained labels; formal Cell Ports display only their terminal name and
  cannot carry a schematic reference.
- Primary checks: derived/render presentation, edit-engine schema and
  transaction, project migration, editor display, and browser lifecycle tests.

## Commit Intent

Commit as:

```text
fix(editor): restore rich schematic label authority
```

## Outcome

Completed schema-18 display correction: ordinary default labels now bind to
RichText `schematicName` with a non-ID schematic/netlist fallback; the netlist
designator is optional and read-only. Formal Ports retain terminal-name-only
presentation and tray-retained annotations are hidden and non-interactive until
re-placement. The rolling v17 migration preserves ordinary label geometry while
rebinding it and converts formal Port projections to terminal names.

Validated with focused unit contracts (9 files / 78 tests), focused Playwright
flows (5 tests), workspace typecheck, Prettier, Markdown-link validation,
test-impact, and `git diff --check`.
