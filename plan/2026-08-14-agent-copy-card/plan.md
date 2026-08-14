---
status: completed
experience: none
---

# Agent Connection Copy Card

## Goal

Present the Agent connection hand-off as a compact plain-text copy card whose visible text is exactly the text written to the clipboard, while matching the existing editor theme.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-copy-card
```

The target runs in a clean dedicated worktree because the primary workspace contains another worker's unrelated annotation/golden changes. This target owns only:

- `apps/editor/src/agent/connect-agent-panel.tsx`
- `apps/editor/src/agent/connect-agent-panel.test.tsx`
- the Agent hand-off styles in `apps/editor/src/styles.css`
- this plan and the factual `plan/log.md` entry

Agent transport, claim content, permissions, and API contracts are read-only and out of scope.

## Work

1. Replace the standalone copy button with a themed plain-text card containing the exact clipboard payload.
2. Add an accessible icon copy action and short copied feedback without changing connection semantics.
3. Protect content parity and card rendering with focused component tests.

## Validation

- `pnpm test:local apps/editor/src/agent/connect-agent-panel.test.tsx`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(agent): present handoff as copy card
```

## Outcome

The connection hand-off now uses one themed plain-text card for both display
and clipboard output. The icon action has accessible copied feedback, the
technical details remain available below it, and no transport or claim
contract changed. Focused component tests and typechecking passed; the local
editor shell was also inspected in the in-app browser. The development server
does not implement the session API, so the populated claim state is protected
by the component regression rather than a live local claim.
