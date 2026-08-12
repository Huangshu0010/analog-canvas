---
status: completed
experience: none
---

# Exercise hierarchy navigation in the editor

## Goal

Prove the canonical locator navigation path in the running editor: a project
search result in an imported child Cell must open that Cell, select the target,
and preserve a usable `Up` frame back to its parent.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target owns a small valid hierarchy fixture and its
Playwright consumer. It does not change navigation, schema, or connectivity
contracts; those remain read-only dependencies.

- `fixtures/projects/hierarchy-navigation/project.icproj.json`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-12-connectivity-recovery-c6d/plan.md`
- `plan/log.md`

## Work

1. Add a minimal two-Cell imported project with a stable child link and one
   searchable child instance.
2. Exercise Ctrl+F navigation into the child, selection, and `Up` return in
   Playwright.

## Validation

- focused Playwright hierarchy-search case
- relevant editor/derived unit tests and workspace typecheck
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
test(editor): cover cross-Cell locator navigation
```

## Outcome

Added a valid two-Cell imported-project fixture and browser coverage that
searches for a child instance, enters its Cell through the canonical locator,
then returns through the preserved `Up` hierarchy frame. Focused Playwright,
navigation/App unit tests, and workspace typecheck passed.
