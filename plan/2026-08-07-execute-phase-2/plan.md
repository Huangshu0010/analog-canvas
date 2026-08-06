# Execute Phase 2 SPICE Import

## Goal

Complete the Phase 2 exit gate with a source-preserving SPICE import path from
the current `netlists/` corpus into transient Circuit IR and schema-valid
Projects/Documents. Expose the same path through a minimal editor file-import
control without adding placement, routing, simulation, or parser state to the
persistent model.

This is the third bounded target under the active Phase 0-7 goal.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean at Phase 1 commit `56f4f18`.

## Owned Files

- `packages/spice/`
- narrow generated generic-block fallback support in `packages/symbols/`
- narrowly required editor import integration under `apps/editor/`
- Phase 2 source, syntax, IR, Project, and corpus-golden fixtures under
  `fixtures/spice/` and `fixtures/projects/`
- `docs/specs/spice-frontend.md`
- compatible Phase 2 updates to `docs/specs/circuit-ir.md`
- `docs/specs/README.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-2-spice-import.md`
- root workspace/type/test configuration only if required by the import slice
- `plan/2026-08-07-execute-phase-2/`
- `plan/log.md`

## Read-Only Files

- accepted Phase 0 and Phase 1 ADRs and unrelated specifications
- `docs/overall-product-plan.md`
- Phase 3-7 roadmap files
- `lib/circuit.vss`
- source inputs under `netlists/`
- all `.reference-src/` content
- previous-converter layout, routing, Page Scene, rendering, publication, and
  workflow code

## Shared Dependencies

- Persistent Project/Document v1 remains unchanged. Syntax trees, diagnostics,
  source text, and Circuit IR remain transient.
- Source spans use the accepted offset/line/column contract and stable source
  file IDs. Canonical Project source manifests contain hashes and paths, not
  parser objects.
- Every non-comment logical statement must have a typed projection or an
  opaque record with a source-located diagnostic.
- Subcircuit port and instance terminal order is source order. The importer
  must never infer electrical roles for unknown positional pins.
- Includes are local, relative, deterministic, cycle-checked, and forbidden
  from escaping the selected source set/root.
- The previous converter is evidence only for loading, logical-line,
  include-resolution, expression, diagnostic, and parser-fixture behavior.
  No previous automatic drawing architecture is a product dependency.

## Expected Work

1. Accept `spice-frontend.md` with SourceBundle, lossless-source, include,
   typed-statement, diagnostics, and current compatibility contracts.
2. Implement deterministic virtual-source and Node filesystem SourceBundle
   adapters with hashes, exact text retention, local include resolution,
   duplicate suppression, and missing/cycle/escape diagnostics.
3. Implement logical-line construction with continuation, balanced token
   splitting, source offsets, typed current-fixture statements, and opaque
   preservation.
4. Elaborate subcircuits, models, parameters, ordered terminals, hierarchy,
   nets, and top candidates into the transient Circuit IR.
5. Expand Circuit IR only where Phase 2 preservation evidence requires it,
   without adding renderer or persistence fields.
6. Import Circuit IR into one unplaced Document per cell, preserving source
   bindings, connectivity, properties, and generic-block fallbacks with
   actionable symbol diagnostics.
   Generic fallbacks must expose one resolvable electrical pin per imported
   terminal so Phase 3 never receives a schema-valid but geometrically
   unresolvable endpoint.
7. Add a minimal editor multi-file SPICE import control that replaces the open
   Project with the imported Project through the same package API.
8. Add source/include/parser/elaboration/importer tests and a deterministic
   compact connectivity golden covering all seven current entry netlists.
9. Run the Phase 2 exit gate and record completion evidence only if every
   current netlist imports without silent loss.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- focused `@icm/spice` tests for exact source retention, offsets,
  continuations, missing/cyclic/escaping includes, typed/opaque statements,
  hierarchy, positional terminals, parameters, and models
- schema validation and semantic inspection of every imported Project
- corpus golden comparison for 7 entries, 24 cells, and 127 instances
- editor component and Playwright file-import acceptance, including
  `mixed-device-acceptance/circuit.spi` plus `models.inc`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`
- Markdown relative-link and fence checks
- product/reference coupling inspection
- `git diff --check`
- `git status --short --branch`

The target changes source loading, shared transient IR, persistence import,
and the user-visible editor entry point, so focused tests are followed by the
full workspace and browser acceptance gates.

## Experience Signal (for human review)

The old converter's parser source is useful evidence, but this target will
record any behavior that cannot be safely separated from its larger automatic
conversion architecture. No experience note is extracted automatically.

## Outcome

Completed on `2026-08-07`.

- Implemented the source-preserving current SPICE profile, deterministic local
  include graph, transient IR elaboration, Project importer, editor import
  control, and pin-count-matched generic symbol fallback.
- Reused the previous converter only as behavioral evidence for source loading,
  logical continuations, include diagnostics, and typed parser cases. No code,
  runtime dependency, Page Scene, layout, routing, or publication architecture
  was imported from `.reference-src/`.
- The current corpus closes at 7 entries, 24 cells, and 127 instances. The
  original audit wording of "eight entries" was corrected after distinguishing
  the included `models.inc` source from `circuit.spi` entry files.
- A package build initially exposed a missing Node type declaration in the
  isolated Node source adapter; adding package-local Node types closed the
  build without exposing Node APIs through the browser entry point.
- Browser visual review influenced the final evidence but required no CSS
  change: the expanded toolbar remained inside the measured viewport and the
  console was clean.
- No reusable experience note was extracted automatically.

## Commit Intent

Commit as:

```text
Complete Phase 2 SPICE import
```
