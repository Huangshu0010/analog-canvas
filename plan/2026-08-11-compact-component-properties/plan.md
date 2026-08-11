---
status: completed
experience: none
---

# Compact Component Properties

## Goal

Apply the compact `I`-dialog language to the `Q` Component Properties panel:

- remove the duplicated Component overview position/rotation card;
- render `X`, `Y`, and `Rotate` in one compact layout row;
- render component parameters as inline symbol/unit/explanation labels;
- preserve all current edit keys, Apply/Cancel behavior, shortcut focus, and
  mirror actions.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/app/App.test.tsx`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/src/styles.css`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-11-compact-component-properties/plan.md`
- `plan/log.md`

The existing parameter descriptor catalogue is read-only; this target changes
only its property-panel presentation and no model, engine, or Agent contract.

## Work

1. Remove the instance overview's redundant position/rotation rows while
   retaining its concise identity and symbol information.
2. Introduce shared compact property-label markup for parameter fields and a
   three-control geometry row.
3. Add focused markup/E2E assertions for compact geometry and parameter labels.

## Validation

- Focused App and component insertion tests.
- Workspace typecheck, production editor build, `git diff --check`, and status
  review.

## Commit Intent

```text
refactor(editor): compact component properties
```

## Outcome

The Component identity card now contains only reference and symbol. Component
Properties exposes raw parameter fields with inline symbol/unit/explanation
labels, and one geometry row for `X`, `Y`, and `Rotate`; existing Apply/Cancel,
mirror, and `Q` focus behavior remain unchanged.

Focused App/descriptor/dialog tests (16), component insertion E2E (6),
workspace typecheck, production editor build, and `git diff --check` passed.
