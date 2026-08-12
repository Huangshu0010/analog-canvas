---
status: completed
experience: none
---

# Connectivity recovery C1 — canonical locator and diagnostic protocol

## Goal

Replace the three incompatible document-scoped locator declarations and the
ERC-coupled diagnostic envelope with the single ADR 0015 protocol. Preserve
search, index, ERC, and visual diagnostic behavior while making every direct
document target explicitly use `hierarchyPath: []`.

## State and Ownership

Start state: C0 is committed on `roadmap/connectivity-routing-debugging`; the
worktree is clean. This target owns:

- `packages/derived/src/object-locator.ts` (new)
- `packages/derived/src/connectivity-index.ts`
- `packages/derived/src/project-search.ts`
- `packages/derived/src/diagnostics/diagnostic.ts`
- `packages/derived/src/diagnostics/erc.ts`
- affected derived tests and `packages/derived/src/index.ts`
- `plan/2026-08-12-connectivity-recovery-c1/plan.md`
- `plan/log.md`

Read-only shared dependencies: `@icm/model` `RouteEndpoint`/`SourceSpan`, the
ADR 0015 contract, and editor navigation (C6 owns runtime `navigateTo`). No
schema or editor mutation is in scope.

## Work

1. Define canonical `ObjectLocator`, `HierarchyFrame`, object-kind and
   diagnostic-domain/severity types in `packages/derived`.
2. Migrate connectivity index, project search, ERC, and visual diagnostic
   adaptation to import those types; delete their private public protocols.
3. Preserve existing result ordering and add focused tests that demonstrate the
   same locator shape, including an empty direct-document hierarchy path.
4. Do not implement editor frame navigation, cross-Cell traversal, NoConnect
   lifecycle, cache, or geometry in this target.

## Validation

- focused derived tests for connectivity index, search, ERC and diagnostics
- workspace typecheck
- `git diff --check`
- confirm production `packages/derived/src` has no `IndexObjectLocator`,
  `ErcLocator`, or locally declared `ObjectLocator`

## Commit Intent

`refactor(derived): unify locator and diagnostic protocols`

## Outcome

Added the canonical ADR 0015 locator module and migrated connectivity index,
project search, ERC, and visual-diagnostic adaptation. `ErcDiagnostic` and
`ErcSeverity` remain compatibility aliases, but their concrete protocol is the
independent shared `Diagnostic`; no producer defines a competing locator.
Direct-document results consistently contain `hierarchyPath: []`.

Validation: workspace typecheck; 25 focused derived tests; targeted Prettier;
`rg` confirmed no production `IndexObjectLocator`, `ErcLocator`, or local
`ObjectLocator` declarations; `git diff --check`.
