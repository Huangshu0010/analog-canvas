---
status: completed
experience: none
---

# Capitalize Citation Title

## Goal

Correct the README citation title to the publication-style capitalization
`Analog Canvas`.

## State and Ownership

The worktree was clean and synchronized with `origin/main`. This
documentation-only target owns `README.md`, this plan, and `plan/log.md`.

## Work

Capitalize the prose and BibTeX titles while preserving the stable BibTeX key,
authors, year, URL, and reproducibility guidance.

## Validation

- Targeted Markdown formatting check
- `git diff --check`
- GitHub Actions documentation-only checks

## Commit Intent

```text
docs(readme): capitalize citation title
```

## Outcome

Updated both citation displays to the exact title `Analog Canvas`. Targeted
formatting and `git diff --check` passed.
