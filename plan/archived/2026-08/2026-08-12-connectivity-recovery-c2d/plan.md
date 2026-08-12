---
status: completed
experience: none
---

# Edit No Connect declarations from endpoint actions

## Goal

Close the human editing loop for No Connect declarations through the existing
Endpoint shelf: a selected unconnected terminal or port can be marked, and an
existing mark can be cleared without a second selection protocol.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns the editor action which consumes the
already committed typed edit engine and formal rendering. It does not add a
new glyph hit target, keyboard shortcut, or a special No Connect selection
kind.

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c2d/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/model` NoConnect schema and invariants
- `packages/edit-engine` `add_no_connect` / `remove_no_connect` edits
- `packages/render-svg` formal marker layer

## Work

1. Derive the currently selected terminal/port declaration from its canonical
   endpoint key.
2. Add mark/clear actions to the Endpoint shelf, blocking creation when the
   endpoint is already electrically connected.
3. Generate a document-unique editor NoConnect id and add an end-to-end
   regression covering mark, formal glyph, and clear.

## Validation

- `corepack pnpm typecheck`
- focused Playwright NoConnect flow
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(editor): edit NoConnect declarations from endpoints
```

## Outcome

The Endpoint shelf now creates and removes No Connect declarations through the
existing typed edit transaction boundary. It refuses to mark a Net-connected
endpoint, creates ids that avoid all current document object ids, and is
covered by a browser flow that verifies the shared formal glyph appears and
disappears. Workspace typecheck and focused Playwright passed.
