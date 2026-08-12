---
status: active
experience: none
---

# Agent Contract Hardening

## Goal

Make browser Agent authoring recoverable and deterministic without introducing a
second circuit engine: one session lifecycle, one wire-authoring planner, one
contact/connectivity read model, and one diagnostic evidence path must serve the
GUI, Agent API, renderer, and validation surfaces.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-contract-hardening...origin/main
```

The dedicated worktree was clean and branched from `origin/main` at `8b7d4c2`.
The original worktree contains an unrelated untracked plan and remains
untouched.

During implementation `origin/main` advanced by five documentation-only plan
lifecycle commits. They did not overlap the owned product/API files. The branch
was cleanly rebased onto `62141a8` before final validation; this target's active
plan remains intentionally present under the current plan-retention policy.

Owned paths:

- `apps/editor/src/agent/**`
- `apps/editor/src/features/wiring/**`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/web-agent-session.spec.ts`
- `packages/agent-adapter/**`
- `packages/derived/src/**` where required for canonical contact/diagnostics
- `packages/edit-engine/src/**` where required for the shared wire planner
- `packages/render-svg/src/**` where required for contact-aware junction dots
- `worker/agent-session*`
- `docs/adr/0016-browser-authoritative-agent-session.md`
- `docs/specs/agent-api.md`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/web-agent-session.md`
- `docs/agent/**` where required for the canonical workflow
- this plan and `plan/log.md`

Shared dependencies:

- `packages/model` persisted schema remains unchanged unless evidence proves it
  is unavoidable; contact nodes are derived, not persisted.
- `EditorDocumentController`/`DocumentHistory` remains the only browser commit
  path.
- Existing primitive schematic edits remain compatible; ordinary Agent wiring
  is added through the same planner used by GUI Wire.
- Project replacement remains terminal and no rejected/unknown transaction is
  automatically replayed.

## Work

1. Characterize the current session, bootstrap, wire, contact, junction-render,
   and diagnostic contracts with focused tests.
2. Introduce one derived coincident-contact model and consume it from visible
   connectivity, junction rendering, and wire-through diagnostics instead of
   reconstructing contact independently.
3. Expose one high-level Agent wire intent backed by the existing Edit Engine
   planner; preserve primitive edits as advanced operations.
4. Return authoritative project/document bootstrap metadata and proposed visual
   evidence through the API so Agents do not guess IDs or learn warnings only
   after render.
5. Separate authorization and transport lifecycle, add bounded same-page
   reconnect/manual recovery, heartbeat/close evidence, and relay socket
   replacement without automatic request replay.
6. Align the Connect Agent surface with the editor dialog system and expose
   useful offline/reconnect actions instead of treating Revoke as recovery.
7. Update the accepted contracts/ADR and close with focused tests followed by
   the cross-package gate justified by the shared API and routing changes.

## Validation

- Focused Vitest suites for `@icm/derived`, `@icm/edit-engine`,
  `@icm/render-svg`, and `@icm/agent-adapter`
- `worker/agent-session.test.ts`
- focused Playwright Web Agent session and wire-authoring tests
- `pnpm typecheck`
- `pnpm agent:artifacts:check`
- `pnpm references:check`
- `pnpm ci:check` before delivery because the target crosses shared domain,
  browser, worker, render, and generated API contracts
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Land as a reviewable series on `codex/agent-contract-hardening`, organized by
contract boundary, ending with:

```text
feat(agent): harden session and authoring contracts
```

## Outcome

Pending implementation and validation.
