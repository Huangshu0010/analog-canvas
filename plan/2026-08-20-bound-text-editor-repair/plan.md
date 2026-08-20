---
status: completed
experience: none
---

# Bound Text Editor Repair

## Goal

Make semantic instance, Net, and Cell-Port labels visibly and reliably editable
without treating their source names as rich text. Repair literal-text line-break
insertion and show overbars inside the canvas editing surface.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-text-binding...origin/codex/unified-text-binding
?? .pnpm-store/
?? .worktrees/
```

The two untracked directories are local package/worktree infrastructure and do
not overlap this target. This target owns the canvas text editor, its editor
styles, its focused browser coverage, and the factual plan records.

- `apps/editor/src/features/text-editing/rich-text-editor.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-20-bound-text-editor-repair/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only: model binding schema, edit-engine reference policy, and the shared
annotation resolver. They establish the semantic source contract; this target
must consume, not alter, that contract.

## Work

1. Reproduce the bound instance-label commit path and retain reference-policy
   rejection behavior.
2. Render a bound text session as an explicit single-line source-name input,
   with only presentation controls that remain meaningful; retain the rich-text
   editor for literal text.
3. Replace deprecated browser line-break insertion with deterministic Range
   insertion and add editing-surface overbar styling.
4. Add browser regression coverage for reference rename, literal line breaks,
   and editor overbar visibility.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "semantic|rich text|line break|overbar"`
- relevant editor unit/type checks if changed code exposes a static failure
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: semantic labels edit their source text without becoming literal
  RichText; literal text preserves explicit line breaks and exposes overbar in
  the editing surface.
- Primary checks: focused browser test in `manual-editor.spec.ts`.

## Commit Intent

Commit as:

```text
fix(text): make bound labels directly editable
```

## Outcome

Bound schematic labels now use a focused single-line source input that selects
its text on open and commits the existing semantic source edit. Literal text
retains the RichText editor; line breaks now use a deterministic Range update
and overbars are styled in the editing surface. Focused browser regression,
workspace typecheck, test-impact, and diff checks passed.
