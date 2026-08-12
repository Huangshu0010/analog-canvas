---
status: completed
experience: none
---

# WP-WA5 — Connect Agent UI

## Goal

Add the browser-side authorization surface: a Connect Agent command and panel
with permission presets, the one-time claim code, connection status, pause/revoke
controls, and a recent-operation audit — all driven by the session state machine,
with no secret reaching analytics or recovery.

## State and Ownership

Start state: clean `codex/web-agent-session-architecture` after WP-WA4 (`c4570a4`).

Architectural fix made in this target: the session state machine was moved from
`worker/agent-session-state.ts` to `packages/agent-adapter/src/session-state.ts`
because both the worker relay and the editor UI need it; the deep cross-boundary
relative import was wrong. The worker now value-imports it from
`@icm/agent-adapter`, so the root `package.json` declares that workspace
dependency (the worker is root-owned code).

Owned paths:

- `apps/editor/src/agent/connect-agent-panel.tsx` + test (new)
- `apps/editor/src/agent/use-agent-session.ts` (new)
- `apps/editor/src/app/App.tsx` (Agent command menu + panel mount + state/hook)
- `apps/editor/src/app/App.test.tsx` (updated obsolete "Agent" assertion)
- `apps/editor/src/styles.css` (`.agent-panel` styles)
- `packages/agent-adapter/src/session-state.ts` + test (moved from `worker/`)
- `packages/agent-adapter/src/index.ts`, `browser-safety.test.ts` (export + static check)
- `worker/agent-session.ts`, `worker/agent-session.test.ts` (import from package)
- `package.json` (root `@icm/agent-adapter` dep), `pnpm-lock.yaml`
- `plan/2026-08-12-web-agent-session-wa5/plan.md`, one `plan/log.md` entry

Read-only / shared: WP-WA3 `BrowserAgentHost`, WP-WA4 state machine, the
frozen transport contract.

## Work

1. Move the session state machine into `@icm/agent-adapter` (browser-safe,
   shared) and re-export it; update the worker and browser-safety suite.
2. `connect-agent-panel.tsx`: presentational component (permission presets,
   claim code, status, pause/resume/revoke, audit) that holds no secret beyond
   the live claim code passed via props.
3. `use-agent-session.ts`: React binding over the state machine exposing the
   panel view-model and grant/pause/resume/revoke controls.
4. `App.tsx`: an "Agent" command menu opening the panel; panel mounted with the
   hook state; closing revokes and dismisses.
5. `.agent-panel` CSS; updated the obsolete App assertion to "panel not rendered
   by default" while accepting the new command.

## Validation

- `git diff --check`, `git status --short --branch`
- `corepack pnpm exec vitest run packages/agent-adapter worker apps/editor/src/agent apps/editor/src/app/App.test.tsx`
- `corepack pnpm typecheck`
- Prettier on changed files; lockfile re-resolved

Rationale: the change adds a UI feature plus a shared-package refactor; the
panel markup tests, the agent-host/state-machine suites, the App shell tests, and
workspace typecheck are the smallest deterministic cover. Interactive Playwright
grant-to-revoke flows and the real network relay transport require a deployed
review environment (WP-WA7).

## Commit Intent

```text
feat(editor): Connect Agent authorization panel (WP-WA5)
```

## Outcome

Added the Connect Agent panel (permission presets Review/Layout Edit/Full Circuit
Edit, one-time claim code, status, pause/resume/revoke, bounded audit) and its
React hook over the session state machine, mounted behind an "Agent" command in
`App.tsx`, with `.agent-panel` styles. The panel renders no secret beyond the
live claim code and clears it on revoke.

Moved the session state machine into `@icm/agent-adapter` (browser-safe, shared
by the worker relay and the editor); the worker value-imports it and the root
declares the workspace dependency.

Validation: 5 panel markup tests across idle/ready/paused/revoked/closed states;
the agent-host (6) and state-machine (13) suites still pass; the App shell suite
(12) passes after deliberately updating the obsolete "no Agent string" assertion
to "Connect Agent command present, authorization panel not rendered by default".
Workspace `typecheck` clean. Playwright grant-to-revoke and the network relay
transport are deferred to WP-WA7 deployment.
