# Razavi Unified MOS Presentation

## Goal

Make the selected Razavi drawing style a complete MOS presentation contract:
manual palette placement of canonical NMOS/PMOS must use the calibrated
three-terminal Razavi view, and its arrow support must end cleanly at the
triangle base. Electrical D/G/S/B connectivity remains canonical and intact.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main [ahead 1]
 M packages/render-svg/src/markup-parser.test.ts
 M packages/render-svg/src/markup-parser.ts
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? probe-conflicts.mjs
```

The modified markup-parser files and all listed untracked work are unrelated
and will not be edited. The existing `razavi-mos-ground-reference-geometry`
plan is user/other-worker owned; this target uses a separate plan and does not
modify it.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/App.test.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `scripts/generate-visio-mos-assets.mjs`
- regenerated `packages/symbols/assets/razavi-v1/{nmos,nmos3,pmos,pmos3}.symbol.json`
- regenerated `packages/symbols/assets/razavi-v1/catalog.json`
- regenerated `packages/symbols/src/razavi-catalog.generated.ts`
- regenerated `fixtures/visual-golden/visio-mos-fidelity.svg`
- `packages/symbols/src/razavi-catalog.test.ts`
- `plan/2026-08-08-razavi-unified-mos-presentation/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss` (binary source stencil)
- supplied Razavi reference image under the user temp directory
- `packages/render-svg/src/markup-parser.ts` and its test
- other workers' plans and netlist artifacts

## Shared Dependencies

- Project `Instance.symbolVariantId` contract
- canonical four-terminal MOS pin model and its `textbook-3terminal` visual
  variant
- generated Razavi symbol catalog and editor palette

## Expected Work

1. Make canonical MOS palette placement select the Razavi textbook
   three-terminal presentation, while preserving the four electrical pins.
2. Align the three-terminal source-arrow support line to the calibrated
   triangle base; regenerate catalog artifacts from the generator.
3. Add focused tests for manual-placement variant selection and for the
   source-arrow line/triangle join.

## Validation

- Focused editor and symbol Vitest files covering the new default and arrow
  topology.
- Regenerate/check the MOS catalog using the repository generator command.
- Build the editor or its direct package surface if required by TypeScript.
- `git diff --check`
- `git status --short --branch`

These checks cover the editor-to-project contract, generated catalog, and
source-arrow visual primitive without invoking unrelated full-suite work.

## Experience Signal (for human review)

The style-profile and symbol-variant distinction caused a repeated visual
regression. Human may later decide whether to extract a design lesson.

## Commit Intent

Commit as:

```text
fix(razavi): unify default MOS presentation
```

## Result

Completed. The editor now places canonical `nmos` and `pmos` with the
`textbook-3terminal` Razavi visual variant, and their palette thumbnails use
the same resolved primitives. The independent raw `nmos3`/`pmos3` VSS assets
are retained as provenance but removed from manual placement. The source-arrow
support line ends at the calibrated triangle base with a butt cap; canonical
four-terminal bulk primitives remain unchanged.

Validation passed:

- `corepack pnpm vitest run apps/editor/src/App.test.tsx packages/symbols/src/razavi-catalog.test.ts` (16 tests)
- `corepack pnpm --filter @icm/editor build`
- `corepack pnpm exec playwright test apps/editor/e2e/manual-editor.spec.ts --grep "faithful symbol previews|authors components"` (2 tests)
- `corepack pnpm symbols:visio-mos:check`
- `corepack pnpm symbols:razavi:check`
- `git diff --check`
