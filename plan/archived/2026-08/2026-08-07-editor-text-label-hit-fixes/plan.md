---
status: completed
experience: none
---

# Editor Text, Label Visibility, and Hit-Target Fixes

## Goal

Fix three editor interaction defects reported during the Razavi review:

1. Added plain-text cannot be resized (font size fixed by profile).
2. Devices with no explicit label still render a default instance ID label;
   GND/VSS power ports should default to no label and be toggleable.
3. Selecting a note/text annotation conflicts with selecting a device because
   the device hit-target (r=36, transparent fill) covers the annotation
   hit-target (r=10).

## Dirty-State Note

The worktree is dirty with the ongoing `hidden-mos-terminal-correctness`
target plus unrelated OTA/CDAC/golden changes. Additionally, the entire
`packages/symbols/assets/razavi-v1/` directory carries pre-existing
uncommitted RV-6A visio-core-analog work: symbol JSONs (capacitor, diode,
ground, resistor, voltage-source, etc.) have their geometry moved to
Visio-derived float coordinates since HEAD, while `catalog.json` and
`razavi-catalog.generated.ts` at HEAD still carry the old hashes. This makes
`symbols:razavi:check` fail at HEAD already (`asset hash mismatch for
capacitor`) — a pre-existing condition this target does not own and does not
fix.

