---
status: completed
experience: none
---

# Connectivity recovery C6a — canonical project search backend

## Goal

Make project search consume the C1/C4 object-index protocol rather than build a
second locator, and search both property keys and values. This is the backend
slice only; editor Ctrl+F and `navigateTo()` own a separate UI/navigation
boundary.

## State and ownership

The worktree is clean after C5a. This target owns derived project-search code,
tests, plan and log. Connectivity Index is a read-only C4 dependency; no
editor, schema or hierarchy traversal change occurs here.

## Validation

Focused search/connectivity-index tests, workspace typecheck, Prettier and
`git diff --check`.

## Outcome

Project search now optionally consumes C4's object index and preserves its
canonical locators; the fallback is retained for callers that deliberately do
not build connectivity data. Both instance property keys and values participate
in deterministic matching. Ctrl+F and frame-stack navigation remain separate
editor work and are not claimed by this backend completion.

Validation: workspace typecheck; 19 focused search/connectivity-index tests;
targeted Prettier and `git diff --check`.
