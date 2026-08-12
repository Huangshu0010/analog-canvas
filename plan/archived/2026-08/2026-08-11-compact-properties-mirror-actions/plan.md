---
status: completed
experience: none
---

# Compact Properties Mirror Actions

## Goal

Move the component mirror actions directly below X/Y/Rotate in Properties and
present both directions as one compact row without changing mirror behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
 M fixtures/visual-reference/razavi-reference-v1/closed-switch-vector-source.json
 M fixtures/visual-reference/razavi-reference-v1/ideal-switch-vector-source.json
 M fixtures/visual-reference/razavi-reference-v1/manifest.json
 M packages/symbols/assets/razavi-v1/catalog.json
 M packages/symbols/assets/razavi-v1/closed-switch.symbol.json
 M packages/symbols/assets/razavi-v1/ideal-switch.symbol.json
 M packages/symbols/src/razavi-catalog.generated.ts
 M tools/pdf-vector-extract/extract-razavi-common-assets.py
?? plan/2026-08-11-correct-switch-lead-contact-geometry/
```

The existing dirty files belong to the separate switch-symbol target and do not
overlap this editor-only target. They will remain untouched.

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/styles.css`
- `plan/2026-08-11-compact-properties-mirror-actions/plan.md`
- `plan/log.md`

## Work

1. Put left/right and top/bottom mirror actions in a single compact Properties
   row immediately below the geometry fields.
2. Retain explicit accessible labels and shortcut discoverability while using
   concise visible labels.

## Validation

- `pnpm --filter @icm/editor build`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
refactor(editor): compact properties mirror actions
```

## Outcome

Placed the two mirror actions immediately below X/Y/Rotate in a two-column
compact row. The visible controls use directional glyphs plus `Shift+R` and
`Shift+V`; their full directions remain available through accessible labels and
native tooltips. Production editor build and `git diff --check` passed. The
unrelated switch-symbol worktree changes remained untouched.