This target only adds `labelVisibility: "hidden"` to `ground.symbol.json`,
updates `catalog.json`'s ground `assetHash` to match, and adds the same field
to the ground entry in `razavi-catalog.generated.ts`. The full catalog
re-sync (all symbols' hashes + generation fields) is left to a dedicated
catalog-consistency target. `symbols:razavi:check` remains red on account of
the pre-existing capacitor mismatch; this is recorded, not caused, here.

## Owner

Primary Agent (`/root`).

## Owned Files

- `plan/2026-08-07-editor-text-label-hit-fixes/plan.md`
- `packages/symbols/src/schema.ts` (add `labelVisibility`)
- `packages/symbols/src/builtins.ts` (mark VDD/VSS default hidden)
- `packages/symbols/src/razavi-catalog.generated.ts` (if ground/voltage-source
  catalog symbols exist and should default hidden — verify before editing)
- `packages/render-svg/src/render.ts` (honor labelVisibility; honor annotation
  size override)
- `packages/render-svg/src/style-profile.ts` (if a size-scale token is needed)
- `packages/render-svg/src/schematic-text.ts` (if size attribute needs an
  override path)
- `packages/render-svg/src/render.test.ts` (assertions)
- `apps/editor/src/App.tsx` (text size control; label toggle; z-order/hit fix)
- `apps/editor/src/styles.css` (hit-target pointer-events / z-order)
- `plan/log.md`

## Read-Only Files

- model schema (`packages/model/src/schema.ts`) — Instance/Annotation schema
  intentionally unchanged; label visibility lives on the symbol, not the
  instance, per the chosen approach.
- existing symbol goldens and Project fixtures.
- SPICE parser/importer, edit-engine transaction core, agent-adapter.

## Shared Dependencies

- `SymbolDefinitionSchema` shape (consumed by resolver, renderer, catalog
  generator). Adding an optional field is backward-compatible but the catalog
  generator + checked hashes must be re-run.
- `AnnotationSchema` — adding an optional `sizeScale` field for plain-text
  resize touches Project JSON; existing Projects omit it (default 1).
- Renderer hit/z-order assumptions relied on by Playwright flows and visual
  goldens.

## Expected Work

### Fix 1 — Plain-text resize

- Add optional `sizeScale?: number` to `AnnotationSchema` (positive, default
  1 when absent). Scope to a resize only meaningful for `plain-text` (and
  possibly `figure-caption`); other kinds ignore it or clamp to 1.
- In `render.ts` plain-text branch, multiply the profile font size by
  `sizeScale ?? 1` when emitting the `font-size` attribute. For Razavi this
  means using an explicit size attribute even though `schematicTextSizeAttribute`
  normally handles it — compute `Math.round(annotationFontSize * scale)`.
- In the editor Text panel (App.tsx ~2556), add a size control (number input
  or +/- buttons) bound to the selected `plain-text` annotation's `sizeScale`.
  `applyAnnotationText` already spreads `{ ...selectedAnnotation, text }`;
  extend to include `sizeScale`.
- Default new plain-text to `sizeScale: 1` (unchanged render).

### Fix 2 — Device default-label visibility via symbol

- Add `labelVisibility: z.enum(["shown", "hidden"]).optional()` to
  `SymbolDefinitionSchema` (default `"shown"` when absent — preserves all
  existing behavior).
- Mark `powerPortSymbol("vdd"|"vss")` (builtins.ts:20) with
  `labelVisibility: "hidden"`. Also check `catalogGround`
  (razavi-catalog.generated.ts) and mark hidden if it represents a ground
  symbol.
- In `render.ts:417-419`, change the default-label decision: skip the default
  label when `resolved.definition.labelVisibility === "hidden"` OR an explicit
  instance-label exists. Keep `explicitInstanceLabels` set as-is.
- Editor: no per-instance toggle. A symbol that defaults hidden can still show
  a label if the user manually creates an instance-label (existing "Apply
  name" flow). Per-instance hide on a shown-default symbol is explicitly out
  of scope (would require an Instance schema change).

### Fix 3 — Hit-target conflict

- The annotation hit-circle (`r=10`) renders after instance hit-circles
  (`r=36`) so it is visually above, but the instance circle's `fill:
transparent` (styles.css:333) still captures pointer events across its full
  36-radius area, swallowing clicks meant for the annotation label text
  outside the 10-radius circle.
- Fix by reducing the instance hit-target's interference with annotation
  selection. Preferred approach: make the annotation hit layer capture
  pointer-events with higher priority by rendering annotations _before_
  instances is wrong (instances must remain selectable); instead, enlarge the
  annotation hit target when it overlaps an instance, or set the instance
  `hit-target` to `pointer-events: visiblePainted` with a non-transparent
  stroke-only hit (no fill capture). Evaluate: simplest stable fix is to
  change `.hit-target` to `pointer-events: stroke` (so the transparent fill
  no longer swallows clicks) and rely on the existing 2px stroke — but that
  shrinks the effective instance hit area too much. Better: split into two
  classes — instance `.hit-target` keeps transparent fill but annotations get
  a larger hit circle (`r` matching the text bbox) rendered above, OR add
  `pointer-events: all` + render annotations last. Decide during
  implementation after re-reading the overlay order.
- Verify selection still works for instances, endpoints, routes, and
  annotations after the change; run the Playwright selection flow.

### Scope decision (confirmed with user)

Approach A: symbol default only. No per-instance override, no Instance schema
change. GND/VSS symbols default to `labelVisibility: "hidden"`; all other
symbols default to `"shown"` (unchanged). A hidden-default device can still
display a label if the user manually creates an instance-label via the
existing "Apply name" flow. Out of scope: hiding a label on a symbol that
defaults shown (would require per-instance state).

## Validation

- `pnpm typecheck`
- `pnpm test` (focused: render.test.ts, symbol schema tests, editor tests)
- `pnpm build`
- `pnpm visual:phase5:check` and `pnpm export:phase7:check` (label change may
  alter goldens — if VDD/VSS symbols appear in goldens, regenerate after
  confirming the change is intended)
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`
- At least one Playwright selection flow to confirm hit-target fix

## Commit Intent

The `labelVisibility` symbol field, the power-port and Ground hidden-default
label, and the `sizeScale` annotation contract were already committed as part
of the 2026-08-08 worktree-split sequence (the symbol/catalog layer in the
group-1 visio core-analog migration `7a38734`; the annotation scale renderer
layer in `a6eeccf` / `64eefa1` / `baffb44`). This plan now lands the remaining
editor layer: the Text-panel size-scale input, the padded annotation hit
bounds that replace the fixed-radius circle, and the focused render tests.
It is committed together with the route-attached-current-arrow and
annotation-editing-and-ground-label editor-layer remnants because all three
share the same `App.tsx` working set.
