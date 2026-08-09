# Cadence-Style Shortcut Core

## Goal

Complete the release-facing core shortcut layer without adding shortcuts for
properties, hierarchy navigation, or either port-placement variant. Add direct
single-key undo/redo and two unambiguous screen-space flip actions while moving
Fit from `F` to `Home` so the keyboard contract remains compact and compatible
with browser-reserved shortcuts.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## codex/optimize-iteration...origin/codex/optimize-iteration [ahead 2]
 M apps/editor/src/App.tsx
 M apps/editor/src/styles.css
 M packages/derived/src/drafting-geometry.test.ts
 M packages/derived/src/drafting-geometry.ts
 M packages/model/src/drafting-geometry-schema.ts
 M packages/model/src/schema.ts
 M packages/render-svg/src/drafting-render.test.ts
 M packages/render-svg/src/render.ts
 M plan/log.md
?? apps/editor/src/selection-geometry.test.ts
?? apps/editor/src/selection-geometry.ts
?? plan/2026-08-09-drafting-midpoint-inspector/
?? plan/2026-08-09-precise-selection-interaction/
```

The existing dirty editor/model/render work belongs to the preceding drafting
and precise-selection targets. This target changes only the isolated command
handler and command-menu sections of `App.tsx`, preserving all other hunks.
It does not edit shared model or renderer contracts. The user authorized this
new bounded target after the parallel work completed.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/shortcut-orientation.ts`
- `apps/editor/src/shortcut-orientation.test.ts`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-09-cadence-shortcut-core/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/model/src/schema.ts`
- `packages/model/src/geometry.ts`
- `packages/edit-engine/src/transaction.ts`
- `packages/symbols/`

## Shared Dependencies

- The canonical orientation transform is `rotate(mirror(local))`.
- `rotate_instance` and `mirror_instance` are existing typed, atomic edit
  kinds. The UI must compose them rather than introduce a new protocol kind.
- The editor interaction contract is the user-visible shortcut source of truth.

## Expected Work

1. Add a tested pure orientation helper that maps an existing placement to a
   screen-space left/right or top/bottom reflection using the existing rotation
   and `mirror: "x"` representation.
2. Bind `F` to flip horizontal (left/right), `Shift+F` to flip vertical
   (top/bottom), and `Home` to Fit. Keep `R`/`Shift+R`, `W`, and browser
   Ctrl-based history aliases unchanged.
3. Bind `U` to undo and `Shift+U` to redo without intercepting keys in text or
   other editable controls. Retain `Ctrl+Z`, `Ctrl+Y`, and `Ctrl+Shift+Z`.
4. Make the Edit and View menus plus the shortcut reference match the actual
   behavior. Explicit labels avoid the ambiguous phrase “horizontal mirror”.

## Validation

- Focused orientation-helper unit tests, including all eight canonical
  orientation states and transform-equivalence checks.
- Editor TypeScript/typecheck target and the focused editor tests relevant to
  keyboard handling, if present.
- `pnpm format:check` for the edited files/workspace formatting contract.
- `git diff --check` and `git status --short --branch`.

The transform test is required because a visually plausible flip is wrong for
already-rotated or mirrored devices; it proves the new UI action preserves the
canonical geometry algebra without changing the shared schema.

## Experience Signal (for human review)

The existing one-axis persisted representation plus rotation can express both
screen-space reflections. This target records that fact in code and tests; it
does not propose an experience note.

## Commit Intent

Commit as:

```text
feat(editor): add compact Cadence-style shortcut core
```
