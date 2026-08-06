# Target Title

## Goal

State the concrete objective.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
<paste status>
```

State whether the worktree is clean or why unrelated dirty files are safe to
leave untouched.

## Owned Files

- `<paths this target may edit>`

## Read-Only Files

- `<paths this target may inspect but not edit>`

## Shared Dependencies

- `<shared contracts, generated artifacts, APIs, docs, or decisions>`

## Expected Work

1. `<step>`
2. `<step>`

## Validation

- `git diff --check`
- `git status --short --branch`
- `<smallest deterministic checks covering behavior and dependencies>`

Explain why the checks match the affected surface and risk. If adding tests or
running a full suite, state the behavior, regression risk, contract, or policy
that justifies it.

## Experience Signal (for human review)

Optionally flag a repeated failure, contradicted rule, unsafe shortcut, or
validation gap. This is not an Agent self-evaluation; a human decides whether
to request lesson extraction. Leave empty for routine work.

## Commit Intent

Commit as:

```text
<commit message>
```
