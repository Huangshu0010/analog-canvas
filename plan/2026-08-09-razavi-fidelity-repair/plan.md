# Razavi vector fidelity repair

## Goal

Bring the Razavi editor's rendered vectors—not just the Symbol DSL source—into
measured agreement with the sole raster authority. This pass addresses the
reported wire weight, source-circle and route-current-arrow scale, typography,
and the MOS channel-to-lead right-angle joins. Electrical pin locations,
connectivity, and the shared semantic text model must remain unchanged.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
 M apps/editor/src/App.tsx
 M apps/editor/src/styles.css
?? apps/editor/src/recovery-scheduler.test.ts
?? apps/editor/src/recovery-scheduler.ts
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? plan/2026-08-09-gui-modernization/
?? plan/2026-08-09-razavi-fidelity-measurement-hardening/
?? probe-conflicts.mjs
```

Those files are owned by concurrent editor/recovery/layout work. This target
will not edit, stage, or revert them. It may only read shared renderer and
catalog contracts. Stop if another target starts editing the same style profile,
fidelity harness, raster authority, or MOS catalog assets.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/*-geometry.json` and
  `manifest.json`, only for new measured crop/scale metadata and its hashes
- supplemental reference crops and their manifest entries, when a supplied
  screenshot is the evidence
- `scripts/razavi-fidelity-diff.mjs` and `scripts/lib/razavi-fidelity.mjs`
- `scripts/lib/symbol-rasterize.mjs` and new focused fidelity helpers/tests
- `packages/derived/src/style-profile.ts` and its focused tests
- `packages/symbols/assets/razavi-v1/{nmos,pmos,nmos3,pmos3,voltage-source,current-source}.symbol.json`, their source generators when applicable, catalog hashes, and generated catalog output
- `packages/symbols/src/razavi-catalog.ts`, if an existing generator-owned
  catalog field must be represented in its public generated-entry contract
- `packages/render-svg/src/{render.ts,schematic-text.ts}` and focused tests,
  only if rendering cannot express the measured contract through existing DSL

## Read-Only Files

- `fixtures/visual-reference/razavi-reference-v1/razavi-six-panel.png` and
  archived supplemental reference PNGs: evidence, never rewritten
- `lib/circuit.vss`: retired binary archive, not visual authority
- Project fixtures/netlists, edit engine, connectivity model, and SPICE parser
- unrelated in-progress editor/recovery files listed above

## Shared Dependencies

- `razavi-textbook-v1` profile: `wire`, `normal`, `symbol`, and typography
  tokens are consumed by every formal export and the editor canvas.
- Symbol DSL stroke semantics: an asset must use semantic roles unless a new
  role is justified for the whole style contract; do not insert per-symbol raw
  widths merely to win one screenshot.
- The generated catalog is the runtime asset source. Any asset edit requires
  its catalog hash, generator run, and Symbols build.
- The comparison must rasterize the same formal SVG path used by product
  rendering. A raw SVG approximation or a browser screenshot at an arbitrary
  zoom is not an acceptance oracle.
- Semantic labels remain shared text (`power-label`, `net-label`,
  `instance-label`); no text paths or per-symbol label artwork.

## Measurement and Acceptance Rules

1. Establish one `pixelsPerLogical` per *reference image* from a recorded,
   stroke-independent length anchor: for example the filled VDD bar's measured
   end-to-end width against its 20 logical-unit asset contract, or an explicit
   pin-to-pin/grid distance. The current UI's stroke width is never a scale
   input. All crops from that image inherit the resulting scale; individual
   symbols may not silently choose another scale.
2. Each crop stores origin, asymmetric window, expected parts, and reference
   image path. The harness must print the image used for each device so an
   accidental six-panel/supplemental-image mix cannot create a false score.
3. Report binary IoU, soft IoU, translation lift, edge-shell ratio, and a
   per-part score. IoU is a relative iteration signal. A high translation lift
   invalidates a geometry conclusion and requires fixing registration first.
4. For thin strokes/glyphs, accept only when registration lift is effectively
   zero and residual disagreement is an edge shell; do not chase rasterizer
   anti-aliasing with geometry changes.
5. Add structural/vector assertions beside pixel tests: shared elbow endpoints
   must either coincide exactly or overlap by at least half the rendered stroke
   width; an elbow-window mask must contain no white gap between connected arms.

## Expected Work

## Progress (2026-08-09)

- Added `formal-route-wire`, a real formal-route crop from the archived
  `current-port-reference.png`; the harness now prints the actual reference
  path used per device.
- The reference Vin lead has two thresholded core rows. At its locked 1.39
  pixels/logical scale, the prior 1.6 wire token produced three rows; 1.25
  produced one. A 1.28 candidate was tested but rejected by human GUI review:
  it looked thinner than the reference in the actual editor. The production
  token is restored to 1.6. Future wire calibration must compare a recorded
  browser/editor capture at the relevant zoom as well as formal SVG output.
- Baseline reports show the voltage/current source currently contain more
  thresholded ink than their reference crops, so the reported visually-small
  circle must be separated into radius, stroke, and GUI scale diagnostics
  before any geometry is enlarged.
- Human review requested a pure-black formal comparison. The shared Razavi
  `foreground` token is changed from `#202020` to `#000`; it intentionally
  covers routes, symbols, nodes, and semantic text together, while retaining
  white background and editor-only overlay colors.
- With the shared `normal` role already equal to the approved `wire: 1.6`, the
  MOS generator now closes channel-to-gate and channel-to-D/S seams by one
  reference pixel under adjoining opaque/stroked geometry. This is not a pin
  move or an externally visible channel-length increase.
