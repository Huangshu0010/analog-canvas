---
status: completed
experience: none
---

# Close Device and Project Protocol Architecture Gaps

## Goal

Bring the executable implementation into line with the accepted final
architecture: make the device registry self-validating and the sole electrical
authority, split the current-model and Project-protocol source by responsibility,
and audit historical compatibility assets without changing any device behavior
or schema-11 Project bytes.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/device-protocol-compatibility-plan...origin/codex/device-protocol-compatibility-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is user-owned, unrelated, and remains
untouched. This target owns:

- `packages/devices/`, direct device consumers, and their tests
- `packages/model/src/schema/` current-schema source organization
- `packages/project-protocol/` source organization and diagnostics
- current protocol/device documentation, this plan, `plan/log.md`, and
  `plan/root-audit.md`

Read-only shared contracts include all schema-11 fixture bytes, built-in symbol
assets, the typed Edit Engine union, netlist golden behavior, and browser
recovery semantics. No persisted field, current `symbolId`, pin order, or
netlist output may change.

## Work

1. Make every built-in device descriptor explicit, validate descriptor
   semantics and Symbol pin parity from the registry boundary, and remove the
   remaining Symbols-owned electrical compatibility facade.
2. Split current schema source into the responsibility files required by the
   architecture while retaining exactly the existing public exports and v11
   validation/serialization behavior.
3. Split Project protocol versioning, diagnostics, loading, saving, and the
   single Previous-to-Current adapter; retain only structured, strict current
   loading and no persistent module/device version fields.
4. Audit tracked compatibility fixtures/assets and document or remove any
   historical asset that would contradict the one-adapter policy.

## Validation

- focused device, symbols, netlist, model schema, and Project protocol tests
- focused editor project-file/recovery tests and schema-10 browser workflow
- `pnpm typecheck`
- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `pnpm verify:branch`, justified by shared model, symbols, netlist, editor,
  and persistence boundaries
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: explicit built-in device descriptors and Symbol parity; unchanged
  v11 schema/public exports/canonical serialization; single N-1 direct adapter
  and strict structured load failures; no retained historic Project fixture
  inputs.
- Primary checks: device registry and Symbol parity contracts, model schema and
  Project protocol persistence/compatibility corpus tests, editor file/recovery
  tests, and the project-file browser workflow.

## Commit Intent

Commit as:

```text
refactor(protocol): complete device and compatibility boundaries
```

## Outcome

Every currently supported netlisting device now has an explicit descriptor file
and is registered through an internally validating registry. Symbol artwork no
longer exports electrical device definitions; the cross-package pin-parity
contract remains directly tested. Current schema source is split into routing,
rich-text, annotations, drafting, presentation, and shared validation modules;
Project protocol is split into diagnostics, version, load, save, storage, and
the sole Previous-to-Current adapter.

The tracked fixture audit found no historic Project input assets: every accepted
corpus Project is schema 11 and schema-10 coverage is synthesized in the
protocol tests. No Project field, current symbol ID, pin order, or serializer
behavior changed. Focused contracts, the schema-10 browser workflow,
`pnpm test:impact -- --base main`, and `pnpm verify:branch` passed (134 files /
816 tests, workspace build, production smoke). `git diff --check` passed.
