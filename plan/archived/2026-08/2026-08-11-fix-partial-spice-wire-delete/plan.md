---
status: completed
experience: none
---

# Fix partial SPICE wire deletion

## Goal

Allow a visible Wire to be deleted when its imported SPICE Net already has
flightlines, without guessing at or silently changing unresolved SPICE
connectivity.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns:

- `packages/edit-engine/src/transaction.ts`
- focused Edit Engine routing tests
- `apps/editor/src/app/App.tsx`
- focused manual-editor Playwright tests
- routing and Edit Engine specifications
- this plan and `plan/log.md`

The persisted Net/Route/Junction schema is read-only. The existing
`cut_connection` payload does not change, so Agent schema artifacts are not
expected to change.

During validation, the unrelated untracked
`plan/2026-08-11-razavi-common-symbols/` target appeared from another worker.
It does not overlap this target's owned files or shared edit contract and is
excluded from staging and commit.

## Work

1. Make `cut_connection` always remove the selected visible Route.
2. Partition a fully routed local Net only when the resulting electrical split
   is deterministic; preserve logical membership for already-partial and
   global Nets so flightlines reappear as routing guidance.
3. Rename the GUI action/status to neutral `Delete wire` wording and add an
   imported-partial-Net browser regression.
4. Update the normative routing/edit-engine specifications.

## Validation

- Focused Edit Engine tests for partial imported and global Net deletion.
- Focused Playwright flows for ordinary and imported-partial Wire deletion.
- Repository typecheck and editor production build.
- `git diff --check` and `git status --short --branch`.

## Commit Intent

Commit as:

```text
fix(editor): allow deleting routed parts of imported nets
```

## Outcome

`cut_connection` now always removes the selected visible Route. A fully routed
local Net is still partitioned when its split is deterministic, while an
already-partial/imported Net or global Net retains logical membership and
regenerates flightlines. The GUI action and status now use neutral `Delete
wire` wording instead of claiming every deletion changes electrical topology.

Validation passed: 22 focused Edit Engine routing tests, two focused
manual-editor Playwright flows including a SPICE-bound partial Net, repository
typecheck, Edit Engine and editor builds, and `git diff --check`. The existing
editor large-chunk warning remains.
