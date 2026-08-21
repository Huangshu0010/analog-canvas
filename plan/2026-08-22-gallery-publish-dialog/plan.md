---
status: completed
experience: none
---

# In-Editor "Publish to Gallery" (Admin-Gated Bridge)

## Goal

Answer "how do I contribute to the gallery?" with a real in-app path
today. Until G2 sign-in ships, publishing stays admin-token-gated, but the
only flow was raw curl. Add File > "Publish to Gallery…": a dialog with
name (prefilled from the Project), optional author and description, and
the admin passphrase (session-remembered, cleared on a 401); it serializes
the live Project and posts it through the existing submissions endpoint,
mapping every outcome (published / wrong passphrase / daily limit /
too large / invalid) to a clear message. The same entry point later
switches to signed-in identity in G3 — visitors without the passphrase
see exactly the sign-in-pending story the footer already tells.

## State and Ownership

Branched from `claude/gallery-back-button` (PR #152 in its merge chain);
stacked so the File-menu region merges cleanly.

Owned paths:

- `apps/editor/src/features/editor-shell/gallery-publish.ts` (+ test) —
  pure publish client with an injectable fetch seam
- `apps/editor/src/features/editor-shell/publish-gallery-dialog.tsx`
  (+ test)
- `apps/editor/src/app/App.tsx` (File-menu action + dialog wiring)
- `apps/editor/e2e/gallery.spec.ts` (route-mocked publish scenario)
- `plan/2026-08-22-gallery-publish-dialog/plan.md`, `plan/log.md`

Shared dependencies: the submissions contract from
`docs/specs/community-gallery.md` (consumed as-is), the insert-dialog
styling, and the project-protocol serializer.

## Work

1. `publishProjectToGallery(project, fields, fetchLike)`: canonical
   serialization, bearer header, outcome mapping for 201/401/413/429/400.
2. Dialog: prefilled name, optional author/description, passphrase field
   (session-remembered), busy/error states, publish-notice copy.
3. App: File-menu button, success status plus passphrase retention,
   401 clears the stored passphrase.
4. Tests: client outcome mapping, dialog markup, one route-mocked
   Playwright scenario asserting the posted body and bearer header.

## Validation

- focused `vitest`: gallery-publish client and dialog tests
- `playwright`: `apps/editor/e2e/gallery.spec.ts`
- repository typecheck, prettier
- `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: the editor publishes the live Project through the documented
  submissions endpoint with the admin bearer; every rejection surfaces a
  specific message and a 401 forgets the stored passphrase; the dialog
  never publishes without a passphrase
- Primary checks:
  `apps/editor/src/features/editor-shell/gallery-publish.test.ts`,
  `apps/editor/e2e/gallery.spec.ts`

## Commit Intent

Committed on `claude/gallery-publish` under the user's standing
commit-push-merge direction as:

```text
feat(editor): in-editor publish to gallery
```

## Outcome

Delivered: File > "Publish to Gallery…" opens a dialog prefilled with the
Project name plus optional author/description and the owner passphrase;
publishing serializes the live Project canonically and posts it to
`/api/gallery` with the bearer, mapping 201/401/413/429/400 and network
failure to specific messages. The passphrase is remembered for the browser
session and forgotten on a 401. Roadmap G1 records the dialog as the
in-app publishing surface that G3 later switches to signed-in identity.
Validation: publish client + dialog unit tests (5), gallery Playwright
spec 5/5 (new scenario asserts the posted body, bearer header, and
session-remembered passphrase), repository typecheck, prettier,
test-impact, diff checks green.
