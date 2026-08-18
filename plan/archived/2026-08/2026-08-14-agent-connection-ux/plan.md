---
status: completed
experience: none
---

# Agent Connection Reliability and Lightweight UX

## Goal

Make browser Agent connection creation, claim recovery, refresh recovery,
transport reconnect, and replacement intuitive and durable without expanding
circuit-editing capability or introducing a second state machine. Move the
always-relevant Agent state into the existing Properties dock and reduce the
Connect Agent dialog to authorization and hand-off.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-connection-ux...origin/main
```

The worktree is clean and this branch begins at current `origin/main`
(`dd5dfde`). This target owns the Agent session lifecycle and its UI only; it
does not change circuit transactions, file-resource semantics, Project model,
or human/Agent visual feedback.

- `packages/agent-adapter/src/session-state.ts`
- `packages/agent-adapter/src/envelope.ts`
- `worker/agent-session.ts`
- `apps/editor/src/agent/use-agent-session.ts`
- `apps/editor/src/agent/session-recovery.ts`
- `apps/editor/src/agent/connect-agent-panel.tsx`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/styles.css`
- focused Agent session, component, and browser tests
- current Agent API/session documentation and generated artifacts only if the
  public contract changes

Read-only/shared dependencies:

- `packages/edit-engine`, `apps/editor/src/document`, and existing Agent file
  resource/semantic-control hosts
- `docs/specs/agent-api.md`, `docs/specs/web-agent-session.md`, and ADR 0018
- generated OpenAPI/schema artifacts

## Work

1. Make claim/session expiry and reconnect behavior reliable: longer bounded
   lifetimes, repeatable claim redemption which replaces the previous token,
   common scope validation for same-Project recovery, and low-frequency retry
   after the initial reconnect burst.
2. Keep state simple but distinguish the facts the UI needs: claim expiry,
   session expiry, transport availability, last chosen scope, and a terminal
   reason sufficient to provide the correct action.
3. Replace technical authorization chrome with human-readable presets,
   separate claim/session time remaining, copy success feedback, and clear
   Hide/Retry relay/New connection/Disconnect wording.
4. Add a compact Agent section to the existing Properties dock. It must be
   visible while connected or recoverable but not implement change highlighting,
   timeline, inspect, or undo affordances.
5. Add only focused session/component/browser coverage and run the final branch
   gate once after all changes.

## Validation

- focused session-state, session recovery, panel, and web-Agent Playwright tests
- generated Agent API artifact validation if schema/OpenAPI changes
- `git diff --check`
- `git status --short --branch`
- one final `pnpm verify:branch`; run `pnpm ci:check` only once immediately
  before mainline delivery, per repository policy

## Commit Intent

Commit as:

```text
feat(agent): simplify resilient browser connection lifecycle
```

## Outcome

Implemented the one-token replacement claim contract, 30-minute Claim and
eight-hour Session defaults, shared scope validation for same-Project recovery,
and persistent 30-second relay retry after the short backoff sequence. The
authorization dialog is now a human-readable hand-off surface; active session
controls live in the Properties dock. No circuit-edit, file-resource, Agent
timeline, highlight, Inspect, or undo capability was added. Final review kept
the published error enum compatible, retained the valid claim hand-off after
first redemption, removed unused audit state, and restored shared approval
dialog styles. Focused checks and the required final `pnpm ci:check` passed.
