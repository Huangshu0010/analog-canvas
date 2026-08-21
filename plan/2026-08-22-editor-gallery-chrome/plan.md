---
status: completed
experience: none
---

# Editor Chrome: Gallery Return Button and One Product Name

## Goal

Two user-reported chrome gaps after the gallery landing shipped: (1) the
editor offered no discoverable way back to the gallery (only the invisible
brand-mark link), and (2) the product carried two names — the gallery said
"Analog Canvas" while the editor header, help/about dialogs, page title,
and PWA manifest still said "(Interactive) Circuit Maker". Add an explicit
"← Gallery" button at the far left of the document toolbar and unify every
user-visible name to Analog Canvas.

## State and Ownership

Branched from `origin/main` (post PR #150/#151 flow) as
`claude/gallery-back-button`; worktree clean.

Owned paths:

- `apps/editor/src/app/App.tsx` (toolbar link, header name)
- `apps/editor/src/components/editor-help-dialog.tsx` and
  `editor-about-dialog.tsx` (name)
- `apps/editor/index.html`, `apps/editor/public/manifest.webmanifest`
  (title / PWA names)
- `apps/editor/src/styles.css` (toolbar link style)
- `apps/editor/e2e/gallery.spec.ts`
- `plan/2026-08-22-editor-gallery-chrome/plan.md`, `plan/log.md`

Shared dependencies: none beyond the chrome markup the gallery spec
exercises; ids, routes, and package names are untouched (display strings
only).

## Work

1. `← Gallery` link (styled as a toolbar control) before the Up/Top cell
   navigation; brand-mark link kept.
2. Rename the five user-visible "Circuit Maker" strings to Analog Canvas.
3. Extend the gallery spec: populated editor shows the button, clicking it
   returns to the feed, and the header reads Analog Canvas.

## Validation

- `playwright`: `apps/editor/e2e/gallery.spec.ts` (4 passed)
- unit: App and component suites (18 passed)
- repository typecheck, prettier
- `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: the editor always offers a visible one-click return to the
  gallery; the product presents one name everywhere
- Primary checks: `apps/editor/e2e/gallery.spec.ts`

## Commit Intent

Committed on `claude/gallery-back-button` under the user's standing
commit-push-merge direction as:

```text
feat(editor): gallery return button and one product name
```

## Outcome

Delivered: the document toolbar's far-left "← Gallery" control returns to
the landing feed in one click (verified by the extended gallery spec,
including the click-through), and every user-visible name — editor header,
help and about dialogs, page title, PWA manifest name/short name — now
reads Analog Canvas, matching the gallery and the README product identity.
Validation: gallery spec 4/4, App/component unit suites 18 passed,
typecheck, prettier, test-impact, diff checks green.
