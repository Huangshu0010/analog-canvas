---
status: completed
experience: none
---

# Unified Group And Routed-Marker Move

## Goal

Unify canvas move ownership so a selected circuit group moves as one even when
the pointer starts on an internal wire, make current-arrow annotations directly
draggable while remaining attached to their route, use the common dashed
selection treatment, and remove the redundant View menu. Bring the feature
branch onto the current mainline Snap Engine before changing behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-component-dialog...origin/codex/insert-component-dialog
```

The worktree is clean. The branch was forked at `d649c18`; current
`origin/main` is `d413aec` and contains Snap Engine commit `80c1664` plus the
editor source-domain reorganization. The target therefore owns integration of
main before implementation; conflict resolution must preserve both the insert
dialog target and mainline snap behavior.

- `apps/editor/src/**`
- focused editor unit/E2E tests under `apps/editor/`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-10-unified-group-marker-move/plan.md`
- `plan/log.md`

Shared dependencies:

- `packages/edit-engine/` transaction and route contracts are read-only unless
  evidence proves a shared-contract defect; this target should reuse existing
  typed edits rather than add another move protocol.
- `packages/model/` annotation attachment schema is read-only unless current
  bounds make direct constrained drag impossible.
- `origin/main` is the authority for Snap Engine and the reorganized source
  layout.

## Work

1. Merge current `origin/main` and resolve integration without duplicating the
   snap or movement contract.
2. Reproduce the selected-group/internal-wire drag conflict and routed-marker
   drag failures with focused tests.
3. Give an existing selected group drag precedence over internal route-segment
   editing, resolving one snapped delta and committing the group through the
   existing transaction path.
4. Let a routed current marker drag along its route and within a bounded normal
   offset, retaining the attachment and using the standard dashed selection
   rectangle; remove movement buttons made redundant by direct manipulation.
5. Remove the redundant View menu while retaining fit/zoom controls in their
   existing canvas location.
6. Validate focused behavior, the editor build/type surface, and the real GUI.

## Validation

- focused Vitest tests for selection/group move, routed-marker projection, and
  command-surface expectations
- focused Playwright drag tests, followed by the editor E2E suite when stable
- `pnpm typecheck`
- `pnpm --filter @icm/editor build`
- browser inspection on the isolated feature-branch server
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(editor): unify group and routed marker movement
```

## Outcome

Merged current mainline (`d413aec`) into the feature branch, including Snap
Engine and the organized editor source tree. Composite selection now owns
pointer-down on its internal/explicitly selected routes and junctions, so one
Snap Engine delta previews and commits the component group plus its internal
wiring. Route-marker drag now projects the desired label point into an existing
route attachment, preserves route identity/direction, bounds the normal offset,
and renders live before the single transaction commit. Current markers use the
same dashed selection rectangle as other text/components, duplicate offset
buttons and the View menu were removed, and the interaction specification was
updated without changing model or Edit Engine protocols.

Validation passed: 5 focused route-interaction tests, full repository typecheck,
editor production build, 447/447 Vitest tests, 62/62 Playwright tests plus the
enhanced live-preview focused flows, full format check, `git diff --check`, and
in-app browser inspection at the isolated feature-branch URL. The first full
Vitest run had one exporter timeout; its isolated rerun and the subsequent full
447-test run passed.
