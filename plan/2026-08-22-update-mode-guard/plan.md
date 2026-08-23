---
status: completed
experience: none
---

# Hotfix: Retire the Stale Update Offer on Project Replacement

## Goal

User-reported data loss: with a gallery entry still "opened" from
earlier, publishing a NEW circuit silently defaulted to "update the
opened entry" and overwrote it in place (an Inverter replaced StrongArm
Comparator v2). Two fixes: the gallery-entry context now records the
opened Project's id and is cleared the moment any other Project becomes
active (new circuit, import, example open, …), so the update offer can
never target something the user is no longer editing; and the update
option names exactly what it replaces ("Update “<entry name>” (replaces
that entry)").

## State and Ownership

Branched from `origin/main` (post PR #182) as
`claude/update-mode-guard`.

Owned paths: `apps/editor/src/app/App.tsx`,
`apps/editor/src/features/editor-shell/publish-gallery-dialog.tsx`,
`apps/editor/e2e/gallery.spec.ts`,
`plan/2026-08-22-update-mode-guard/plan.md`, `plan/log.md`.

## Validation

- `playwright`: gallery spec — the update offer is present while the
  entry is active, disappears after importing a different Project, and
  the option label carries the target entry's name
- dialog unit suite, repository typecheck, prettier,
  `node scripts/check-test-impact.mjs --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: the update offer exists only while the opened entry is the
  active Project, and always names its target
- Primary checks: `apps/editor/e2e/gallery.spec.ts`

## Commit Intent

Committed on `claude/update-mode-guard` under the user's standing
commit-push-merge direction as:

```text
fix(editor): retire the stale gallery update offer
```

## Outcome

Delivered: the context carries the opened Project id and an effect
clears it whenever another Project becomes active; the update radio
names its target. Gallery Playwright 20/20 (new scenario: offer present
→ import another Project → offer gone), dialog units 26, typecheck,
prettier, test-impact, diff checks green. The overwritten entry's
content is unrecoverable server-side; the user can republish it from a
local copy.
