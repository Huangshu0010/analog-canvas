---
status: completed
experience: none
---

# Publish Dialog Facelift and Author Memory

## Goal

User feedback on the shipped publish dialog: it reused the insert
picker's master-detail shell (huge empty right panel, cramped inline
labels, a too-short name input) and the author had to be retyped every
time. Rebuild it as a modern single-column card — stacked labels,
full-width inputs, inline "optional" hints, a primary Publish action —
and prefill the author byline from the last successful publish
(localStorage) until G2 sign-in supplies the account name.

## State and Ownership

Branched from `origin/main` (post PR #154) as
`claude/publish-dialog-facelift`; merges cleanly over hotfix #156.

Owned paths:

- `apps/editor/src/features/editor-shell/publish-gallery-dialog.tsx`
  (+ test)
- `apps/editor/src/features/editor-shell/gallery-publish.ts` (+ test) —
  author memory helpers
- `apps/editor/src/styles.css` (dedicated dialog styles)
- `plan/2026-08-22-publish-dialog-facelift/plan.md`, `plan/log.md`

Shared dependencies: none; field labels and test ids are unchanged so the
existing Playwright publish scenario keeps passing as-is.

## Work

1. Standalone `.publish-gallery-dialog` card (no insert-dialog classes):
   30rem card, stacked full-width fields, focus rings, action row with a
   primary button.
2. `rememberedPublishAuthor`/`rememberPublishAuthor` (localStorage,
   guarded); saved on successful publish, prefilled on open.
3. Tests: author-memory round-trip; dialog markup asserts the new
   structure and the absence of the borrowed insert classes.

## Validation

- `vitest`: gallery-publish + dialog tests (6 passed)
- `playwright`: `apps/editor/e2e/gallery.spec.ts` (5 passed, unchanged)
- visual check in the running editor (screenshot)
- prettier, `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: the dialog is a single-column card with full-width fields;
  the author byline persists across publishes; labels/test ids unchanged
- Primary checks:
  `apps/editor/src/features/editor-shell/gallery-publish.test.ts`,
  `publish-gallery-dialog.test.tsx`

## Commit Intent

Committed on `claude/publish-dialog-facelift` under the user's standing
commit-push-merge direction as:

```text
feat(editor): modern publish dialog with author memory
```

## Outcome

Delivered: the publish dialog is now a centered single-column card with
full-width inputs (the name field spans the card), inline optional hints,
a primary Publish button, and an author byline that prefills from the
last successful publish. Unit suites and the unchanged gallery Playwright
spec are green; the running editor was visually verified.
