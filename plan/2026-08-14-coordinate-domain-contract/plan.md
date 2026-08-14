---
status: completed
experience: none
---

# Close coordinate domains and grid-normalization boundaries

## Goal

Make grid alignment a current-only Project invariant and prevent preview or
derived float geometry from entering persisted Documents, typed edits, history,
or camera state. This target replaces the accidental shared `Point`/`Rect`
contract with explicit grid, preview, derived, symbol-local, and camera
boundaries.

## State and Ownership

Start state in the isolated worktree from `git status --short --branch`:

```text
## codex/coordinate-domain-contract
```

The primary workspace contains unrelated uncommitted robust-recovery changes
to `apps/editor/package.json` and `pnpm-lock.yaml`; this target uses a clean
worktree at the `main` merge commit and will not edit or stage those paths.

This target owns:

- `docs/adr/0021-coordinate-domains-and-grid-normalization.md`
- `docs/adr/README.md`
- `docs/specs/schematic-model.md`
- `docs/specs/edit-engine.md`
- `docs/specs/editor-interaction.md`
- coordinate schemas/types/helpers and their tests in `packages/model/`
- derived drafting, annotation, renderer, and Agent Snapshot coordinate
  contracts required to remove `Point`/`Rect` misuse
- editor camera, preview, fit/focus/zoom/pan code and focused tests
- Edit Engine grid validation and focused regressions
- `plan/log.md` and this plan

Read-only dependencies:

- symbol catalog geometry: local artwork remains finite-number geometry and is
  not Project page geometry;
- existing Project fixtures: current-only persistence means non-grid authored
  geometry is invalid rather than silently migrated;
- generated Agent OpenAPI/resources: regenerate only through existing project
  commands if the schema output changes.

## Frozen contract

1. Every persisted page `Point` in a Document and every typed edit carrying
   one is an integer multiple of `document.presentation.grid`.
2. Camera is a `GridRect`: origin and extents are positive grid-aligned
   integers. Fit converts derived bounds outward; pan, zoom, focus, document
   activation, and Agent semantic fit normalize camera rectangles.
3. Preview/client/screen and derived visual geometry may be finite floats, but
   have distinct types and may not be written to Project state without an
   explicit conversion.
4. Symbol-local artwork remains separate finite local geometry. Scalars such
   as route `t`, normal offset, text metrics, and continuous drafting rotation
   are not page points and are not grid constrained.
5. There is no legacy Project migration path. Invalid non-grid persisted
   geometry is rejected with an exact diagnostic path; it is never silently
   rounded.

## Work

1. Record ADR 0021 and update normative model/edit/editor specifications.
2. Introduce explicit coordinate-domain schemas, types, and named conversion
   helpers. Replace the existing private drafting float schemas with the shared
   derived contract.
3. Enforce Document-grid alignment at schema/Edit Engine boundaries, including
   GUI, Agent, import/recovery, and transaction validation paths.
4. Migrate derived geometry, renderer bounds, diagnostics, and Snapshot output
   away from model `Point`/`Rect`; preserve float precision in that read-only
   domain.
5. Route all camera setters through one grid-normalization boundary and remove
   direct derived `viewBox` assignment, including Agent semantic fit.
6. Separate preview/client types from committed points and snap at every GUI
   commit boundary.
7. Add model, Edit Engine, Agent contract, and browser regressions for grid
   rejection, float-derived rendering, full camera normalization, and no
   Project-state float leaks.

## Validation

- focused model, derived, Edit Engine, Agent adapter, and editor tests
- `pnpm typecheck`
- `pnpm format:check`
- `pnpm docs:check`
- `pnpm ci:check` before delivery to `main`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
feat(model): enforce coordinate domains and grid normalization
```

## Outcome

Implemented the current-only coordinate-domain contract. Persisted page points
and camera rectangles now validate or normalize against the active Document
grid; derived/render geometry, SVG text metrics, pointer previews, and
symbol-local artwork retain finite float coordinates under distinct types.
Drafting manipulation, instance-label materialization, annotation movement,
route marker updates, imports, Agent requests, and renderer/Snapshot output
now cross the boundary through named grid conversion helpers rather than
implicit rounding. Existing current fixtures were normalized deliberately; no
legacy migration path was added.

Validation passed: complete local unit suite (115 files / 654 tests),
`pnpm typecheck`, `pnpm format:check`, `pnpm docs:check`, Agent catalog and
API artifact checks, and `git diff --check`. A clean frozen-lockfile
`pnpm ci:check` also passed static checks, unit tests, all workspace builds,
performance, and release-artifact verification; its final local Playwright
stage produced no output before the tool timeout, and a direct rerun likewise
stalled during browser startup. Remote CI remains required before any merge to
`main`.

Commit status: committed on `codex/coordinate-domain-contract`.
