---
status: completed
experience: none
---

# Schema 16 Instance Identity Protocol

## Goal

Establish one unambiguous persisted/display protocol for schematic instances:
internal object IDs, emitted netlist designators, optional schematic aliases,
external/internal master names, and formal Cell terminal names are separate
concepts. Advance Project schema 15 to schema 16 with one direct reader
migration and no mixed runtime binding semantics.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .pnpm-store/
?? .worktrees/
```

The two untracked paths are local dependency/worktree infrastructure. They are
unrelated to the protocol target and will remain untouched. The target starts
from `main` commit `84f33c57` on branch `codex/schematic-instance-lifecycle-ux`.

Owned paths:

- `packages/model/src/schema/{common,annotations}.ts` and focused model tests
- `packages/project-protocol/src/` migration, load, corpus, and tests
- `packages/derived/src/annotation-text*`
- consumers of the retired annotation binding in `apps/editor/src/`
- current protocol documentation, a new ADR, this plan, and `plan/log.md`

Read-only shared dependencies:

- typed instance netlist authority from ADR 0027
- rolling N-1 reader contract from ADR 0023
- structural import/export semantics in `packages/spice` and `packages/netlist`
- annotation anchors and edit-union contract in `packages/edit-engine`

## Work

1. Add Schema 16 bindings: `instance-designator`, `instance-schematic-name`,
   and `instance-master-name`; retain `instance-value` and
   `cell-terminal-name`. Remove `instance-reference` from the current model.
2. Make derived text projections strict: no user-visible text binding may
   fall back to `Instance.id`. Designator resolves only from
   `Instance.netlist.reference`; formal ports resolve only from the formal
   terminal name.
3. Advance the current Project schema to 16 and replace the rolling reader
   adapter with a direct v15-to-v16 migration. The adapter maps legacy
   reference bindings deterministically to the binding that preserves their
   visible projection, then validates the sole v16 runtime shape.
4. Migrate every in-repository creator, clipboard path, editor binding check,
   fixture, and test to the new binding names; no current writer may emit the
   retired kind.
5. Record the protocol decision and update current specifications,
   compatibility guide, version drift contracts, and corpus evidence.

## Validation

- focused model, project-protocol, derived annotation, editor clipboard/text
  and relevant component-placement tests
- `pnpm test:impact -- --base origin/main`
- `pnpm typecheck`
- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: schema-16 parse/save, v15 direct migration, strict identity text
  projection, clipboard rebinding, and rejection of retired annotation kinds.
- Primary checks: model schema/version tests, project-protocol load/persistence
  tests, `packages/derived/src/annotation-text.test.ts`, and focused editor
  behavior tests.

## Commit Intent

Commit as:

```text
feat(protocol): separate instance display identities
```

## Outcome

Schema 16 now separates electrical designators, schematic aliases and master
labels, and no current writer or renderer may use `instance-reference` or an
internal Instance ID as a visible fallback. The rolling reader accepts schema
15 only as input, mapping each legacy reference label to the source that
preserves its old rendered text. Canonical fixtures, browser recovery, bundled
examples, specs and ADR 0030 now use schema 16.

Validation passed: focused model/project-protocol/derived/editor contracts
(12 files / 102 tests), `pnpm typecheck`, `pnpm docs:check`,
`pnpm format:check`, `pnpm test:impact -- --base origin/main`, and
`git diff --check`. Implementation committed as `d70c84bc`
(`feat(protocol): separate instance display identities`).
