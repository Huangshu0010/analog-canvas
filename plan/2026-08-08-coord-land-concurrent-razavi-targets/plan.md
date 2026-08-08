# Land Concurrent Razavi Editor/Style/Symbol Targets

## Goal

Bring three already-complete but uncommitted targets to a green, committable
state and land them so the worktree is clean before starting the Text &
Peripheral Editing System (WP-A0) work. This is a coordination/land target,
not new feature work.

The three concurrent targets (all authored together, all validated in their
own plans):

1. `razavi-default-and-style-switch` — `razavi-textbook-v1` default for new
   Documents + undoable `set_presentation_style` edit + editor Style menu.
2. `precise-hit-targets-and-text-markup` — transformed Symbol-bounds hit
   targets + explicit `M_{1}`/`V_{DD}`/`\it{...}` markup in Razavi text +
   Text-panel subscript/italic buttons.
3. `razavi-symbol-proportion-and-stroke-calibration` — Visio-derived MOS and
   core-analog geometry regeneration + Razavi `normal` stroke 1.2→1.6.

## Dirty-State Decision

The worktree is dirty across nearly every shared contract touched by these
three targets. They were authored as a coordinated sequence but left
uncommitted. This coordination target owns only the small fixes that make the
in-flight work internally consistent, plus this plan and its log entry. It
does not introduce new behavior beyond completing the three targets' own
intent.

Investigation found exactly two consistency gaps, both "implementation moved,
stale test/switch not updated":

- `packages/render-svg/src/schematic-text.ts` now emits a `style` field on
  every parsed run; its test still asserted the old shape → 9 failures.
- `packages/render-svg/src/style-profile.ts` changed Razavi `normal` stroke to
  1.6; its test still asserted 1.2 → 1 failure.
- `packages/edit-engine/src/transaction.ts` added `set_presentation_style`,
  but `packages/agent-adapter/src/service.ts:editCategory` had no case for it
  → workspace typecheck blocked (TS2366).

No other failures: full suite 203 pass, all generation checks (`--check`) for
razavi catalog, visio-mos, and visio-core-analog pass, editor build succeeds.

Unrelated untracked paths (`probe-conflicts.mjs`,
`netlists/rlc-rf-bandpass-100mhz/**`, the CDAC audit plan) belong to other
work and are left untouched.

## Owned Files

This target owns the consistency fixes plus the land operation:

- `packages/agent-adapter/src/service.ts` (add `set_presentation_style` case)
- `packages/render-svg/src/schematic-text.test.ts` (update expected `style`)
- `packages/render-svg/src/style-profile.test.ts` (update stroke 1.2→1.6)
- `plan/2026-08-08-coord-land-concurrent-razavi-targets/plan.md`
- `plan/log.md`

It stages and commits, as four separate commits, the full file set of the
concurrent targets (listed below), which their own plans already claimed.
`apps/editor/src/App.tsx` is shared by targets 1 and 2; per the precise-hit
plan it is owned by that workstream and lands with target 2.

During landing a fourth concurrent target surfaced: `arrowhead-proportion-
calibration`, a direct continuation of target 3 that widens the MOS source
arrow. Its symbol-asset work was already folded into target 3's commit; only
its regression assertion (already in `razavi-catalog.test.ts`, committed with
target 3) and its visual-golden regeneration (three `.svg` files) remained.
The goldens were stale because they predated the widened arrow and the
in-repo `dist` used by the golden `--check` script was also stale, masking the
mismatch; rebuilding `dist` exposed it.

## Shared Dependencies

- `PresentationIntentSchema` (persisted shape, unchanged)
- `@icm/render-svg` style-profile tokens (changed by target 3)
- shared Edit Engine edit union (extended by target 1)

## Expected Work

1. Confirm the three gaps and fix the stale test expectations + the missing
   classifier case so the whole workspace is green.
2. Re-run full suite, workspace typecheck, editor build, and the three
   generation `--check` scripts.
3. Land as three commits by target, staging each target's owned file set.

## Commit Mapping

- Commit 1 (razavi-default-and-style-switch): `factories.ts`,
  `schema.test.ts`, `edit-engine/transaction.ts`,
  `edit-engine/presentation.test.ts`, `agent-adapter/service.ts`.
- Commit 2 (precise-hit-targets-and-text-markup): `render-svg/schematic-text.ts`,
  `render-svg/schematic-text.test.ts`, `apps/editor/src/App.tsx`,
  `apps/editor/src/styles.css`.
- Commit 3 (razavi-symbol-proportion-and-stroke-calibration): all
  `packages/symbols/**` changes, both `scripts/generate-visio-*.mjs`,
  `fixtures/visual-golden/visio-core-analog-fidelity.svg` and
  `visio-mos-fidelity.svg`, `render-svg/style-profile.ts`,
  `render-svg/style-profile.test.ts`, `render-svg/render.ts`,
  `render-svg/render.test.ts`. (`phase-1-manual.svg` and
  `phase-5-dense-analog.svg` were committed here in their pre-arrowhead form
  and corrected by commit 4.)
- Commit 4 (arrowhead-proportion-calibration): regenerated
  `fixtures/visual-golden/phase-1-manual.svg`,
  `phase-5-dense-analog.svg`, and `route-attached-current-arrow.svg`.

`plan/log.md` is updated to summarize all four targets plus this coordination.

## Validation

- `npx vitest run` → 203/203 pass
- `npx tsc -p tsconfig.check.json --noEmit` → clean
- `npx pnpm --filter @icm/editor build` → succeeds
- `node scripts/generate-razavi-symbol-catalog.mjs --check`,
  `generate-visio-mos-assets.mjs --check`,
  `generate-visio-core-analog-assets.mjs --check` → all pass
- `git diff --check` and `git status --short --branch`

## Commit Intent

```text
feat(editor): default Razavi style and undoable style switch
fix(render): precise hit targets and explicit text markup
feat(symbols): Visio-exact MOS and core-analog proportion calibration
style(razavi): calibrate MOS and current-source arrowheads
```
