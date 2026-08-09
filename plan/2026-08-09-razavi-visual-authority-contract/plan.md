# Razavi Visual Authority Contract

## Goal

Separate Razavi visual authority from historical electrical provenance, mark
the already raster-calibrated resistor, capacitor, and Port correctly, and
make it impossible for an unmigrated legacy asset to qualify for the Razavi
palette.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
 M apps/editor/e2e/manual-editor.spec.ts
 M apps/editor/src/App.tsx
 M apps/editor/src/styles.css
 M docs/roadmap/text-annotation-peripheral-editing-plan.md
 M docs/specs/editor-interaction.md
 M packages/render-svg/src/drafting-render.test.ts
 M packages/render-svg/src/render.ts
 M plan/log.md
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? plan/2026-08-09-p10-editor-usability-consolidation/
?? plan/2026-08-09-razavi-fidelity-measurement-hardening/
?? probe-conflicts.mjs
```

The only remaining tracked dirty path is `plan/log.md`, owned by another
target. It remains read-only. The editor and its manual test are now clean, so
this target expands to integrate the already-committed catalog selector.

## Owned Files

- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/assets/razavi-v1/README.md`
- `packages/symbols/src/razavi-catalog.ts`
- `packages/symbols/src/razavi-catalog.generated.ts`
- `packages/symbols/src/razavi-catalog.test.ts`
- `scripts/generate-razavi-symbol-catalog.mjs`
- `docs/specs/razavi-textbook-style.md`
- `apps/editor/src/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `plan/2026-08-09-razavi-visual-authority-contract/plan.md`

## Read-Only Files

- `packages/render-svg/src/render.ts`
- `plan/log.md`
- `lib/circuit.vss`, `tools/vss-import/`, and `generate-visio-*` scripts

## Shared Dependencies

- checked-in raster reference manifests and geometry measurements
- generated `razavi-catalog.generated.ts`
- compatibility Symbol Resolver and editor palette

## Expected Work

1. Add explicit visual-authority data to the catalog while preserving archived
   electrical pin provenance separately.
2. Assign Razavi Reference authority to current calibrated assets: NMOS, PMOS,
   ground, sources, resistor, capacitor, and Port; classify the remaining
   VSS-only assets as legacy compatibility only.
3. Expose a strict Reference palette selector and test that it contains only
   eligible assets.
4. Remove VSS as a live visual-generation requirement from the catalog checker
   and document the single-authority contract.

## Outcome

Completed the catalog, generated adapter, selector, and global typography
contract. The editor palette integration is now in scope: it must replace its
direct `builtInSymbols` palette source with `razaviReferencePaletteSymbols`
when `styleProfileId === "razavi-textbook-v1"`.

## Validation

- `pnpm symbols:razavi:check`
- `pnpm exec vitest run packages/symbols/src/razavi-catalog.test.ts`
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

The generator check verifies manifest paths, hashes, and generated adapter;
the focused tests protect eligibility; typecheck covers the exported selector.

## Experience Signal (for human review)

An overloaded provenance field caused visual migration status to be inferred
from obsolete electrical evidence.

## Commit Intent

Commit as:

```text
refactor(symbols): separate Razavi visual authority from legacy provenance
```
