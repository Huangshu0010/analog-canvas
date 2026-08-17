---
status: completed
experience: none
---

# Repair Project Protocol Release Imports

## Goal

Restore the release verification scripts after Project persistence moved from
`@icm/model` to `@icm/project-protocol`, without changing device or Project
behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/device-protocol-compatibility-plan...origin/codex/device-protocol-compatibility-plan
?? .worktrees/
```

The only dirty path is the user-owned, untracked `.worktrees/` directory. It
does not overlap this target and will remain untouched.

- Owned: `scripts/performance-baseline.mjs`, `scripts/export-golden.mjs`,
  `scripts/visual-golden.mjs`, this plan, `plan/root-audit.md`, and
  `plan/log.md`.
- Read-only: built package entry points and release workflow configuration.
- Shared: `@icm/model` owns current model validation; `@icm/project-protocol`
  owns Project parsing, serialization, and storage.

## Work

1. Point release scripts at the Project-protocol build artifact for persistence
   APIs, retaining model imports only for model APIs.
2. Run the release verification path that failed remotely and record the
   result.

## Validation

- `pnpm build && pnpm release:verify:built`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: the import correction preserves the existing release-script behavior
  and does not change an application contract.
- Existing protection: `pnpm build && pnpm release:verify:built` directly
  executes all three repaired scripts and passed after the correction.

## Commit Intent

Commit as:

```text
fix(release): use project protocol persistence API
```

## Outcome

Release scripts now obtain Project parsing, serialization, and storage from
`@icm/project-protocol`, while model construction and validation remain in
`@icm/model`. `pnpm build && pnpm release:verify:built` passed, including the
performance baseline, export and visual golden checks, production smoke, and
release package smoke checks. The repair is committed and awaits remote
required-check verification.
