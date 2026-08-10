# Razavi Default and Explicit Style Switch

## Goal

Make `razavi-textbook-v1` the visual default for newly created Documents and
give the editor an explicit per-Document style selector so an existing
monochrome Document can be upgraded deliberately.

## Dirty-State Decision

The only pre-existing untracked path is the unrelated
`plan/2026-08-08-flat-cdac-new-architecture-audit/`. It does not overlap this
target. The worktree otherwise permits a bounded change.

## Owned Files

- `plan/2026-08-08-razavi-default-and-style-switch/plan.md`
- `packages/model/src/factories.ts` and focused factory tests
- `packages/edit-engine/src/transaction.ts` and focused transaction tests
- `apps/editor/src/App.tsx` and focused editor tests if available

## Shared Dependencies

- `PresentationIntentSchema` remains the canonical persisted shape.
- `@icm/render-svg` owns style-profile rendering; this target only changes the
  persisted profile selected by a Document.

## Expected Work

1. Default new Documents to `razavi-textbook-v1`.
2. Add a typed, undoable `set_presentation_style` edit to the common edit
   engine.
3. Add an explicit `Style` command-menu selector in the editor. It changes the
   active Document only and does not silently migrate opened Projects.
4. Prove factory default and transaction persistence/undo behavior.

## Validation

- focused model and edit-engine tests
- typecheck, editor build, `git diff --check`

## Commit Intent

Leave changes uncommitted unless the worktree remains clean and the user asks
for a commit.

## Outcome

- New Documents now persist `razavi-textbook-v1` by default.
- The shared Edit Engine has a typed `set_presentation_style` edit, so style
  selection is revisioned and Undo restores the prior profile.
- The editor has an explicit `Style` command menu for the active Document;
  opening an existing monochrome Project does not change it until the user
  selects Razavi textbook.

## Validation Record

- Passed: focused model/edit-engine tests (9 tests), model and edit-engine
  package builds, editor production build, and `git diff --check`.
- Workspace `pnpm typecheck` and the recursive workspace build are currently
  blocked by a concurrent unrelated error in
  `packages/agent-adapter/src/service.ts:437` (missing return path).
