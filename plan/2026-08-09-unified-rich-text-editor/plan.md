# Unified rich-text editor

## Goal

Replace the separate Annotation and Drafting-text authoring controls with one
canvas-local rich-text editing session: select text, enter edit mode, and use a
minimal floating toolbar for italic, bold, subscript, superscript, and size.
Keep semantic schematic labels and free drafting text in their existing model
collections; share their content, formatting, rendering, and interaction path
instead of erasing their different electrical meanings.

## Dirty-state decision

This target began with a clean tracked worktree and unrelated untracked
generated RLC artifacts, prior-target plans (including a superseded fidelity
plan), and `probe-conflicts.mjs`.

During this target, Razavi component-calibration commits landed on the branch.
Their generated component geometry no longer matches three older whole-render
goldens, and their helper files also fail the workspace-wide Prettier check.
Those paths are read-only here and will not be edited, staged, or deleted.
The text compatibility adapter keeps legacy label SVG byte-stable, so the
remaining whole-render failures are component-only; focused RichText and
browser-editor checks remain the acceptance evidence for this target.

## Ownership

Owned paths:

- `plan/2026-08-09-unified-rich-text-editor/`
- `packages/model/src/schema.ts` and focused model tests/helpers needed for
  annotation RichText presentation
- `packages/render-svg/src/rich-text.ts`, `schematic-text.ts`, `render.ts`,
  and focused tests
- `apps/editor/src/App.tsx`, `apps/editor/src/styles.css`, a focused text
  editor component if introduced, and relevant unit/e2e tests
- `plan/log.md`

Read-only dependencies:

- edit-engine transaction schemas and persistence versioning
- derived drafting geometry, exporters, agent adapter, and accepted Razavi
  visual reference
- user-owned circuit/netlist artifacts and all other plans

## Shared-contract decision

`Annotation.content?: RichTextDocument` is an additive presentation field.
`Annotation.text` remains the semantic/fallback string for compatibility. A
net's canonical electrical name is never inferred from rich presentation
content. This bounded target does not change Project schema version or the
Agent API; optional content keeps existing Projects valid.

## Expected work

1. Give Annotation the same optional canonical RichText content used by
   drafting text, with a deterministic fallback from legacy schematic-math
   strings.
2. Make both paths render through the same AST-to-SVG text renderer; fix
   compositional nested styles while doing so.
3. Add one editor text-session adapter that targets either an annotation or a
   drafting text and commits through the existing typed transactions.
4. Replace side-panel markup/size controls with an SVG-local editable overlay
   and compact floating formatting toolbar. Raw markup remains import/paste
   compatibility only.
5. Use the existing Razavi typography tokens consistently. This target does
   not claim pixel-perfect font matching: it removes renderer divergence and
   introduces a single token path; reference-calibrated font measurement is a
   follow-up once a text reference crop and font ownership are fixed.
6. Add regression tests for annotation AST rendering, nested styles, and the
   editor's shared target behavior.

## Validation

- Focused Model, Render-SVG, and Editor tests.
- Editor build and workspace typecheck.
- Focused Playwright drafting/editor test if the local browser runner is
  available; otherwise record it as blocked without claiming GUI inspection.
- `pnpm format:check`, `git diff --check`, and final `git status --short --branch`.

## Commit intent

One reviewable feature commit: `feat(text): unify rich-text editing surface`.
