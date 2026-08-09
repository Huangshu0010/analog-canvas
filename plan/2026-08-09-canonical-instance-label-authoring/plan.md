# Canonical instance-label authoring

## Goal

Stop newly placed visible components, including voltage sources, from entering
the renderer-only default-label path. Each receives a standard attached
`instance-label` in the same placement transaction so it is immediately
editable through the canvas RichText editor.

## Dirty-State Note

The tracked worktree is clean. Existing untracked circuit exports, archived
plans, and a local probe do not overlap this editor target and remain
untouched.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/App.test.tsx`
- `plan/2026-08-09-canonical-instance-label-authoring/plan.md`
- `plan/log.md`

## Read-Only Files

- `packages/render-svg/src/render.ts`
- `packages/model/src/schema.ts`
- `packages/spice/src/importer.ts`

## Shared Dependencies

- An explicit `instance-label` suppresses the renderer's legacy default ID.
- Existing Projects without labels remain readable through the legacy fallback
  and are materialized on first direct label interaction.

## Expected Work

1. Extract one placement-time label factory shared with default-label geometry.
2. Add a visible component's attached label to the same typed transaction as
   `add_instance`; hidden-label symbols remain excluded.
3. Cover voltage-source placement and retain legacy read compatibility.

## Outcome

- `placeNewComponent()` now builds a visible component's `instance-label` from
  the same canonical placement geometry and commits it beside `add_instance`.
  This includes `voltage-source` and other sources.
- Hidden-label power symbols remain excluded; their purpose-specific power
  annotation behavior is unchanged.
- The formal renderer's default-label branch remains only as a read-compatibility
  fallback for historical Projects. It is no longer an authoring output path.

## Validation

- Focused editor tests.
- `pnpm typecheck`
- `pnpm -C apps/editor build`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
fix(editor): create canonical labels with placed components
```
