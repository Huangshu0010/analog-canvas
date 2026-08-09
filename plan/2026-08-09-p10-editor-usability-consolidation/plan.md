# P10 — Editor usability and peripheral-tool consolidation

## Goal

Make the human editor operate as a focused schematic workspace rather than a
debug console: a Visio-like left library/tool dock, contextual properties,
reliable selection and deletion, an unambiguous canvas-zoom policy, and
complete create/select/move/delete behavior for production drawing objects.

## Dirty-state decision

The worktree contains pre-existing circuit-generation artifacts under
`netlists/rlc-rf-bandpass-100mhz/`, several unrelated plans, `probe-conflicts.mjs`,
and an edited shared `plan/log.md`. They belong to earlier concurrent work and
do not overlap this target's implementation paths. This target will not alter
them. In particular it will not append to `plan/log.md` until its current
owner has landed or explicitly handed over the existing edit; the close-out
record will remain in this target plan if that is still unresolved.

## Ownership

### Owned

- `apps/editor/src/App.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/src/App.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/drafting-render.test.ts`
- `docs/specs/editor-interaction.md`
- `docs/roadmap/text-annotation-peripheral-editing-plan.md`
- this plan

### Read-only dependencies

- `packages/model/` drafting schema and migrations
- `packages/derived/` drafting geometry and anchors
- `packages/edit-engine/` transaction semantics
- `apps/editor/src/delete-selection.ts`
- Razavi style profile and visual reference fixtures

The generic drafting `anchor` present on arrows and construction lines is a
known model-contract defect. This target makes all editor operations update
the geometry actually consumed by renderer/derived code. A schema-splitting
migration is deliberately a follow-up shared-contract target, not an
unreviewed add-on to the GUI rewrite.

## Work

1. Replace the persistent debug-oriented left Project inspector with a
   collapsible left Library/Tools dock; put Component families and production
   drawing tools there. Keep the right panel contextual and move diagnostics to
   a folded details surface.
2. Remove demo commands and floating-symbol creation from production command
   surfaces. Existing floating-symbol documents remain readable/renderable.
3. Make drawing-object selection and manipulation consistent: text,
   construction lines, and free arrows can be selected, moved and deleted;
   arrows/construction lines move their rendered geometry, not their unused
   base anchor.
4. Expand marquee selection/deletion to include route geometry, junctions,
   annotations, and drafting objects alongside placed instances. Preserve
   electrical delete semantics and use one transaction for a mixed deletion.
5. Make canvas wheel zoom opt-in by canvas ownership without stealing
   Ctrl/Command+wheel from the browser. Update shortcut/help text.
6. Make free-arrow heads consume Razavi style-profile dimensions so they align
   with route-current-arrow visual language.
7. Update the normative interaction and drafting-roadmap wording to match the
   shipped production surface.

## Validation

- Focused editor unit tests, including selection/deletion and current arrows.
- Render-SVG drafting tests.
- Editor typecheck and formatter check.
- Playwright/manual smoke assertions for library dock, marquee/delete, and
  canvas wheel policy where stable in the harness.
- `git diff --check` and final status review.

## Commit intent

One focused commit: `feat(editor): consolidate library and drafting interaction`.

## Completion record

Implementation is complete pending the shared `plan/log.md` hand-off. Focused
editor/render tests passed (18 tests), workspace typecheck passed, the editor
production build passed, and focused Playwright checks passed for the left
symbol dock, manual authoring, and route movement/deletion.

On 2026-08-09, a concurrent visual-authority target temporarily changed the
shared `packages/symbols/src/razavi-catalog.ts` contract from
`source/generation` to `visualAuthority` without regenerating
`razavi-catalog.generated.ts`. Runtime module initialization currently throws
when it reads `entry.visualAuthority.kind`; a fresh GUI is blank. The related
dirty files (`packages/symbols/src/razavi-catalog.ts`,
`packages/symbols/assets/razavi-v1/catalog.json`, and
`scripts/generate-razavi-symbol-catalog.mjs`) are outside this target's owned
set. Per the dirty shared-contract rule, implementation and browser/E2E
validation were paused pending coordination or a coherent upstream landing.
The matching generated catalog subsequently landed; the shared runtime became
coherent again and P10 implementation resumed. Follow-up user feedback was
implemented: duplicate header tool entry points were removed; the dock is now
named `Symbols & Tools`, has independent scrolling, and has both whole-dock
and category collapse; the contextual Properties dock is absent without a
selection and can be collapsed explicitly.
