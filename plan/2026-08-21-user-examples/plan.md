---
status: completed
experience: none
---

# User-Saved Library Examples

## Goal

One-click "Save as Example": snapshot the current Project into an
origin-local, non-authoritative IndexedDB store and list it in a new
"My examples" section of the Examples panel, with open, export
(`.icproj.json` download), and delete per entry. Bundled examples stay the
curated read-only set; user examples are convenience copies stored as
canonical serialized Project text and re-validated through the ordinary
protocol boundary on open (rolling-window upgrades apply). No shared
contract changes.

## State and Ownership

Branched from `claude/document-style-overrides` (PR #146 queued: CI-then-
merge). Worktree clean.

Owned paths:

- `apps/editor/src/document/user-examples-store.ts` (new) and test —
  IndexedDB adapter mirroring the recovery store's seams/failure taxonomy,
  scoped to its own database; never touches recovery records
- `apps/editor/src/features/editor-shell/examples-panel.tsx` and test —
  "My examples" section
- `apps/editor/src/app/App.tsx` — File-menu "Save as Example", panel wiring,
  open/export/delete handlers (open reuses the dirty-replacement guard)
- `docs/specs/persistence-and-recovery.md` — one non-authoritative-store
  sentence
- `apps/editor/e2e/manual-editor.spec.ts` — one browser scenario
- `plan/2026-08-21-user-examples/plan.md`, `plan/log.md`

Shared dependencies: the project-protocol parse/serialize boundary (used
as-is), the Examples panel markup contract, and the recovery store's
non-authoritative persistence philosophy (reused, not modified).

## Work

1. `user-examples-store.ts`: `list` (id, name, savedAt, schemaVersion),
   `save` (canonical `serializeProject` text, byte-capped), `read`
   (re-parse through the protocol), `remove`; injectable IDB factory seam.
2. Panel: "My examples" cards with open plus per-card Export and Delete
   actions; bundled section unchanged.
3. App: File menu action, list refresh on save/delete/panel open, export
   downloads the stored text under the example's name.
4. Spec sentence, unit tests (fake-indexeddb), panel markup test, one
   Playwright scenario (save, reopen, delete).

## Validation

- focused `vitest`: `apps/editor/src/document/user-examples-store.test.ts`,
  `apps/editor/src/features/editor-shell/examples-panel.test.ts`
- `playwright` scenario in `manual-editor.spec.ts`
- repository typecheck, prettier, markdown links
- `node scripts/check-test-impact.mjs --base <branch-base>`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: user examples persist as canonical Project text in their own
  origin-local store and never alter recovery records; open re-validates
  through the protocol boundary; save/list/delete outcomes surface storage
  failures instead of throwing; the panel lists bundled and user examples
  distinctly
- Primary checks: `apps/editor/src/document/user-examples-store.test.ts`,
  `apps/editor/src/features/editor-shell/examples-panel.test.ts`,
  `apps/editor/e2e/manual-editor.spec.ts`

## Commit Intent

Committed on `claude/user-examples` under the user's standing
commit-push-merge direction as:

```text
feat(editor): user-saved library examples
```

## Outcome

Delivered. `user-examples-store` persists canonical serialized Project
snapshots in its own origin-local IndexedDB database (recovery-style seams
and failure taxonomy, 8 MiB cap, decode-tolerant list, protocol re-parse on
read so rolling-window upgrades apply); the Examples panel gains a
"My examples" section with open, export (`.icproj.json` under the example's
name), and delete; File > "Save as Example" snapshots the live Project and
reveals the panel; opening a snapshot passes through the existing
dirty-replacement guard. The persistence spec now classifies user examples
alongside recovery as non-authoritative origin-local data (and two missed
schema-version sentences from the schema-21 sweep were corrected).
Validation: 5 store contracts on fake-indexeddb (round-trip, ordering,
delete, previous-schema upgrade on read, oversize rejection, no-IndexedDB
failure), panel markup contracts, one Playwright scenario (save, reopen,
delete), full unit suite 173 files / 1064 tests, typecheck, prettier,
markdown links, test-impact, and diff checks green.
