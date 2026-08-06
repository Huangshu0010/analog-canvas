# Execute Phase 0 Contracts and Scaffold

## Goal

Complete the Phase 0 exit gate by establishing the repository scaffold,
accepted cross-module contracts, reference-source governance, canonical Project
persistence, the edit/revision envelope, and minimal SPICE and symbol
boundaries required by Phases 1 and 2.

This target implements only Phase 0. It is the first bounded target under the
active Phase 0–7 product goal; completing it does not redefine or complete the
larger goal.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. Existing documentation, netlists, and the VSS asset are
committed baseline material.

## Owned Files

- `.gitignore`
- `.gitattributes`
- `README.md`
- `.github/workflows/`
- root TypeScript and pnpm workspace configuration
- `apps/editor/`
- `packages/model/`
- `packages/edit-engine/`
- `packages/spice/`
- `packages/symbols/`
- `fixtures/projects/`
- `references/`
- `scripts/fetch-references.ps1`
- `scripts/check-references.mjs`
- Phase 0 specifications and ADRs under `docs/specs/` and `docs/adr/`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-0-contracts-and-scaffold.md`
- `plan/2026-08-07-execute-phase-0/`
- `plan/log.md`

## Read-Only Files

- `docs/overall-product-plan.md`
- Phase 1–7 roadmap files
- `lib/circuit.vss`
- `netlists/`
- the fetched `.reference-src/` trees

## Shared Dependencies

- The product architecture and authority order in `docs/README.md` and
  `docs/overall-product-plan.md`.
- The Phase 0 exit gate in
  `docs/roadmap/phase-0-contracts-and-scaffold.md`.
- Node.js, pnpm, TypeScript, React, Zod, and the selected test runner.
- `chenzc24/net-painting-converter` is reference-only and limited to SPICE
  parsing, source handling, diagnostics, and fixtures. Its automatic layout,
  scene, routing, rendering, and publishing architecture must not be inherited.
- License selection is intentionally deferred. No third-party source code is
  copied in this target.

## Expected Work

1. Record accepted Phase 0 ADRs and normative English specifications.
2. Add a pinned reference manifest and a fetch script that writes only to the
   ignored `.reference-src/` directory.
3. Create a minimal pnpm/TypeScript workspace and editor shell without adding
   unused empty packages.
4. Implement stable geometry, identity, Project, Document, validation,
   migration, and canonical persistence contracts.
5. Implement the Edit Transaction/revision envelope with atomic no-op and
   stale-revision behavior.
6. Implement minimal transient Circuit IR and Symbol Resolver contracts.
7. Add valid, rejected, canonical, and compile-time consumer fixtures/tests.
8. Run the Phase 0 validation surface, record factual evidence, and update the
   roadmap status only if the exit gate is proven.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- PowerShell reference-manifest/fetch-script dry checks that do not make a
  production build depend on fetched repositories
- `pnpm references:check`
- schema acceptance and rejection tests
- canonical save-load-save semantic equality
- coordinate transform property coverage
- stale-revision and atomic no-op transaction tests
- `git diff --check`
- `git status --short --branch`

The phase creates shared contracts consumed by all later phases, so the full
workspace typecheck, test, and build commands are appropriate even though the
workspace is initially small.

## Experience Signal (for human review)

None at target start.

## Commit Intent

Commit as:

```text
Complete Phase 0 contracts and scaffold
```
