---
status: completed
experience: none
---

# Consolidate Documentation Information Architecture

## Goal

Make current product, user, contributor, and Agent documentation discoverable
from clear entry points; remove or archive redundant historical prose; and add
a deterministic internal-link gate.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/docs-information-architecture
```

The worktree is clean and this branch begins at current `main` merge commit
`2d4a527`. This target owns root and documentation navigation, user/release
guides, complete roadmap archival, redundant Agent planning prose, the
internal Markdown-link checker, CI invocation of that checker, and this
target's plan/log record. Product source, schemas, fixtures, active proposed
roadmaps, plan archival policy, and generated artifacts are read-only.

## Work

1. Replace the mixed historical/current product overview with a concise current
   architecture map; update root README and documentation indexes for users,
   contributors, Agent users, and release readers.
2. Correct repository identity, current schema compatibility, status tables,
   current URLs, and all observed broken links.
3. Archive completed phases 0--8 and delete only Agent planning/guidance prose
   whose current workflow, tool behavior, response semantics, knowledge cards,
   ADRs, and Phase 9 record preserve the necessary contract.
4. Add a dependency-free local-link checker and invoke it in every CI run.

## Validation

- Markdown formatting and internal-link checker.
- `pnpm ci:static` and focused documentation checks.
- `git diff --check` and status review.
- GitHub Actions required checks after pushing the review branch.

## Commit Intent

```text
docs: consolidate current documentation architecture
```

## Outcome

Rebuilt the documentation entry points around user operation, current product
architecture, normative contracts, Agent operation, active roadmaps, release
material, and archive. Root README now names the migrated repository and links
to user, contributor, and Agent starts. The concise product overview replaces
the superseded VSS/Visio development narrative as default context.

Corrected Project schema guidance to v4, web-session status to accepted,
current Pages URL, and all discovered local-link defects. Completed Phase 0--8
records moved to the documented archive. Deleted three redundant Agent planning
documents (`layout-guidance`, `knowledge-and-skill-plan`, and
`rule-guided-layout-architecture`) after their current workflow, behavior,
response, knowledge, ADR, and Phase 9 coverage was linked from the Agent index.

Added a dependency-free Markdown local-link check and runs it in every CI run,
including documentation-only pull requests. Validation passed: Prettier,
`pnpm ci:static`, internal-link scan, pinned-reference check, typecheck, and
`git diff --check`.
