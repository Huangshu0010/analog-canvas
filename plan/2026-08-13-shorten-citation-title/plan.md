---
status: completed
experience: none
---

# Shorten Citation Title

## Goal

Use the exact short project title `analog-canvas` throughout the README
citation.

## State and Ownership

The worktree was clean and synchronized with `origin/main`. This
documentation-only target owns:

- `README.md`
- `plan/2026-08-13-shorten-citation-title/plan.md`
- `plan/log.md`

## Work

Replace the descriptive citation title in both the prose citation and BibTeX
entry while preserving authors, year, URL, and reproducibility guidance.

## Validation

- Targeted Markdown formatting check
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
docs(readme): shorten citation title
```

## Outcome

Updated both citation forms to the exact title `analog-canvas`; preserved the
authors, year, repository URL, and reproducibility note. Targeted formatting
and `git diff --check` passed.
