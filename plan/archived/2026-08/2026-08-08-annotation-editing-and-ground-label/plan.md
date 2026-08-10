# Annotation Editing, Hit Testing, and Ground Label Source Contract

## Goal

Make annotation editing genuinely usable: all human-editable annotation kinds
must persist and render a font scale in both style profiles; their full visual
text extent must be selectable above device interactions; and Ground must hide
its default instance name from the source-derived symbol contract.

## Dirty-State Decision

The editor, model, renderer, symbols, generated catalog, and tests are
already dirty from concurrent work. The user explicitly requested this repair
after the incomplete behavior was observed. Existing changes add a partial
`sizeScale`, fixed-radius annotation hit circle, and a generated-only Ground
label flag. This target owns their completion but will preserve unrelated
route, current-arrow, junction-role, and text changes. `plan/log.md` remains
read-only because it is concurrently dirty.

## Owned Files

- `plan/2026-08-08-annotation-editing-and-ground-label/plan.md`
- `apps/editor/src/App.tsx`, annotation-focused tests, and styles if needed
- `packages/model/src/schema.ts` only if the existing annotation contract needs
  an adjustment
- `packages/render-svg/src/{render,schematic-text}.ts` and focused tests
- `scripts/generate-visio-core-analog-assets.mjs`
- Ground source asset, catalog/runtime adapter, and focused catalog tests

## Expected Work

1. Apply an annotation's persisted `sizeScale` consistently in both profiles
   and every annotation rendering branch that has visible text.
2. Make the text panel support a stable draft value and commit scale through
   blur/Enter without requiring a text-content change.
3. Replace the fixed annotation hit circle with a visual text/arrow bounding
   box above instance hit targets.
4. Add Ground `labelVisibility: hidden` to the source generator, regenerate
   the catalog, and correct the false-positive render test.

## Validation

- focused renderer/catalog/editor tests for Mono and Razavi size scaling,
  Ground no-label output, and annotation hit bounds
- source generator/check and catalog check
- typecheck, focused build, formatting, `git diff --check`

## Commit Intent

The `sizeScale` annotation contract, the `schematicTextSizeAttribute` scale
parameter, and the renderer branches that apply it were already committed as
part of the 2026-08-08 worktree-split sequence (absorbed into the
`a6eeccf` / `64eefa1` / `baffb44` fix commits), and the Ground
`labelVisibility: hidden` source asset/catalog landed in the group-1 visio
core-analog migration (`7a38734`). This plan now lands the remaining editor
layer: the Text-panel size-scale draft/commit, the padded visual text/arrow
hit bounds, and the focused render tests. It is committed together with the
route-attached-current-arrow and editor-text-label-hit-fixes editor-layer
remnants because all three share the same `App.tsx` working set.

## Outcome

- `sizeScale` now reaches every visible annotation-text renderer branch. An
  explicitly scaled annotation receives a font-size in both style profiles;
  unscaled textbook output remains byte-stable.
- The Text panel keeps its numeric draft as text, exposes it for every
  annotation kind, and commits a scale on blur or Enter without changing the
  annotation content.
- Annotation interaction uses padded visual text/arrow rectangles above
  instance hit targets instead of a fixed-radius circle.
- Ground's hidden default instance label is declared by the Visio-core source
  generator and regenerated through the catalog adapter.

## Validation Record

- Passed: focused current-arrow, annotation scale, and Ground-label renderer
  tests; Razavi catalog tests; `pnpm symbols:visio-core-analog:check`; `pnpm
  symbols:razavi:check`; `pnpm typecheck`; `pnpm build`; and `git diff --check`.
- The unfiltered renderer test file retains one pre-existing golden mismatch:
  `phase-1-manual.svg` expects the old hand-drawn resistor geometry while the
  shared worktree contains the newer Visio-derived resistor catalog asset. It
  is outside this target and was not regenerated here.
