---
status: active
experience: none
---

# Integrate Main into Netlist Export

## Goal

Merge the latest `origin/main` into `codex/netlist-export-system`, preserve the
deterministic SPICE/Spectre export contracts, resolve shared-contract conflicts
deliberately, and leave the branch runnable for hands-on export testing.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/netlist-export-system...origin/codex/netlist-export-system
```

The worktree is clean. After `git fetch origin --prune`, `origin/main` has 13
commits absent from this branch and this branch has 12 commits absent from
`origin/main`; their merge base is `62141a8`. This target is owned by the
current Agent and may edit only merge-conflicted files, directly affected
tests/generated contracts, this plan, and `plan/log.md`.

- `apps/editor/` conflicts affecting netlist authoring/export or current main
  editor contracts
- `packages/model/`, `packages/edit-engine/`, `packages/agent-adapter/`, and
  other package conflicts required to preserve both accepted contracts
- workspace manifests and generated Agent API artifacts only if canonical
  checks require regeneration
- `plan/2026-08-13-netlist-export-main-integration/plan.md`
- `plan/log.md` at close-out

Shared dependencies are the schema-v4 netlist model, current main Agent/Edit
Engine contracts, clipboard reference allocation, generated Agent API
artifacts, and editor build/runtime behavior. Existing `netlists/` fixtures and
foundry/vendor model data remain read-only.

## Work

1. Merge `origin/main` without rebasing or rewriting the published branch.
2. Resolve conflicts by preserving current-main contract removals and API
   compaction while retaining typed netlist fields, edits, UI, extraction, and
   printers.
3. Run focused tests for every conflict area plus SPICE/Spectre extraction,
   printing, downloads, and blocked diagnostics.
4. Run the full frozen-lockfile `pnpm ci:check` delivery gate.
5. Record the outcome, commit the integration, and push the review branch.

## Validation

- focused typecheck and tests chosen after the conflict set is known
- SPICE/Spectre unit goldens and focused Playwright export flows
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
merge: integrate main into netlist export
```

## Outcome

At close-out, record the merged main commit, conflict decisions, validation,
and push status, then set `status: completed`.
