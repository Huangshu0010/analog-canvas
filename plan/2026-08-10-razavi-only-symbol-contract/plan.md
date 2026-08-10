---
status: completed
experience: none
---

# Razavi-only Symbol Contract

## Goal

Make the approved Razavi catalog the only product component library. Remove the
legacy/hand-authored compatibility library and generic-block fallback. Reject a
SPICE import with an actionable error when any electrical instance cannot map
to an approved Razavi symbol.

## State and Ownership

Start state:

```text
## main...origin/main [ahead 1]
```

The worktree is clean. This target owns the symbol catalog/runtime boundary,
SPICE import mapping and diagnostics, Component Library source, directly
affected tests/fixtures, generated Razavi catalog output, and the corresponding
normative documentation.

- `packages/symbols/**`
- `packages/spice/src/importer.ts`
- directly affected `packages/spice/src/**/*.test.ts`
- `apps/editor/src/components/component-library.tsx`
- direct Component Library/App wiring needed to remove the alternate source
- editor demos and direct tests that still instantiate removed symbol IDs
- tests and scripts whose resolver construction names the old built-in library
- `scripts/generate-razavi-symbol-catalog.mjs`
- generated imported Project fixtures changed only by the new rejection rule
- Project factory/library-lock metadata and directly affected canonical fixtures
- the visual-golden generator and crossing golden affected by replacing its
  removed legacy fixture symbol
- `docs/specs/symbol-dsl.md`
- `docs/specs/razavi-visual-contract.md`
- historical roadmap statements that incorrectly promise generic fallback
- `plan/2026-08-10-razavi-only-symbol-contract/**`
- `plan/log.md`

Read-only unless a failing focused check proves a direct dependency:

- electrical model and Edit Engine contracts
- circuit netlists and visual reference rasters
- unrelated Page persistence work

Shared dependencies are `SymbolResolver`, PDK model mapping, imported hierarchy
symbols, and the canonical Razavi catalog generator. Hierarchical subcircuit
symbols remain derived navigation objects; they are not user-placeable device
compatibility symbols.

## Work

1. Delete legacy catalog entries/assets and hand-authored compatibility
   symbols; expose one `razaviProductSymbols` collection.
2. Remove generic-block generation and its exported compatibility API; keep a
   private derived hierarchical-block geometry implementation for subcircuits.
3. Make the Component Library unconditional on the Razavi product catalog.
4. Restrict primitive, model, and explicit PDK mappings to approved Razavi
   symbols. Emit `SPICE_IMPORT_UNSUPPORTED_SYMBOL` as an error and return no
   Project when any visible instance is unsupported.
5. Update focused tests, generated output, and normative docs to encode the
   rejection contract.

## Validation

- `pnpm symbols:razavi:check`
- focused symbols, SPICE importer/compiler, and editor Component Library tests
- workspace typecheck because the exported symbol collection changes broadly
- editor build
- full workspace unit suite and the focused unsupported-import browser test,
  because the canonical routing fixture and File-import flow both changed
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
refactor(symbols): enforce Razavi-only product catalog
```

## Outcome

The editor and runtime now expose exactly ten reviewed Razavi product symbols.
The legacy hand-authored definitions/assets and generic-block generator are
deleted; derived hierarchy navigation keeps private geometry without becoming
a placeable compatibility device. SPICE primitive/model/PDK mappings accept
only product symbols, and an unsupported device produces
`SPICE_IMPORT_UNSUPPORTED_SYMBOL`, aborts the import, and surfaces an
actionable GUI error without replacing the open document. Opening or restoring
a Project with an unresolved old symbol is likewise refused.

Validation passed: 440 workspace unit tests, repository typecheck, the full
workspace/editor production build, the focused Playwright unsupported-import
flow, Razavi catalog generation check, three visual-golden checks,
changed-file Prettier, and `git diff --check`. The broad `format:check` still
reports the pre-existing, untouched `packages/derived/src/connectivity.ts`;
all target-owned files pass Prettier.
