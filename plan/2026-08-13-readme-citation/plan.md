---
status: completed
experience: none
---

# Add README Citation

## Goal

Add a polished citation section to the README naming Zengchun Chen and
Zhishuai Zhang as the project authors.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This documentation-only target owns:

- `README.md`
- `plan/2026-08-13-readme-citation/plan.md`
- `plan/log.md`

## Work

1. Add a concise human-readable citation and copyable BibTeX entry.
2. Keep the entry stable for the evolving software by citing the repository
   rather than inventing a publication venue or version.

## Validation

- Inspect the rendered Markdown structure and citation spelling.
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
docs(readme): add project citation
```

## Outcome

Added a reader-facing citation and a copyable BibTeX software entry naming
Zengchun Chen and Zhishuai Zhang, plus guidance to record the release tag or
commit hash for reproducibility. Markdown formatting and `git diff --check`
passed.
