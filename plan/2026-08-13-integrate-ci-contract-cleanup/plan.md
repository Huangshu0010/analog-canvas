---
status: active
experience: none
---

# Integrate CI Contract Cleanup

## Goal

Combine `origin/codex/ci-contract-cleanup` with PR #25, preserve both the Agent
contract hardening and the cleanup branch's accepted API/text/CI reductions,
validate the combined head, and merge the unified PR into `main` only after all
required GitHub checks pass.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-contract-hardening...origin/codex/agent-contract-hardening
```

The worktree was clean. `origin/codex/ci-contract-cleanup` is four commits ahead
of common base `62141a8`; PR #25 is three commits ahead. A read-only merge-tree
audit found content conflicts in `apps/editor/src/app/App.tsx`,
`packages/render-svg/src/render.ts`, and `plan/log.md`; generated Agent API
artifacts and the other overlapping product files merge mechanically.

Owned scope is the union of PR #25 and `origin/codex/ci-contract-cleanup`, plus
this plan and factual log. No unrelated mainline cleanup is included.

Shared contracts:

- Agent request/response/OpenAPI artifacts must be regenerated from the merged
  source contract, never hand-merged as authority.
- RichText/schematic-text ownership from the cleanup branch remains the active
  text contract.
- Coincident contact, canonical Project diagnostics, and shared Agent/GUI Wire
  intent from PR #25 remain the active electrical/Agent contracts.
- Existing required-check policy may skip heavy jobs only for genuinely
  documentation-only changes.

## Work

1. Merge the cleanup branch and resolve only the three audited conflicts.
2. Preserve canonical diagnostics in App while accepting removed compatibility
   imports/call sites from the cleanup branch.
3. Preserve contact-aware junction rendering while adopting the consolidated
   schematic-text renderer.
4. Regenerate Agent API artifacts and run focused contract/text/routing tests.
5. Run frozen install plus full `pnpm ci:check`, push the unified PR, wait for
   required checks, then merge PR #25 into `main`.

## Validation

- focused Agent, routing, render, text, model, and editor tests
- `pnpm agent-api:artifacts:check`
- `pnpm references:check`
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- PR #25 required GitHub checks
- post-merge `origin/main` ancestry and clean status
- `git diff --check`

## Commit Intent

Merge `origin/codex/ci-contract-cleanup` into
`codex/agent-contract-hardening`, preserve its four source commits, and add only
bounded conflict-resolution/closeout commits when required.

## Outcome

Pending integration and validation.
