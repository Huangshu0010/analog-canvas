---
status: completed
experience: none
---

# Retire Legacy Annotation Protocol

## Goal

Make `upsert_schematic_annotation` and `remove_schematic_annotation` the only
annotation edit protocol and remove the old aliases without compatibility.

## State and Ownership

The branch starts clean from merged `main`. This target owns the Edit Engine
schemas/runtime, all repository callers and fixtures of the removed edit names,
Agent API artifacts, normative edit/API documentation, focused tests, this
plan, and its log entry. RichText behavior and persisted Project migration are
read-only.

## Work

1. Replace every internal old edit name with the explicit current protocol.
2. Delete the old schemas, union members, execution branches, dispatch mapping,
   and OpenAPI/schema exposure.
3. Preserve the stricter layout-intent deletion precondition in the sole
   current remove implementation.
4. Regenerate checked Agent API artifacts if their schema changes.

## Validation

- No old annotation edit names remain in executable code, fixtures, or current
  normative documentation.
- Focused Edit Engine, Agent Adapter, routing, editor, and schema tests.
- Agent API artifact check, typecheck, build, `git diff --check`, and status.

## Commit Intent

```text
refactor(api): retire legacy annotation edits
```

## Outcome

Removed the ambiguous annotation edit schemas, union members, runtime branches,
Agent capability exposure, and generated API alternatives. All executable
callers, layout recipes, fixtures, tests, and current normative documentation
now use `upsert_schematic_annotation` / `remove_schematic_annotation`.

The sole current remove path retains the stricter layout-intent reference
precondition that had existed only in the legacy branch. New regressions prove
that both retired names are schema-invalid and that referenced annotations
cannot be removed. Generated Agent API artifacts contain one current upsert and
one current remove alternative and no legacy alternative.

Focused validation passed 68 tests across eight files, followed by 19 Edit
Engine tests including the new regressions. Agent API artifact check, workspace
typecheck, production build, full formatting check, and `git diff --check`
passed.
