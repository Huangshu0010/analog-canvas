# WP-A0: Freeze Text, Annotation, and Peripheral Editing Contracts

## Goal

Freeze the four shared-contract specifications and the V1 syntax/object scope
for the Text, Annotation, and Peripheral Editing System
(`docs/roadmap/text-annotation-peripheral-editing-plan.md`), and add three
fixture Projects plus their Razavi formal SVG goldens that exercise rich text,
route markers, and peripheral callout/guide. This is a documentation + fixture
target only: it changes no runtime model, Edit Engine, renderer, or editor
code. Implementation begins in WP-A1.

Frozen decisions (per user, adopting roadmap defaults):

1. RichText AST V1 = six nodes: `text`, `line-break`, `span` (italic|bold|
   subscript|superscript), `fraction`. No arbitrary LaTeX/script/SVG/HTML.
2. `annotations` narrows to SchematicAnnotation
   (`instance-label | net-label | power-label | route-marker`); `plain-text`
   and `figure-caption` migrate into the new `drafting` container per the
   roadmap migration table.
3. Guides persist for collaboration but are always `export: false`. The
   default Snapshot returns guide count and per-guide `visible`/`locked` state;
   guide coordinates require an explicit `includeEditorGuides: true` option.
4. `floating-symbol.symbolId` may only reference Symbol Catalog entries marked
   `decorative: true`; their definitions must contain no terminal.
5. Schema major version bump (`schemaVersion` 1 -> 2) with a versioned,
   idempotent migration and an ADR.

## Dirty-State Decision

The worktree has one unrelated dirty path: `scripts/generate-visio-core-
analog-assets.mjs`, owned by a known concurrent symbol/arrowhead-calibration
worker (user-confirmed as expected). It does not overlap this target's owned
paths (specs, new fixtures, goldens, this plan, log). Proceeding with the
unrelated dirty file untouched, per AGENTS.md.

## Owned Files

- `plan/2026-08-08-wp-a0-freeze-text-annotation-contracts/plan.md`
- `docs/specs/schematic-model.md` (add DraftingLayer, RichText AST,
  VisualAnchor, DraftingObject/Guide, narrowed SchematicAnnotation, migration,
  schema version 2, ADR reference)
- `docs/specs/edit-engine.md` (add `upsert_schematic_annotation`,
  `remove_schematic_annotation`, `upsert_drafting_object`,
  `remove_drafting_object`, `set_guide`, `remove_guide`; dry-run diagnostics:
  resolved anchors, invalid attachments, overlap, changed IDs)
- `docs/specs/agent-api.md` (Snapshot additions: drafting objects with
  canonical RichText AST, resolved anchor, bounds, locked, zIndex, invalid
  diagnostics; default excludes Guide coords, `includeEditorGuides` option;
  no SVG/HTML/LaTeX injection)
- `docs/specs/editor-interaction.md` (Text/Markup/Guides groups in More,
  command palette Ctrl+K, `T`/`A`/`G` shortcuts, rich-text in-place editor,
  unified hit-test/stacking order, construction-line vs guide distinction)
- `docs/adr/00YY-text-annotation-drafting-schema.md` (new ADR for the schema
  major version bump)
- `fixtures/projects/text-rich-text/project.icproj.json` (new)
- `fixtures/projects/text-route-marker/project.icproj.json` (new)
- `fixtures/projects/text-callout-guide/project.icproj.json` (new)
- `fixtures/visual-golden/text-rich-text.svg` (new golden)
- `fixtures/visual-golden/text-route-marker.svg` (new golden)
- `fixtures/visual-golden/text-callout-guide.svg` (new golden, no Guide bytes)
- `plan/log.md`

## Read-Only Files

- `packages/model/src/**`, `packages/edit-engine/src/**`,
  `packages/derived/src/**`, `packages/render-svg/src/**`,
  `apps/editor/src/**`, `packages/agent-adapter/src/**` — inspected for
  current behavior, not edited. WP-A0 writes no runtime code.
- `packages/symbols/**`, `scripts/generate-visio-*.mjs` — concurrent worker's.

## Shared Dependencies

- The four specs are the accepted cross-package contracts; this target
  revises them in place and bumps their `Version` headers.
- `CURRENT_PROJECT_SCHEMA_VERSION` (model schema) is a shared constant; WP-A0
  documents the planned bump to 2 but does not change the constant (that is
  WP-A1). The ADR records the decision.
- Fixture Projects must remain valid against the current schema (version 1)
  since the renderer cannot yet read drafting objects; the fixtures
  therefore express the target content using the *current* annotation model
  where possible, and a documented note marks fields that WP-A1 will
  reinterpret. Goldens are produced with the current renderer.

## Expected Work

1. Write the ADR recording the schema major version bump, the four frozen
   decisions, and the migration contract.
2. Revise the four specs: data types, layering, migration, non-goals, and the
   new edit kinds / Snapshot fields / interaction surfaces. Bump version
   headers. Mark Status `accepted` only for the frozen contract sections;
   leave runtime behavior text at its current accepted version.
3. Create three fixture Projects under `fixtures/projects/text-*/` and render
   their formal SVG goldens with the current renderer (documenting the
   current-vs-target gap). The callout-guide golden must contain no Guide
   bytes (Guides never export).
4. Run focused validation; record the log entry.

## Validation

- `git diff --check` and `git status --short --branch`
- The four specs remain internally consistent and cross-reference the ADR.
- The three new fixture Projects parse with the current model
  (`CURRENT_PROJECT_SCHEMA_VERSION`) and their goldens render from the current
  renderer, proving the fixtures are reachable today.
- No runtime package, test, or generated artifact changes; `npx vitest run`
  remains 203/203 and `npx tsc -p tsconfig.check.json --noEmit` remains clean
  as a guard against accidental code edits.

Validation is documentation + fixture-reachability only because WP-A0 changes
no runtime behavior. The full-suite/typecheck guard runs only to prove no code
was accidentally touched.

## Experience Signal (for human review)

The concurrent symbol/arrowhead worker repeatedly committed symbol-geometry
changes without regenerating the dependent visual goldens, breaking HEAD three
times within one session (phase-1/5 + route-attached current-arrow). Each time
the break was masked initially because the in-repo `dist` used by the golden
`--check` scripts was itself stale. A human may want a lesson on coupling
symbol-asset regeneration with golden regeneration, or a CI guard that rebuilds
`dist` before golden `--check`. Not extracting now; flagged for human decision.

## Commit Intent

```text
docs(specs): freeze text, annotation, and peripheral editing contracts (WP-A0)
```