- Human review identified insufficient vertical separation between base glyphs
  and subscripts. The shared semantic typography token moves subscripts from
  `0.28em` to `0.36em` downward; this affects every parsed math label without
  introducing symbol-local text geometry.

### 1. Establish the common render-scale, then fit the wire baseline

1. Record a stroke-independent scale anchor in the authority metadata (the
   exact raster endpoints and the intentional logical distance). Lock one
   `pixelsPerLogical` value from that relation before evaluating any stroke.
2. Add a straight-wire crop to the authority metadata and make the harness
   render a real route through `renderDocumentSvg` at that locked scale.
3. Measure the reference wire's black-core width and anti-aliased fringe. The
   current UI result is merely the first candidate. Fit `strokes.wire` from the
   reference pixel width divided by the locked scale, then compare the actual
   SVG output.
4. Compare the resulting wire width against `normal` symbol strokes. If the
   reference uses one visual weight, express that equality as a profile/test
   invariant; retain distinct tokens only with measured evidence.

**Exit:** the scale anchor has zero registration ambiguity; the wire crop has
zero registration lift, and its core width/edge profile match the reference.
The fixed scale—not the fitted wire—is the control for all later crops from
that reference image.

### 2. Calibrate voltage source and route current arrow at that same scale

1. Archive/create isolated source and route-arrow crops with circle center,
   radius, outline width, shaft length, and head triangle vertices measured in
   pixels.
2. Run the existing real-SVG symbol/formal-route comparators using the common
   scale. Add per-part masks for source circle, leads, polarity, arrow shaft,
   and head, so a good total score cannot hide a small circle or arrow.
3. Correct geometry/profile tokens only after registration is stable. Source
   circles remain stroke geometry, not filled substitutes; route arrows remain
   attached annotations and must not change net connectivity.

**Exit:** circle radius/outline and arrow shaft/head dimensions are within the
measured raster tolerance; part-level diffs show only anti-alias shells.

### 3. Build a typography-specific comparator

1. Register small raster crops for `M_1`, `V_DD`, a multi-digit subscript, and
   ordinary numeric text from the authority. Each crop records baseline,
   cap-height, subscript baseline offset, and reference scale.
2. Rasterize the actual `renderSchematicTextContent` output through the formal
   renderer. Test a short, explicit candidate family/weight matrix available to
   the export runtime; choose one family by measured aggregate score, not by
   browser fallback appearance.
3. Tune shared typography tokens only: main size, math/plain weight, subscript
   scale, and baseline shift. Keep parsing semantics unchanged: `VDD` means
   italic math `V` plus upright subscript `DD`; numbers follow the existing
   instance-label rule.
4. Add SVG assertions for generated `tspan` classes and a raster regression for
   baseline separation. Do not use absolute coordinates tied to a particular
   component placement.

**Exit:** the selected font is embedded/available to both browser and formal
export; numeric glyphs and subscript gap are measured against the crop; one
profile controls every label kind.

### 4. Repair MOS right-angle joins before arrow micro-tuning

1. Generate isolated three-terminal NMOS and PMOS SVG/PNG crops at the same
   scale as their reference panel and divide them into gate bars, channel bars,
   D/S leads, source-arrow support, and arrow head.
2. For every channel-to-extension elbow, make primitives geometrically
   continuous in vector space. Prefer a single miter-joined polyline where that
   matches the artwork; otherwise overlap butt-ended members by the measured
   amount. Never alter pin anchors to hide a gap.
3. Add an elbow-window continuity test that detects a white notch after
   rasterization. Test both orientations/mirrors and both the explicit
   three-terminal assets and four-terminal variants.
4. Only after elbows pass, refine NMOS/PMOS arrow support and head polygons
   from their separate masks. PMOS is independently positioned but uses the
   same measured arrow proportions unless the reference proves otherwise.

**Exit:** no raster white notch at any D/S-channel elbow, zero or negligible
registration lift, and no changes to D/G/S/B terminal coordinates or hidden
bulk semantics.

### 5. Integration and review

1. Regenerate catalog assets, build Symbols/Derived/Render SVG/Editor, and run
   the affected unit and fidelity tests.
2. Render an OTA fixture in the GUI at 100% CSS zoom and compare only the
   recorded output image against the relevant reference; visual review is a
   final sanity check, not a source of unrecorded constants.
3. Update the plan with scores, dimensions, residual anti-alias explanation,
   and files changed. Add a factual `plan/log.md` entry only when this target
   lands, avoiding concurrent edits.

## Validation

- Every new measurement file has a matching manifest SHA-256; catalog asset
  hashes match the generated output.
- `node scripts/generate-razavi-symbol-catalog.mjs`
- focused fidelity commands for wire, voltage source, route current arrow,
  typography crops, NMOS, PMOS, and elbow continuity
- focused `vitest` tests for style profile, text renderer, symbols, and formal
  renderer; then package builds for Symbols, Derived, Render SVG, and Editor
- `git diff --check` and `git status --short --branch`

The full suite is not the first gate: this is a rendering/style target with
well-defined focused surfaces. Expand only if a shared profile or renderer
contract changes broadly.

## Experience Signal (for human review)

The VDD pass exposed a false-low score when a geometry entry was registered
against a supplemental raster but the report header still named the primary
six-panel image. The harness should surface the actual per-device reference
path before this plan is executed; the human may later decide whether this
warrants an experience note.

## Commit Intent

Commit implementation in independently reviewable slices:

```text
fix(razavi): calibrate wire and peripheral scale
fix(razavi): align semantic typography
fix(razavi): close MOS elbow joins
```
