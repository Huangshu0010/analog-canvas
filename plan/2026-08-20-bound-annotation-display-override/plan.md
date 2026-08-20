---
status: completed
experience: none
---

# Schematic Reference Text

## Goal

Separate the user-owned rich schematic reference from the hidden instance and
SPICE reference. Restore rich-text editing for its bound annotation and make
overbar a selection toggle: one action applies it, the next removes it.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-text-binding...origin/codex/unified-text-binding
?? .pnpm-store/
?? .worktrees/
```

The untracked directories are local infrastructure and do not overlap this
target. This target owns the annotation display contract, resolver, bound-text
editor, transaction editing flow, and their tests/plan records.

- `packages/model/src/schema/instance.ts`
- `packages/derived/src/annotation-text.ts`
- `packages/edit-engine/src/transaction-instance-annotations.ts`
- `docs/specs/edit-engine.md`
- `apps/editor/src/features/text-editing/*`
- `apps/editor/src/features/properties/use-properties-editor.ts`
- focused tests in affected packages and `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-20-bound-annotation-display-override/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Shared dependencies: RichText AST, transaction schema, and all renderer/
diagnostics consumers of `resolveAnnotationText`. `Instance.schematicName` is
the sole user-editable RichText source; an annotation only binds and positions
that source. Its absence falls back to a generated display of the SPICE
reference, while internal instance identity and SPICE export remain untouched.

## Work

1. Add one user-owned RichText `schematicName` to Instances and a typed edit
   that leaves the SPICE reference and stable identity unchanged.
2. Resolve instance-label annotations from that source and restore their full
   RichText editor; retain the compact source editor for other semantic labels.
3. Implement reversible selection formatting for overbar without changing the
   displayed name's other characters.
4. Cover name/format persistence and browser interactions.
5. Document the new typed presentation edit so the executable protocol and its
   published contract remain identical.

## Validation

- focused model/derived/edit-engine tests
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "instance|overbar|bound"`
- `pnpm typecheck`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: instance identity and SPICE reference remain unchanged by user
  schematic-name edits; one RichText schematic name owns label characters and
  formatting; overbar is reversible.
- Primary checks: model/derived resolver tests and browser semantic-text flow.

## Commit Intent

```text
fix(text): restore formatting for bound annotations
```

## Outcome

`Instance.schematicName` now owns the user-editable RichText schematic alias;
instance-label annotations project it without altering the stable instance or
SPICE reference. Bound instance labels restore the full RichText toolbar, while
other semantic labels retain their compact source editor. Overbar now toggles
off for a selected multi-character formatting run. Focused model, transaction,
protocol, agent-adapter, browser, typecheck, test-impact, and diff checks
passed.
