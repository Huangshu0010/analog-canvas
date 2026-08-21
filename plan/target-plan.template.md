---
status: active
experience: none
---

# Target Title

## Goal

State the concrete objective.

## State and Ownership

Start state from `git status --short --branch`:

```text
<paste status>
```

State whether the worktree is clean or why unrelated dirty files are safe to
leave untouched. Name the owned paths.

- `<paths this target may edit>`

Name read-only paths and shared dependencies only when overlap or contract risk
is credible:

- Read-only: `<paths this target may inspect but not edit>`
- Shared: `<contracts, generated artifacts, APIs, docs, or decisions>`

## Work

1. `<step>`
2. `<step>`

## Validation

- `git diff --check`
- `git status --short --branch`
- `<smallest deterministic checks covering behavior and dependencies>`

Add test rationale or broader-suite justification only when it is not obvious
from the changed behavior and risk.

## Gate Review

- Decision: `<affected | full | no-runtime-impact>`
- Early gates: `<cheap checks that must run before expensive validation>`
- Affected gates: `<focused unit, module, browser, or release checks>`
- Final gates: `<the final delivery gate or why none applies>`
- Platform risks: `<Linux, browser, generated-artifact, or release-only risks>`

Generate an advisory plan from intended paths before editing when practical,
then regenerate it from the real diff before delivery. A gate-policy change or
an unclassified implementation path requires the full fallback.

## Test Impact

- Decision: `<tests-updated | no-test-change>`
- Contracts: `<current behavior or invariant>`
- Primary checks: `<test paths and commands>`

For `no-test-change`, replace the last two lines with an evidence-based reason
and existing protection where applicable. Do not use this section to justify
unreviewed behavior changes.

## Commit Intent

Commit as:

```text
<commit message>
```

## Outcome

At close-out, summarize the actual change and validation, then set
`status: completed`. Set `experience: candidate` only for a concrete reusable
signal; otherwise leave it as `none`. A human later changes a candidate to
`extracted`, `rejected`, or `deferred`.
