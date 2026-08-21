---
status: completed
experience: none
---

# Default Port names to Razavi mathematical text

## Goal

Make newly placed Free Net Ports and Formal Cell Pins render their bound
electrical names in the default Razavi bold-italic RichText presentation,
including non-`V`/`I` identifiers such as generated `NET1` and `CLK`. Retain
the current explicit subscript and conventional `Vout`/`Iref` formatting.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/insert-unification...origin/codex/insert-unification
```

The isolated worktree is clean. Owned paths:

- `packages/model/src/semantic-text.ts`
- `packages/model/src/semantic-text.test.ts`
- focused Port browser regression
- `docs/specs/editor-interaction.md`
- this plan and `plan/log.md`

Read-only shared dependencies: annotation binding resolution and SVG RichText
rendering already consume semantic text. This target changes their default
authoring input only; it introduces neither stored overrides nor a new model
field.

## Work

1. Make the existing `net-label` and `formal-port` semantic fallback a Razavi
   mathematical base rather than unstyled text.
2. Preserve explicit subscript parsing and conventional voltage/current
   shorthand.
3. Add model and real `P` placement coverage for a generated `NET1` label.
4. Record the user-visible default text rule.

## Validation

- `pnpm test:local packages/model/src/semantic-text.test.ts apps/editor/e2e/manual-editor.spec.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep="Port shortcut starts ordinary component placement"`
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: every default Net/Cell Port label has Razavi bold-italic base
  styling; electrical names and subscript grammar remain semantically bound.
- Primary checks: semantic RichText structure and the browser's rendered Port
  label after actual placement.

## Commit Intent

```text
fix(editor): default port labels to razavi text
```

## Outcome

Completed the semantic fallback repair: non-`V`/`I` Free Port Net names and
Formal Cell Pin names now use the existing Razavi mathematical RichText base
instead of unstyled text. Existing voltage/current shorthand and explicit
subscript syntax are unchanged. The browser Port workflow verifies the emitted
`NET1` label contains the rendered italic/bold style.

Validation passed: focused model unit tests (3 tests), browser Port shortcut
workflow, typecheck, Prettier, test-impact, and diff checks.

Commit: `fix(editor): default port labels to razavi text` on the current branch
HEAD. Push is pending after one transient GitHub TLS handshake failure.
