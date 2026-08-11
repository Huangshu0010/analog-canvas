---
status: completed
experience: none
---

# Compact Insert-Control Layout

## Goal

Reduce visual weight in the `I` dialog without changing its placement contract:

- keep rotation and label controls on one compact row;
- use a bounded native rotation selector instead of four permanently visible
  rotation buttons;
- shorten annotation wording to `Label` and `Name`;
- render device parameter units and explanations inline after the parameter
  symbol, such as `W / m (Channel width)`.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns:

- `apps/editor/src/features/component-insert/component-parameters.ts`
- `apps/editor/src/features/component-insert/component-parameters.test.ts`
- `apps/editor/src/features/component-insert/insert-component-dialog.tsx`
- `apps/editor/src/features/component-insert/insert-component-dialog.test.tsx`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/src/styles.css`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-11-compact-insert-controls/plan.md`
- `plan/log.md`

Read-only dependencies are the interaction placement request, `App.tsx`, and
the model schema. This target does not change pending-placement data, edits, or
stored property keys.

## Work

1. Add optional physical-unit metadata to the frontend parameter descriptors.
2. Replace the four rotation buttons and separate annotation card with one
   compact placement-options row: a rotation selector, `Label` switch, and
   optional `Name` input.
3. Render unit plus explanatory text inline beside each device parameter name;
   keep the existing raw-string value semantics.
4. Refresh static and E2E coverage for the compact controls and ensure opening
   a selector does not resize the dialog or its preview column.

## Validation

- Focused descriptor/dialog tests and component insertion E2E.
- Editor production build, workspace typecheck, `git diff --check`, and status
  review.

## Commit Intent

```text
refactor(editor): compact component insertion controls
```

## Outcome

Implemented a compact placement-options row: the bounded native `Rotate`
selector, `Label` toggle, and optional `Name` input now share one line. The
permanent four-button rotation grid and verbose reference wording are removed.
Parameter descriptors now carry a physical-unit token, so the insert dialog
uses inline labels such as `W / m (Channel width)` while retaining raw
SPICE-style property strings and keys.

Focused descriptor/dialog tests, workspace typecheck, production editor build,
complete editor E2E (71), and `git diff --check` passed.
