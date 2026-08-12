---
status: completed
experience: none
---

# Persist source binding evidence for ERC

## Goal

Add typed, per-instance source binding evidence and make ERC consume its
explicit `missing` and `unsupported` states, without inferring them from legacy
`spice.target` strings or widening which SPICE instances the importer accepts.

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging...origin/roadmap/connectivity-routing-debugging
```

The worktree is clean. This target introduces an optional persisted fact for
backwards compatibility: old projects retain no evidence and therefore receive
no speculative binding ERC. Existing importer rejection of unreviewed symbols
is a separate product-policy target.

- `packages/model/src/schema.ts`
- `packages/spice/src/importer.ts`
- `packages/spice/src/compiler.test.ts`
- `packages/derived/src/diagnostics/erc.ts`
- `packages/derived/src/diagnostics/erc.test.ts`
- `docs/specs/schematic-model.md`
- `plan/2026-08-12-connectivity-recovery-c8c/plan.md`
- `plan/log.md`

Read-only shared dependencies:

- `packages/spice/src/ir.ts` compile target facts
- `packages/symbols` mapping registry
- existing `spice.target` compatibility properties

## Work

1. Define a strict typed source-binding evidence schema on an Instance with
   optional presence for legacy persisted projects.
2. Write resolved primitive/model/subcircuit evidence at SPICE import time,
   including source references and stable imported child document ids where
   known.
3. Emit `ERC_MISSING_MODEL` and `ERC_UNSUPPORTED_MODEL` only from explicit
   evidence, never by parsing compatibility properties.
4. Add importer and ERC regressions for evidence persistence and positive/
   negative diagnostics.

## Validation

- focused model/spice/derived Vitest files
- `corepack pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(erc): consume typed source binding evidence
```

## Outcome

Added optional strict per-instance binding evidence and populated it for every
successfully imported reviewed device. The importer preserves the actual IR
kind: for example, an externally named SKY130 target remains `opaque` while
its reviewed registry mapping records a resolved binding. ERC now emits missing
and unsupported diagnostics only when explicit evidence says so; legacy
`spice.target` alone is ignored. Focused model/SPICE/ERC tests and workspace
typecheck passed.
