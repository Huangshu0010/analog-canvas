---
status: completed
experience: none
---

# Connectivity recovery C6b — project search UI

## Goal

Expose the canonical C6a project search in the editor through Ctrl+F and a
compact result dialog. Selecting an instance/route/junction/annotation may
switch direct Documents and select the target. Net/port results remain
discoverable but do not pretend to have the later hierarchy-aware navigation or
Net-highlight overlay.

## State and ownership

The branch is clean after C5b. This target owns the search dialog component,
App integration, CSS, focused E2E test, plan and log. The frozen
`HierarchyFrame` navigation semantics remain C6c work; direct document switching
is a deliberate interim capability.

## Validation

Editor build/typecheck, focused search and Playwright coverage, Prettier and
`git diff --check`.

## Outcome

Added a compact Ctrl+F project search dialog backed by the canonical C6a index.
It matches the full project, can switch direct Documents, and selects matching
instances. Net and port results remain discoverable but intentionally do not
claim the later Net highlight or frame-stack `navigateTo()` semantics.

Validation: workspace typecheck; focused Playwright search flow; Prettier and
`git diff --check`.
