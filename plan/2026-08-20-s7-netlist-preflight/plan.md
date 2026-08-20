---
status: completed
experience: none
---

# S7 netlist analysis and preflight

## Goal

Make `analyzeDesignNetlist(Project)` the sole Stage-1 design-netlist analysis
entry point, attach navigable diagnostic evidence, and expose the exact result
through a read-only editor preflight.

## State and Ownership

Start state is an intentionally dirty worktree: S5 connectivity and S6
interface-authoring changes are present but uncommitted because this sandbox
cannot create the worktree Git `index.lock`. They are predecessor work owned by
this roadmap, not unrelated user edits. This target owns only its analysis,
preflight UI, tests, and factual record; it will not alter their behavior.

- `packages/netlist/src/{extract.ts,ir.ts,index.ts,current-contract.test.ts,package.json}`
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/netlist-export/netlist-preflight-dialog.tsx`
- `apps/editor/e2e/*`
- `plan/2026-08-20-s7-netlist-preflight/plan.md`, `plan/log.md`,
  `plan/root-audit.md`

Shared: `@icm/derived` ObjectLocator contract, Project schema/hierarchy,
existing netlist IR and S6 interface semantics. Read-only: S5/S6 implementation
files except when a required integration adjustment is explicitly recorded.

## Work

1. Rename the current extraction implementation in place to the single public
   `analyzeDesignNetlist` API; do not leave a parallel compatibility entry.
2. Turn each result diagnostic into a canonical navigable ObjectLocator using
   facts already present in the Project, without adding exporter-only rules.
3. Add a preflight dialog that consumes that same result and uses the existing
   hierarchy navigator to open, fit, select, or highlight its evidence.
4. Characterize the renamed API and the user-visible preflight interaction.

## Validation

- `pnpm typecheck`
- `pnpm test:local packages/netlist/src/current-contract.test.ts apps/editor/src/app/App.test.tsx`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "netlist preflight"`
- `pnpm test:impact -- --base origin/main`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: one public analyzer result feeds IR and UI; every diagnostic has a
  resolvable primary locator; blocking diagnostics retain the null-IR gate.
- Primary checks: current netlist contracts and focused editor browser behavior.

## Commit Intent

Commit as:

```text
feat(netlist): add navigable design-netlist preflight
```

## Outcome

Implemented the sole public `analyzeDesignNetlist` entry, removed the old
public extraction name, and made every diagnostic carry a canonical primary
ObjectLocator. The preflight dialog consumes this exact analysis result; it
returns no IR when blocking diagnostics exist and navigates findings through
the existing hierarchy locator flow (including fitting document-level evidence).

Validation passed: full formatting check; TypeScript typecheck; 109 focused
unit/component tests; focused Preflight Playwright workflow; workspace build;
documentation links; test-impact; and diff check. Committed as `50b6c28`
(`feat(schematic): complete stage 1 netlist foundation`) after the worktree Git
lock was restored and the branch was rebased onto `origin/main`.
