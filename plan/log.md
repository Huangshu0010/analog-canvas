# Maintenance Log

This file records factual, accepted project maintenance history.

Use concise entries:

```text
## YYYY-MM-DD - Target title

- Target: what the work set out to do.
- Changed areas: files, directories, or subsystems changed.
- Validation: commands or review performed.
- Commit status: committed, ready to commit, not committed, or blocked.
```

Keep reusable lessons in `docs/experience/`, not in this log.

## 2026-08-08 - Calibrate Razavi geometry from supplied reference pixels

- Target: use the supplied 1204x794 six-panel Razavi reference, rather than
  visual approximation, to calibrate symbols, route-current markers, strokes,
  and typography.
- Changed areas: new `scripts/measure-razavi-reference.py`; MOS and
  independent-current generators with regenerated catalog/fidelity assets;
  Razavi route-marker token and focused catalog/style tests; Phase 1/5 and
  route-marker SVG goldens.
- Evidence: the script records reference SHA-256
  `e43454e7ff17d9df1818973e1a78c5cda71f34a5e26c4ce7ee0ba6806b81dd81` and
  measures a 3px wire, 6px VDD/gate bars, 42px MOS gate span, 14x13px MOS
  head, 20x20px independent-source head, and 23x15px route-marker head. The
  42px gate maps to 24.39567 logical units (1.7216 px/unit).
- Result: MOS arrowhead is 8.13x7.55 logical units; independent-current head
  is approximately 10.37x10.37; route-marker head is 14x9. Existing
  wire/gate ratios, GND bars, port dot, and 16px Arial bold-italic typography
  with 0.68 subscript scale already matched the reference and were retained.
- Validation: measurement script, 31 focused symbol/render tests, all three
  symbol generator checks, route-marker golden check, Phase 1/5 golden check,
  render-svg dependency build, and `git diff --check` passed.
- Commit status: pending.

## 2026-08-08 - Apply second-pass Razavi arrowhead scaling

- Target: apply the user's relative second pass: MOS arrowhead width +30% from
  the already +20% state, and independent-current-source arrowhead length +30%
  from the already +30% state.
- Changed areas: the two generator sources; regenerated Razavi MOS/current
  source assets, catalog, and fidelity boards; exact geometry regression test.
- Result: MOS total head-width scale is 1.56× Visio baseline. The independent
  current-source head is 1.69× baseline length, has unchanged 1.15× baseline
  width, and retains its shaft/base endpoint at `y=0.608268`.
- Validation: MOS/core-analog/Razavi generator checks and 20 focused symbol
  tests passed; `git diff --check` passed.
- Commit status: pending.

## 2026-08-08 - Calibrate MOS and independent-current-source arrowheads

- Target: widen the Razavi MOS source-arrow heads by 20%, and lengthen/widen
  only the independent-current-source filled arrowhead by 30%/15%.
- Changed areas: generator-owned Razavi MOS/current-source assets and catalog
  output (committed concurrently in `16ed903`), plus the exact catalog
  regression assertion.
- Result: MOS arrow heads retain their source/tip/host geometry but have
  1.20× half-width. The independent-current source retains its arrow shaft and
  base at `y=0.608268`; its head is now 8.145473 units long and 10.268504 units
  wide, versus 6.265749 and 8.929134 before calibration.
- Validation: MOS, core-analog, and Razavi generator checks passed; focused
  symbols tests passed (20/20); `git diff --check` passed.
- Commit status: pending the standalone regression/plan record commit.

## 2026-08-06 - Bootstrap repository workflow

- Target: initialize the circuit asset project as a GitHub repository and
  adopt the plan-log-experience workflow from `agent-workflow-kernel`.
- Changed areas: added project documentation, repository-wide Agent rules,
  plan and experience templates, Git attributes, and the initial project
  assets under `lib/` and `netlists/`.
- Validation: `git diff --check` passed; every SPICE `.subckt` had a matching
  `.ends`; every local `.include` resolved; required workflow sections were
  confirmed; repository scope and status were reviewed.
- Commit status: ready to commit as `Initialize circuit project workflow` and
  push to the private `chenzc24/interactive-circuit-maker` repository.

## 2026-08-06 - Document overall circuit canvas architecture

- Target: consolidate the product definition and design discussion into one
  overall implementation plan for the AI/human collaborative circuit canvas.
- Changed areas: added `docs/overall-product-plan.md` and its bounded target
  plan under `plan/2026-08-06-document-overall-product-plan/`.
- Validation: confirmed balanced Markdown fences and required architecture
  contracts; reviewed headings and terminology; `git diff --check` passed.
- Commit status: ready to commit as
  `Document overall circuit canvas architecture`.

## 2026-08-07 - Define the default schematic graphical language

- Target: refine the overall plan so free manual page layout is preserved
  while human- and AI-created wires, junctions, labels, and electrical
  annotations share a textbook-style monochrome rendering contract.
- Changed areas: expanded `docs/overall-product-plan.md` and added the bounded
  target plan under `plan/2026-08-07-refine-default-schematic-style/`.
- Validation: confirmed balanced Markdown fences and numbered headings;
  verified theme, route, junction, annotation, overlay/export, renderer,
  visual-regression, phase, and MVP contracts; `git diff --check` passed.
- Commit status: ready to commit as
  `Define default schematic graphical language`.

## 2026-08-07 - Flatten overall circuit canvas architecture

- Target: simplify the overall product plan by separating build-time symbol
  production, import-time SPICE parsing, and runtime editing; reduce exposed
  protocols and physical project files without removing accepted behavior.
- Changed areas: rewrote `docs/overall-product-plan.md` around a five-component
  external model, Project-to-Document persistence, seven protocol operations,
  GUI-driven human edits, transient parser artifacts, and a minimal user
  project layout; added the bounded target plan under
  `plan/2026-08-07-flatten-overall-product-plan/`.
- Validation: confirmed balanced Markdown fences and required full-SPICE,
  junction/crossing, VSS isolation, GUI/Edit Engine, protocol, file-layout,
  visual-language, validation, and MVP contracts; `git diff --check` passed.
- Commit status: ready to commit as
  `Flatten overall circuit canvas architecture`.

## 2026-08-07 - Establish phased execution documentation

- Target: turn the accepted architecture into a navigable, staged execution
  system with complete Phase 0–7 plans and durable homes for normative specs,
  Agent guidance, and architecture decisions.
- Changed areas: added `docs/README.md`; added roadmap index, phase template,
  and substantive Phase 0–7 plans; added specification, Agent, and ADR indexes
  and templates; updated the repository README; added the bounded target plan
  under `plan/2026-08-07-establish-execution-docs/`.
- Validation: confirmed all eight phase files contain every required planning
  section; all relative Markdown links resolve; all Markdown fences are
  balanced; no application source scaffold was created; `git diff --check`
  passed.
- Commit status: ready to commit as
  `Establish phased execution documentation`.

## 2026-08-07 - Complete Phase 0 contracts and scaffold

- Target: satisfy the Phase 0 exit gate with a runnable TypeScript workspace,
  stable Project/Document and identity contracts, canonical persistence,
  transaction/revision semantics, transient Circuit IR, a Symbol Resolver, and
  isolated Reference governance.
- Changed areas: added the React editor shell; model, edit-engine, spice, and
  symbols packages; Project fixtures; pinned Reference manifest and scripts;
  focused CI; accepted Phase 0 specs and ADRs; and Phase 0 completion evidence.
- Validation: frozen install, formatting, immutable Reference checks,
  TypeScript typecheck, 30 tests in eight files, workspace build, direct ESM
  runtime smoke, Reference fetch failure/idempotence checks, Markdown link and
  fence checks, product/reference coupling inspection, and `git diff --check`
  passed.
- Commit status: ready to commit as `Complete Phase 0 contracts and scaffold`.

## 2026-08-07 - Complete Phase 1 core editor slice

- Target: satisfy the Phase 1 exit gate with a browser-based manual editor that
  commits typed placement and transform edits, supports monotonic history and
  canonical save/reopen, and exports deterministic formal SVG.
- Changed areas: expanded the Edit Engine and added Document history; added
  eight provisional built-in symbols and `packages/render-svg`; replaced the
  editor shell with a native-SVG canvas and controls; added Project/SVG
  fixtures, visual/edit specifications, Playwright coverage, and CI wiring.
- Validation: frozen install, formatting, immutable Reference checks,
  TypeScript typecheck, 41 tests in 11 files, workspace build, one complete
  Playwright GUI flow, browser DOM/geometry/console review, Markdown link and
  fence checks, `git diff --check`, and repository status review passed.
- Commit status: ready to commit as `Complete Phase 1 core editor slice`.

## 2026-08-07 - Complete Phase 2 SPICE import

- Target: import every current SPICE source set into transient Circuit IR and
  persistent unplaced Documents without silent statement, hierarchy, terminal,
  parameter, model, or connectivity loss.
- Changed areas: added source, syntax, include, diagnostic, compiler, Node
  adapter, and importer modules under `packages/spice`; added dynamic
  pin-count-matched generic symbols; connected browser multi-file import; added
  source, Project, and seven-entry corpus goldens; accepted the SPICE frontend
  profile and advanced the IR contract.
- Validation: frozen install, formatting, immutable Reference checks,
  TypeScript typecheck, 49 tests in 15 files, all seven entries/24 cells/127
  instances against connectivity hashes, canonical imported Project golden,
  workspace build, two Playwright flows, browser DOM/geometry/console review,
  Markdown link and fence checks, product/reference coupling inspection,
  `git diff --check`, and repository status review passed.
- Commit status: ready to commit as `Complete Phase 2 SPICE import`.

## 2026-08-07 - Complete Phase 3 connectivity and routing

- Target: complete explicit visible connectivity, deterministic flightlines,
  manual orthogonal routing, Junction/crossing semantics, local stretch,
  protected geometry, detach behavior, and formal route rendering.
- Changed areas: added `packages/derived`; extended the model, Edit Engine,
  history, renderer, and editor; added routing specifications, canonical
  Project/SVG fixtures, unit/integration tests, and Playwright acceptance.
- Validation: frozen install, formatting, immutable Reference checks,
  TypeScript typecheck, 61 tests in 17 files, workspace build, three complete
  Playwright flows, browser DOM and visual inspection, Markdown link/fence
  checks, product/reference coupling inspection, and `git diff --check`
  passed.
- Commit status: ready to commit as
  `Complete Phase 3 connectivity and routing`.

## 2026-08-07 - Complete Phase 4 full SPICE baseline

- Target: replace the fixture-only parser label with an explicit, lossless,
  structurally broad SPICE3/ngspice compatibility baseline.
- Changed areas: accepted ADR 0004; expanded syntax, source dependency,
  expression, dialect, compiler, IR, importer, and exact-printer modules; added
  a machine-readable ngspice 46 matrix and minimized baseline/vendor corpus.
- Validation: frozen install, formatting, immutable Reference checks,
  TypeScript typecheck, 67 tests in 18 files including 256 deterministic fuzz
  samples and all current netlists, workspace build, four Playwright
  regressions, Markdown link/fence checks, product/reference coupling
  inspection, and `git diff --check` passed.
- Commit status: ready to commit as `Complete Phase 4 full SPICE baseline`.

## 2026-08-07 - Complete Phase 5 symbols and visual quality

- Target: replace provisional symbols and text-only presentation with a
  reviewed VSS-to-Symbol-DSL pipeline, semantic presentation edits, measurable
  visual diagnostics, and a stable original analog golden.
- Changed areas: added VSS inventory/review tools and evidence; expanded the
  symbol library, SPICE symbol mapping, model validation, Edit Engine,
  diagnostics, SVG renderer, editor demo, and visual fixtures/specifications.
- Validation: source hash and 101-master inventory, 12-family contact sheet,
  frozen formatting/type/test/build gates, 73 tests in 20 files, five
  Playwright flows, browser DOM and visual inspection, deterministic dense SVG,
  Markdown link/fence checks, runtime-Visio/reference coupling inspection, and
  `git diff --check`.
- Commit status: ready to commit as
  `Complete Phase 5 symbols and visual quality`.

## 2026-08-07 - Complete Phase 6 Agent API

- Target: expose bounded Agent inspection, atomic editing, and visual review
  through four transport-independent operations and an optional normal JSON
  API, with no MCP.
- Changed areas: accepted ADR 0005 and the Agent API spec; added the
  `agent-adapter` package, query describer, permission/budget enforcement,
  Edit Engine transaction bridge, render artifacts, authenticated loopback
  adapter, checked JSON Schema/OpenAPI artifacts, fixtures, and Agent guidance.
- Validation: frozen install, formatting, immutable references, typecheck, 80
  tests in 22 files including direct-engine parity and live loopback HTTP,
  workspace build, deterministic API/symbol/visual artifact checks, five
  Playwright flows, Markdown structure, no-MCP coupling inspection, and
  `git diff --check`.
- Commit status: ready to commit as `Complete Phase 6 Agent API`.

## 2026-08-07 - Complete Phase 7 release hardening

- Target: turn the editing and Agent foundations into a versioned, recoverable,
  exportable, measured, and locally installable v0.1 release candidate.
- Changed areas: added formal exporters and cross-format goldens; text-aware
  render bounds; Node atomic storage and recovery; canonical browser open/save,
  recovery and diagnostics UI; LTspice/Xyce profiles; performance budgets;
  PWA assets; loopback host; release packaging, smoke, CI, and user/release
  documentation.
- Validation: frozen install, formatting, four pinned references, three Agent
  API artifacts, 12 symbol previews, Phase 5/7 visual goldens, PDF metadata and
  rendered-page inspection, TypeScript, 89 tests in 26 files, 500-instance
  performance budgets, workspace/release builds, loopback release smoke, eight
  Playwright flows, 65 Markdown files, no-MCP package inspection, and
  `git diff --check` passed.
- Commit status: ready to commit as `Complete Phase 7 release hardening`.

## 2026-08-07 - Plan Phase 8 interaction redesign

- Target: consolidate the reviewed toolbar, shortcut, viewport, selection,
  manual component authoring, direct wiring, automatic junction/crossing, and
  VSS symbol-fidelity changes without rewriting the completed Phase 0-7
  implementation history.
- Changed areas: added a proposed editor interaction contract and a dependency-
  ordered Phase 8 roadmap; indexed both documents and recorded the bounded
  planning target.
- Validation: Prettier check passed for all six changed Markdown files; local
  Markdown links resolved, fenced code blocks balanced, and
  `git diff --check` passed.
- Commit status: ready to commit as `Plan Phase 8 interaction redesign`.

## 2026-08-07 - Complete Phase 8 direct manipulation

- Target: replace the validation toolbar with a compact direct-manipulation
  editor that can author topology from a genuinely empty Project while keeping
  GUI and Agent mutations on one semantic transaction boundary.
- Changed areas: added instance/connectivity Edit Engine operations and Agent
  schemas; atomic group stretch; an empty production workspace; searchable
  component placement; direct selection, movement, wiring, automatic
  Junction/Crossing behavior, dogleg manipulation and contextual deletion;
  compact grouped menus; VDD/VSS symbols; and revised contracts/user guidance.
- Validation: frozen install, formatting, four pinned references, TypeScript,
  96 tests in 28 files, workspace build, three Agent API artifacts, 12 reviewed
  symbol previews, Phase 5/7 goldens, PWA icons, performance budgets, release
  packaging/smoke, seven Playwright flows, 1440x900 browser review, production
  inventory/coupling inspection, Markdown checks, and `git diff --check`.
- Known compatible follow-ups: persisted shortcut remapping, free-standing
  wire endpoints, and general multi-elbow handles.
- Commit status: ready to commit as `Complete Phase 8 direct manipulation`.

## 2026-08-07 - Close schematic authoring fidelity gaps

- Target: close the four observed gaps in VSS appearance and palette previews,
  copy/paste, semantic text/labels, and routed multi-object movement.
- Changed areas: normalized reviewed MOS and VDD geometry; added 13 explicitly
  provisional VSS migration candidates and 27 palette previews; added atomic
  routed-subgraph copy/paste, typed Junction movement and Net naming, editable
  instance/Net/plain text, bounded label handles, and internal route/Junction
  translation; updated Agent artifacts, visual/export goldens, specifications,
  user guidance, and deterministic Playwright loopback proxy bypass.
- Validation: formatting, four pinned references, TypeScript, 101 tests in 29
  files, 10 Playwright flows, three Agent artifacts, 12 reviewed plus 13
  candidate symbol previews, Phase 1/5/7 visual/export goldens, visual PNG
  inspection, performance budgets, PWA icons, release packaging/smoke,
  Markdown links/fences, runtime VSS isolation, immutable VSS hash, and
  `git diff --check` passed.
- Commit status: ready to commit as
  `Close schematic authoring fidelity gaps`.

## 2026-08-07 - Prevent stale PWA cache in development

- Target: prevent a previously installed production PWA worker from making a
  fresh local Vite process appear to serve the old editor.
- Changed areas: development startup now unregisters stale service workers and
  reloads once when necessary; production registration is unchanged.
- Validation: TypeScript, workspace build, 10 Playwright flows, formatting,
  and `git diff --check` passed.
- Commit status: ready to commit as `Prevent stale PWA cache in development`.

## 2026-08-07 - Expand direct wire editing

- Target: add custom-IC-style free wire termination, per-segment movement, and
  safe deletion of connected components.
- Changed areas: added transient multi-bend Wire sessions and free Junction
  endpoints; selectable perpendicular Route-segment stretch; composed
  connected-instance deletion that preserves dangling wires; additive
  `add_junction.createNet` engine/Agent schema support; and revised interaction,
  routing, engine, Agent, and user contracts.
- Validation: formatting, four pinned references, three Agent artifacts,
  TypeScript, 105 tests in 31 files, 12 Playwright flows, workspace/release
  build, performance budgets, export goldens, PWA icons, release smoke,
  Markdown links/fences, and `git diff --check` passed.
- Commit status: ready to commit as `Expand direct wire editing`.

## 2026-08-07 - Record rule-guided Agent layout architecture

- Target: preserve the current design discussion for scaling Agent-assisted
  schematic expression from small examples to hierarchical 100+ transistor
  circuits without expanding the external API or weakening electrical gates.
- Changed areas: added a proposed Agent architecture document covering the PDK
  symbol registry, transient Topology View and Layout Intent, composable
  topology patterns, recursive region planning, Net-class routing, flat API
  additions, Document navigation, persistence boundaries, package layout,
  acceptance criteria, delivery order, and unresolved decisions; indexed it
  from the Agent guide.
- Validation: Prettier completed for the four owned Markdown files, local
  Markdown links resolved, fenced code blocks balanced, and `git diff --check`
  passed.
- Commit status: not committed; retained as a proposed discussion record for
  further human review.

## 2026-08-07 - Flatten Agent reasoning and prepare Phase 9

- Target: incorporate the architecture review by keeping circuit/layout
  interpretation inside the Agent while supplying complete Document facts as a
  read-only Snapshot and retaining typed transactions, rendering, actionable
  diagnostics, and optional late-stage helpers.
- Changed areas: replaced the formal Layout Intent/compiler proposal with an
  adaptive Snapshot-driven Agent workflow; removed the proposed generic query
  language; reduced Agent-facing guidance to a governing Skill plus on-demand
  knowledge; documented large-circuit, refresh, PDK, hierarchy, file-flow, and
  package boundaries; and reordered Phase 9 so baseline/Skill vertical trials
  precede product-gap closure and optional acceleration.
- Validation: Prettier completed for all seven owned Markdown files; local links
  resolved, fenced code blocks balanced, `git diff --check` passed, and the
  final dirty-state review confirmed unrelated editor, symbol, fixture, circuit,
  tool, and plan work remained untouched.
- Commit status: not committed; ready for human review before Phase 9 contract
  work begins.

## 2026-08-07 - Complete CDAC hierarchy layout

- Target: complete the previously generated Razavi-style CDAC example by
  drawing its imported `scdac_unit` hierarchy and clearing the top-level RESET
  label/wire overlap.
- Changed areas: extended the deterministic Agent-layout runner to transact on
  and optionally export multiple imported Documents; added a transistor-level
  two-stage CMOS bottom-plate driver with conventional stacked inverter
  geometry and local source/bulk ties; moved XRESET into a separate right-side
  vertical channel with local source/bulk tie; regenerated the editable Project
  and top-level/unit SVG, PNG, and PDF artifacts.
- Validation: the real SPICE import, typed dry-run/commit, Project validation,
  and formal export chain completed in six transactions; both Documents report
  zero unplaced instances; top-level and unit PNGs were visually inspected;
  Prettier and final repository hygiene checks completed.
- Commit status: not committed; retained in the ongoing CDAC/Agent-layout
  working set.

## 2026-08-07 - Render faithful hierarchical ports

- Target: preserve `.subckt` interfaces exactly while replacing generic
  positional hierarchy blocks with transient Project-derived symbols whose
  electrical terminals and visible pin names use the formal SPICE ports.
- Changed areas: bound subcircuit import now assigns stable hierarchy symbol
  IDs and formal terminal names; the symbol package derives named blocks from
  Document source bindings and ports; SVG rendering displays upright pin names;
  editor and Agent layout use Project-aware resolvers; CDAC routes now address
  `bit/nbit/bot/vss/vdd`; corpus and crossing goldens plus focused tests were
  updated; main and child CDAC artifacts were regenerated.
- Validation: formatting and TypeScript passed; workspace build passed; 110
  unit tests passed; 13 unaffected Playwright flows passed in the full run and
  the one updated SPICE-import flow passed on focused rerun; CDAC import,
  six typed transactions, Project validation, and two formal exports passed;
  both PNGs were visually inspected; the generated project has zero generic
  instances and formal XU terminal names while `circuit.spi` remains unchanged;
  final diff/status hygiene checks passed.
- Commit status: not committed; retained for review with the ongoing editor,
  symbol, and CDAC changes.

## 2026-08-07 - Prototype flattened CDAC view

- Target: compare the hierarchy-block presentation with an alternate top-level
  view that expands all six `scdac_unit` instances without modifying SPICE.
- Changed areas: added a standalone flattened CDAC recipe that retains a cloned
  hierarchical source Document, derives 24 prefixed MOS instances into the
  selected top Document, maps every child formal-port Net back to its parent
  Net, lays out six repeated two-inverter cells under the capacitor array, and
  emits a distinct editable Project plus SVG/PNG/PDF artifacts. After the first
  compact draft was rejected visually, the repeated-cell pitch and vertical
  bands were rebuilt, capacitor branches received independent routing channels,
  and all MOS devices changed to the textbook three-terminal visual variant
  while retaining their electrical bulk terminals.
- Validation: SPICE import, six typed transactions, Project validation, and
  formal export passed; the flattened top has 32 placed instances, 24 expanded
  unit MOS devices, 141 routes, 64 Junctions, no XU block instances, and no
  generic symbols; all 96 expanded child terminals match the parent hierarchy,
  and all 25 MOS bulk terminals remain connected to their original VDD/VSS
  Nets. Visual diagnostics report zero errors or warnings after eliminating six
  ambiguous VDD/capacitor junctions, and the revised PNG was visually inspected;
  formatting and final diff/status hygiene checks passed.
- Commit status: not committed; retained as an alternate visual prototype for
  comparison with the hierarchical CDAC output.

## 2026-08-07 - Keep MOS arrow in three-terminal variant

- Target: correct the textbook three-terminal MOS presentation after review
  showed that hiding the bulk lead also removed the NMOS/PMOS direction arrow.
- Changed areas: separated the `mos-arrow` primitive from the hideable
  `bulk-lead`, prevented dedicated `nmos3`/`pmos3` symbols from inheriting a
  duplicate arrow, added focused regression assertions, and regenerated the
  flattened CDAC artifacts. Electrical `B` pins and their VDD/VSS Net bindings
  remain present while only the bulk lead is hidden. After user clarification,
  the arrow geometry was moved from the channel center onto the source branch:
  rendered top PMOS arrows point left and bottom NMOS arrows point right.
- Validation: the seven focused built-in-symbol tests passed; the symbol package
  built; the flattened recipe completed import, six typed transactions, Project
  validation, and formal export; the PNG was visually inspected with one visible
  source-branch direction arrow per MOS and no duplicate arrows.
- Commit status: not committed; retained with the current CDAC prototype for
  user review.

## 2026-08-07 - Use migrated MOS variant geometry

- Target: replace the rejected hand-adjusted MOS arrow with the repository's
  existing VSS-migrated three-terminal geometry while preserving canonical
  four-terminal SPICE connectivity.
- Changed areas: restored the reviewed NMOS4/PMOS4 default bulk-arrow geometry;
  extended visual variants with presentation-only additional primitives; made
  `textbook-3terminal` hide the bulk lead and reuse the `nmos3` source arrow plus
  the orientation-normalized `pmos3` source arrow; added focused schema,
  builtin, and renderer coverage; updated the Symbol DSL contract and the two
  circuit goldens that consume the variant; regenerated the flattened CDAC
  Project and formal exports. The VSS review manifest and both VSS contact-sheet
  goldens were not changed.
- Validation: 126 workspace tests passed; workspace typecheck and build passed;
  the 12 reviewed and 13 migration-candidate symbol previews passed their
  deterministic review check; both Phase 1/5 circuit goldens passed; the CDAC
  import, six typed transactions, Project validation, and exports passed. All
  25 MOS instances resolve the variant and retain 25 `B` Net terminals; all 96
  flattened child-terminal mappings match the hierarchy; visual diagnostics
  are empty; `circuit.spi` has no diff; and the PNG was visually inspected.
- Commit status: not committed; retained with the current CDAC prototype for
  user review.

## 2026-08-07 - Local-power textbook CDAC layout

- Target: restyle the flattened CDAC routing after the supplied Razavi examples
  by using vertical CMOS stacks, local power symbols, short signal paths, and
  only the electrically necessary shared VOUT rail.
- Changed areas: added six local VDD/ground helper pairs plus dedicated grounds
  for the dummy capacitor and reset device; bound all helpers to the existing
  VDD/VSS Nets; removed the page-spanning VDD/VSS routes; stacked each PMOS over
  its NMOS; separated input, inter-stage, output, and capacitor channels; moved
  device labels beside their symbols; corrected each second-stage gate branch
  so its external route terminates outside the MOS lead instead of overlaying
  it; reduced cell pitch from 340 to 300 units and compacted the vertical power,
  device, capacitor, and reset bands; regenerated the editable Project and
  SVG/PNG/PDF exports. The source SPICE and symbol library were not changed.
- Validation: SPICE import, five typed transactions, Project validation, and
  formal export passed; the top has 46 placed instances including 14 resolved
  local-power helpers, 127 routes, and 50 Junctions. All helpers bind to exactly
  one VDD/VSS Net; no global VDD/VSS port routes remain; all 25 MOS instances
  retain the migrated visual variant and 25 bulk terminals; all 96 expanded
  child-terminal mappings match the hierarchy; visual diagnostics are empty;
  `circuit.spi` has no diff; and the PNG was visually inspected.
- Commit status: not committed; retained as the current visual prototype for
  user review.

## 2026-08-07 - Implement Snapshot-driven Agent workflow

- Target: execute Phase 9 with a flat complete-Snapshot Agent boundary, a thin
  governing Skill plus on-demand knowledge, generic typed edits, actionable
  diagnostics, and shared human/Agent revision and lock semantics.
- Changed areas: accepted Agent API v2/Snapshot ADR and schemas; added
  deterministic Project Index and complete bidirectional Document Snapshot;
  retained v1 query only for compatibility; added SKY130 and exact PDK symbol
  mappings, atomic symbol remap and port edits, spatial diagnostics, editor
  Document navigation/diagnostic jump/handoff, the `circuit-layout` Skill and
  ten routed knowledge documents, checked RLC/CDAC recovery traces, and
  128/500-instance generalization/performance evidence. Measured traces did not
  justify a query DSL, Layout Intent, topology classifier, or optional helper.
- Integration repair: updated four dense-analog Route/Junction coordinates and
  regenerated Phase 5/7 goldens after the preceding MOS migration moved formal
  pin positions; the final visual review restored orthogonal routes while
  retaining the migrated source arrows.
- Validation: formatting and typecheck passed; 127 tests in 33 files and all 14
  Playwright flows passed; three Agent API artifacts, Snapshot/audit/replay,
  Skill package/links/ownership, PDK/import, Phase 1/5/7 visual/export goldens,
  12 reviewed plus 13 candidate symbol previews, four pinned references, and
  both legacy and Phase 9 performance budgets passed. The 128-instance complete
  Snapshot is 289,373 bytes and the 500-instance Snapshot is 1,126,592 bytes;
  both flows use zero v1 queries and no helper.
- Remaining external gate: four isolated real-Agent guidance tiers and an
  independent blinded readability review. The repository records the protocol
  and deterministic package/context ablation but deliberately does not invent
  model-quality scores. A reproducible kit now generates isolated, hashed tier
  contexts; rejects incomplete, electrically changed, lock-violating,
  query/helper-dependent, or unrefreshed results; anonymizes renders; and
  aggregates blind scores. Its full prepare/finalize/score path and negative
  cases pass a temporary-directory self-test. Phase 9 roadmap status is
  `review` until real external runs and scores complete.
- Architecture clarification: the roadmap, final architecture, product plan,
  knowledge plan, and execution plan now explicitly define the Agent as the
  semantic reasoning/layout layer. Complete Snapshot is the fact-transfer
  boundary; the two runtime document layers are the lifecycle Skill and
  on-demand circuit knowledge. Agent-local regions, pattern hypotheses,
  coordinates, and route plans are neither a query language nor a persisted
  Layout Intent. Product capability expansion follows vertical-trial evidence.
- Held-out closure: added a post-knowledge-freeze hierarchical 4-bit Flash ADC
  with 15 comparator references, 135 elaborated MOS devices, and a 16-resistor
  ladder. Its two Documents import with zero generic symbols or errors; the
  dedicated generator pins Snapshot sizes/hashes and the main SPICE corpus now
  pins its 40 direct instances and connectivity hash. Added the neutral task,
  evidence page, and a fresh local `v2` four-tier kit whose contract requires a
  final derived Snapshot for every Document. The older local `v1` kit is
  explicitly non-canonical.
- Final deterministic regression: 127 tests in 33 files, 14 Playwright flows,
  typecheck, formatting, build/release smoke, four references, 25 symbol
  previews, Phase 1/5/7 visual/export artifacts, API schemas, all Phase 9
  audits/replays/performance reports, three held-out regenerations, evaluation-pipeline
  negative tests, and Phase 9 documentation links/fences pass.
- External-study outcome: two real isolated four-tier runs passed electrical,
  revision, Snapshot, placement, render, and diagnostic hard checks, but the
  guidance tiers did not reliably match the API-only Agent's blind readability.
  A third structurally different differential-feedback fixture was frozen and
  validated, then its model run was stopped as nonessential. The ablation kit
  remains available for future research; it is not a product runtime layer or
  Phase 9 exit dependency. Skill/knowledge remain optional guidance governed by
  outcome-based rules, while complete Snapshot plus typed edits stays the flat
  product boundary.
- Commit status: not committed; working tree retains the preceding coordinated
  editor, symbol, hierarchy, RLC/CDAC, and plan changes.

## 2026-08-07 - Checkpoint integrated development

- Target: consolidate the intentionally retained manual-editor, symbol,
  hierarchy, visual-prototype, and Phase 9 Agent changes into one attributable
  baseline before Razavi visual implementation begins.
- Dirty-state decision: 52 modified tracked paths and 95 untracked paths were
  mapped to their named plans and prior log entries. Shared implementation
  files contain dependent changes from several targets, so a documented
  one-time integration checkpoint is safer than reconstructing partial
  historical commits. `lib/circuit.vss` remained unchanged. The Razavi style
  specification and its plan were explicitly excluded for a separate commit.
- Hygiene: the untracked set is about 2.2 MB, contains no unexpected large
  files, and the repository credential-signature scan found no matches.
- Concurrent-state note: an OTA `razavi-layout.mjs` appeared and changed after
  the opening audit, followed by four matching export artifacts. They were not
  part of the retained target inventory, so the complete OTA `razavi-*` set was
  excluded from staging and left untouched for its owner.
- Validation: `pnpm format:check`, `pnpm references:check`, `pnpm typecheck`,
  127 unit tests in 33 files, workspace build, symbol review, Phase 5 visual,
  Phase 7 export, Agent API artifact, every Phase 9 deterministic and held-out
  check, performance baseline, release package/smoke, 14 Playwright flows,
  and `git diff --check` passed.
- Commit status: prepared for the integrated checkpoint commit; push status is
  recorded by Git history and the final target handoff.

## 2026-08-07 - Define Razavi textbook visual convergence

- Target: freeze the complete fixed-style contract before changing runtime
  symbols, typography, strokes, nodes, or formal export.
- Changed areas: proposed `razavi-textbook-v1` specification, specification
  index, and target plan. The contract separates fixed assets into component,
  typography, and stroke/node layers while keeping routing/layout outside the
  style asset boundary.
- Contract: defines structured read-only VSS decoding, all-101 Master
  disposition, reviewed runtime catalog and provenance, semantic typography
  and stroke tokens, Port/Junction/device-pin truth, six-topology acceptance
  board, deterministic gates, and RV-1 through RV-8 delivery order. Existing
  Projects retain their persisted legacy profile; only new Projects/imports
  switch after acceptance gates pass.
- Dirty-state decision: shared prerequisites were checkpointed and pushed as
  `21b85fd`. Concurrent OTA `razavi-*` outputs remain untracked, read-only, and
  outside this documentation target.
- Validation: Markdown metadata/section inspection, specification index
  review, fenced-code balance, and `git diff --check`.
- Commit status: prepared for a dedicated normative-document commit; runtime
  implementation has not begun.

## 2026-08-07 - Complete Razavi RV-1 VSS decoder proof

- Target: replace visual/manual guessing with structured read-only ShapeSheet
  evidence for `NMOS4`, `Pmos3.a`, `R`, `DC-V`, and `node`.
- Changed areas: added a versioned VSS Master IR extractor, deterministic
  checker, checked five-target fixture plus the `TEXT` coverage-only Master,
  import-tool documentation, and factual RV-1 specification clarification.
- Evidence: 6 Masters, 32 nested Shapes, 93 supported geometry rows, 11
  connection points, 2 arrow-bearing Shapes, 1 text Shape, and three observed
  line-weight levels were captured with formulas and evaluated values. No
  electrical pin name/order was inferred, and extraction emitted zero
  diagnostics.
- Visual review: temporary Visio PNG/SVG exports confirmed the source NMOS4,
  Pmos3.a, resistor, DC voltage-source, and filled node-dot appearance. The
  exports remain temporary evidence rather than runtime assets.
- Validation: deterministic re-extraction matched fixture SHA-256
  `826c2ba82532de17686dae61ac1bd6c93fbe4b946d2bb60797ad726b23a94170`;
  focused feature assertions, formatting, typecheck, 127 unit tests in 33
  files, and `git diff --check` passed.
- Dirty-state decision: the user confirmed the concurrent OTA `razavi-*`
  files do not affect this target; they remained untracked and untouched.
- Commit status: ready for the dedicated RV-1 commit.

## 2026-08-07 - Establish Razavi RV-2 catalog boundary

- Target: make product-owned JSON assets and their provenance the source of
  truth for the first VSS-derived runtime components instead of leaving their
  only definitions embedded in `builtins.ts`.
- Changed areas: added `razavi-symbols@1` catalog/assets, a deterministic
  generated TypeScript adapter, runtime catalog API, generator/check command,
  focused tests, asset-directory documentation, and compatibility lookups in
  the existing built-in library.
- Catalog result: reviewed `nmos`/`NMOS4`, `resistor`/`R`, and
  `voltage-source`/`DC-V`, plus provisional `pmos3`/`Pmos3.a`, now expose
  source stencil/decoder identity, review state, exact pin order, reachability,
  asset path, and canonical hash. Provisional PMOS3 remains palette-visible but
  has no automatic mapping. VSS `node` is a semantic Junction primitive, not a
  component.
- Deterministic boundary: the checker validates canonical asset hashes,
  generated adapter equality, RV-1 evidence, path containment, unique
  IDs/aliases/assets/Masters, 10-unit pin grid, and catalog reachability.
- Compatibility: `builtInSymbols` reuses the four catalog object instances;
  ordering, IDs, aliases, variants, resolver behavior, and existing visual
  geometry remain unchanged.
- Validation: catalog check, 12 focused tests, 132 full tests in 34 files,
  typecheck, build, formatting, 25 symbol previews, Phase 1/5 visual goldens,
  and `git diff --check` passed.
- Dirty-state decision: user-confirmed concurrent OTA `razavi-*` files remained
  untracked and untouched.
- Commit status: ready for the dedicated RV-2 commit.

## 2026-08-07 - Add Razavi RV-3 semantic stroke profile

- Target: centralize formal line/node presentation under a versioned profile
  while preserving byte-identical legacy output.
- Changed areas: Symbol DSL semantic stroke role, first catalog asset role
  migration and regenerated hashes/adapter, renderer profile registry and
  profile-aware formal scene, symbol-review compatibility, tests, and visual
  contract documentation.
- Razavi behavior: formal foreground `#202020`; wire/symbol/normal `1.6`,
  emphasis `2.4`, supply `1.8`, annotation `1.6`; Junction/Port radii `3`;
  butt/miter geometry; scaling strokes; Arial-family 16-unit base text. Unknown
  profile IDs are blocking. All Razavi formal widths come from profile tokens;
  remaining legacy numeric overrides are deterministically clustered until
  their assets receive explicit roles.
- Legacy compatibility: `textbook-monochrome-v1` keeps literal numeric
  overrides, its prior defaults, and non-scaling strokes. Existing symbol,
  Phase 1/5, and Phase 7 goldens remained byte-identical.
- Validation: 24 focused tests, 137 full tests in 35 files, typecheck, build,
  formatting, catalog check, 25 symbol previews, Phase 1/5 visual goldens,
  Phase 7 export goldens, and `git diff --check` passed.
- Dirty-state decision: user-confirmed concurrent OTA `razavi-*` files remained
  untracked and untouched.
- Commit status: ready for the dedicated RV-3 commit.

## 2026-08-07 - Add Razavi RV-4 schematic typography

- Target: implement the frozen schematic-math and label typography contract
  for `razavi-textbook-v1` without changing persisted text or legacy output.
- Changed areas: profile typography tokens, schematic-text parser/composer,
  renderer text consumers, parser/renderer tests, and visual-language/style
  specifications.
- Razavi behavior: instance and recognized V/I labels render as italic-bold
  base/subscript `<tspan>` runs; explicit underscore has priority; trailing
  `+`/`-` uses a separate upright suffix; plain notes and figure captions are
  not implicitly parsed. Semantic kinds select their profile font sizes.
- Transform and compatibility behavior: instance and visible pin text remains
  outside component rotate/mirror transforms. The legacy profile emits its
  prior plain escaped text and retained byte-identical Phase 1/5 and Phase 7
  goldens.
- Validation: 23 focused tests, 149 full tests in 36 files, typecheck, build,
  formatting, Phase 1/5 visual goldens, Phase 7 export goldens, and
  `git diff --check` passed.
- Dirty-state decision: user-confirmed concurrent OTA `razavi-*` files remained
  untracked and untouched.
- Commit status: ready for the dedicated RV-4 commit.

## 2026-08-07 - Add Razavi RV-5 semantic nodes and annotations

- Target: render formal connection origins and annotation geometry from
  persisted semantic objects under `razavi-textbook-v1` while retaining
  compatibility output.
- Changed areas: node/annotation profile tokens, formal renderer, truth-table
  renderer tests, and visual-language/style specifications.
- Node behavior: positioned signal Ports render radius-3 origin dots; a Port
  attached to a power label renders a 20-unit supply bar instead of a dot;
  null Ports and device-pin anchors remain invisible. Explicit Junctions stay
  authoritative, and Razavi geometric crossings do not infer dots.
- Annotation behavior: current shaft/head dimensions and label gaps come from
  the profile; voltage annotations render separate upright polarity glyphs;
  rotation changes the arrow or polarity axis without rotating its label.
- Compatibility: the legacy profile retains its prior markup and byte-exact
  Phase 1/5 and Phase 7 goldens.
- Validation: 12 focused tests, 150 full tests in 36 files, typecheck, build,
  formatting, Phase 1/5 visual goldens, Phase 7 export goldens, and
  `git diff --check` passed.
- Dirty-state decision: user-confirmed concurrent OTA `razavi-*` files remained
  untracked and untouched.
- Commit status: ready for the dedicated RV-5 commit.

## 2026-08-07 - Capture Razavi RV-6A core analog VSS evidence

- Target: establish deterministic structured source evidence for all reviewed
  and provisional Batch A/B analog Masters before further catalog migration.
- Changed areas: dedicated 27-Master VssMasterIR fixture, deterministic
  re-extraction checker, VSS tool documentation, and source/style contracts.
- Evidence: 12 reviewed mappings, 13 provisional candidates, and semantic
  `node`/`Arrow` Masters produce 175 nested Shapes, 504 geometry rows, 45
  connection points, five recognized geometry kinds, and zero diagnostics.
  Fixture SHA-256 is
  `2db676bddbd0ac93dba64972eec15c40b2143161ec05c75cfe4cc467595584c0`.
- Boundary: connection points remain review evidence only. This target changed
  no runtime asset, pin order, palette entry, or automatic SPICE/PDK mapping.
  The frozen RV-1 proof fixture remains independent and unchanged.
- Validation: deterministic RV-6 re-extraction, unchanged RV-1 checker, 150
  tests in 36 files, typecheck, formatting, and `git diff --check` passed.
- Dirty-state decision: user-confirmed concurrent OTA `razavi-*` files remained
  untracked and untouched.
- Commit status: ready for the dedicated RV-6A commit.

## 2026-08-07 - Preserve implicit MOS bulk semantics

- Target: eliminate false flightlines from three-terminal MOS presentation
  without deleting, shorting, or rewriting the canonical D/G/S/B connectivity.
- Changed areas: shared endpoint visibility, visible connectivity/flightline
  derivation, editor connectable endpoints, MOS regression tests, Razavi text
  suffix composition, OTA layout recipe, and connectivity/Symbol DSL contracts.
- Electrical result: a variant-hidden or base `implicit` terminal stays in its
  logical Net but is excluded from the visible graph. The regression proves
  `XM1.B` remains on VSS, `XM1.S` remains on tail, both survive canonical
  Project serialization, and removing the three-terminal variant restores the
  visible B flightline.
- Recipe/result: the Agent recipe no longer forces every MOS to
  `textbook-3terminal`; VDD/VSS labels attach to Port IDs; its UTF-8 module
  imports successfully. Existing generated OTA outputs were left untouched
  because they belong to the earlier parallel run and are now stale.
- Visual result: schematic-math suffixes use explicit baseline reset and
  downward cursor compensation; current PNG inspection confirms normal
  `VIN+`, `VIN-`, `VOUT+`, and `VOUT-` sign placement.
- Deferred: Net classification, safe automatic three-/four-terminal variant
  selection, and `HIDDEN_BULK_NON_GLOBAL_NET` remain a separate correctness
  target rather than being guessed from names in this fix.
- Validation: 17 focused tests, 151 full tests in 36 files, recipe import,
  typecheck, build, formatting, Phase 1/5 visual goldens, Phase 7 export
  goldens, visual PNG inspection, and `git diff --check` passed.
- Commit status: ready for the dedicated correctness commit.

## 2026-08-07 - Migrate reviewed analog assets to the Razavi catalog

- Target: make the reviewed core analog VSS set the canonical runtime source
  while retaining the four-terminal MOS electrical contract.
- Changed areas: nine new normalized Symbol DSL assets, 13-entry catalog and
  generated adapter, built-in compatibility registry, evidence/review-manifest
  validation, focused catalog tests, and Razavi style documentation.
- Catalog result: 12 reviewed assets (`capacitor`, `current-source`, `diode`,
  `ground`, `inductor`, `nmos`, `npn`, `pmos`, `pnp`, `port`, `resistor`, and
  `voltage-source`) plus provisional `pmos3`; every exposed matching built-in
  is the catalog object. `nmos3` remains outside the catalog and `pmos3` has no
  automatic mapping.
- Electrical result: reviewed NMOS/PMOS pin order remains D/G/S/B and the
  textbook three-terminal variant changes presentation only.
- Deferred: full 101-Master disposition, remaining candidate/Batch C assets,
  runtime consumption of `automaticMappings`, bulk-Net classification and
  safe variant selection, exact VSS geometry-overlay proof, the six-topology
  acceptance board, and separately scoped routing extensions.
- Validation: catalog generation/check, 12-reviewed/13-candidate preview
  check, 14 focused tests, 152 full tests in 36 files, typecheck, build,
  formatting, Phase 1/5 visual goldens, Phase 7 export goldens, and
  `git diff --check` passed.
- Dirty-state decision: concurrent OTA recipe/output work and its separate
  target plan remained untouched and will not be staged in this commit.
- Commit status: ready for the dedicated RV-6B commit.

## 2026-08-07 - Generate a headless two-stage CMOS buffer example

- Target: demonstrate a fast Agent-generated circuit distinct from the CDAC
  and OTA examples.
- Changed areas: one deterministic typed-edit recipe and its editable Project,
  SVG, PNG, and PDF outputs under `netlists/mixed-device-acceptance/`.
- Electrical result: the existing `mixed_mos_cell` topology is preserved as
  two cascaded CMOS inverters; all four D/G/S/B terminal memberships survive
  canonical persistence, with PMOS bulk on VDD and NMOS bulk on VSS.
- Visual result: 4 placed instances, 5 Nets, 20 Routes, 8 Junctions, 9
  annotations, 0 flightlines, 0 crossings, and 0 visual diagnostics.
- Validation: headless generation, canonical Project round-trip, topology and
  bulk assertions, PNG inspection, `git diff --check`, and worktree audit.
- Dirty-state decision: unrelated documentation and OTA work remained
  untouched and was not staged.
- Commit status: ready for the dedicated fixture commit.

## 2026-08-07 - Generate a headless SKY130 divide-by-two schematic

- Target: turn `sky130-transistor-divide-by-2/circuit.spi` into a fast editable
  top-level schematic while retaining its seven-Document hierarchy.
- Changed areas: one deterministic typed-edit recipe, Project/SVG/PNG/PDF
  outputs, and an opt-in hierarchical implicit-supply symbol variant with
  focused tests.
- Electrical result: all source instances, Nets, subcircuit interfaces, and
  VDD/VSS memberships remain canonical. The top page has 8 placed instances,
  10 Nets, 24 Routes, 9 Junctions, and 0 flightlines.
- Presentation result: repeated hierarchical supply pins are hidden only in
  the selected top-level presentation; the visible state capacitor and reset
  transistor retain an explicit VSS rail. PNG inspection passed with 0 visual
  diagnostics. Twenty derived crossing records remain in the rapid functional
  view, including same-Net joins and visible feedback/reset crossings.
- Validation: 2 focused hierarchical-symbol tests, symbols build, headless
  generation, canonical/topology/visibility assertions, PNG inspection, and
  repository whitespace/status checks.
- Dirty-state decision: unrelated documentation and OTA work remained
  untouched and unstaged.
- Commit status: ready for the dedicated divider fixture commit.

## 2026-08-07 - Refine and flatten the SKY130 divide-by-two

- Target: refine the divider's hierarchical top page and produce a true
  transistor-level flat view without modifying its source SPICE.
- Infrastructure: added an optional pre-layout Project hook, deterministic
  recursive Document flattening, a 30-primitive fixture assertion, and
  electrical connectivity between same-Net junction stubs carrying identical
  labels.
- Electrical result: the flat view contains 15 NMOS, 14 PMOS, one capacitor,
  16 Nets, all prefixed deep internal identities, and no hierarchical instance.
  Matching labels change visible routing closure only; canonical Net terminal
  membership remains unchanged.
- Hierarchical presentation: 7 Documents, 8 placed top instances, 24 Routes,
  0 flightlines, 3 inter-Net crossings, and 0 visual diagnostics.
- Flat presentation: 8 Documents including the derived flat top, 30 placed
  primitives, 104 Routes, 77 Junctions, 99 annotations, 0 flightlines, 7
  inter-Net crossings, and 0 visual diagnostics.
- Validation: recursive-flatten assertions, six focused derived tests, derived
  package build, both headless generation recipes, canonical/topology/bulk
  checks, visual inspection of both PNGs, and repository whitespace/status
  checks.
- Dirty-state decision: concurrent symbol-fidelity, renderer, documentation,
  OTA, and visual-golden work remained unstaged. Final exports intentionally
  use the current reviewed MOS runtime available in the shared workspace.
- Commit status: ready for the dedicated refined/flat divider commit.

## 2026-08-07 - Generate MOS artwork from Visio evidence

- Target: replace guessed/procedural MOS geometry with a deterministic,
  independently auditable VSS-to-runtime path.
- Changed areas: four normalized Visio reference SVGs, Master-IR MOS generator,
  four generated catalog assets, generated adapter, built-in resolver,
  finite-decimal/fill-only Symbol DSL support, exact Razavi stroke roles,
  comparison/contact sheets, fixture routes, and SVG/PNG/PDF goldens.
- Fidelity result: `NMOS4`, `PMOS4`, `Nmos3.a`, and `Pmos3.a` retain decoded
  intrinsic geometry, child transforms, round caps/joins, 1.2/2.16 point
  weights, and Visio Arrow Type 13 direction/size. The independent 50% overlay
  visually matches the device body and arrow; only external lead length changes
  to keep pin anchors on the 10-unit electrical grid.
- Runtime/electrical result: all four MOS symbols now resolve to catalog
  objects. Canonical NMOS/PMOS remain D/G/S/B; the textbook variant remains
  presentation-only. Provisional NMOS3/PMOS3 expose no automatic mappings.
- Validation: deterministic four-reference Visio COM check, MOS/catalog/review
  regeneration checks, 155 tests in 37 files, typecheck, build, Phase 1/5
  visual checks, Phase 7 export checks, PNG inspection, formatting, and
  `git diff --check` passed.
- Dirty-state decision: concurrent documentation, OTA, divide-by-two,
  Agent-layout, and labeled-connectivity work remained read-only and unstaged.
- Commit status: ready for `feat(symbols): generate MOS artwork from Visio evidence`.

## 2026-08-07 - Expose Razavi fixed-style hard canon to Skill manifest

- Target: close Gap A — the Agent had no view of the Razavi fixed-style hard
  canon (grid `10`, pin-anchor divisibility, schematic-math label rules, stroke
  roles, node/connection-origin truth table) even though
  `razavi-textbook-style.md` existed as a `proposed` normative spec.
- Changed areas: added `docs/agent/knowledge/razavi-style-canon.md`; added one
  manifest row in `skills/circuit-layout/references/manifest.md`; added the
  fixed-style category to the `docs/agent/README.md` knowledge enumeration.
- Boundary held: the new canon exposes only the three hardable fixed-style
  layers (coordinate, typography, stroke/node). Routing topology, elbow/trunk
  choice, obstacle avoidance, and composition are explicitly written out of
  scope and deferred to the existing routing/expression/guidance authorities —
  operationalizing the `razavi-style-aspect-boundary` memory.
- Dirty-state decision: a large dirty set across `apps/editor`, `packages/*`,
  `fixtures/*`, and `netlists/*` from prior uncommitted targets was confirmed
  against owned paths; none overlap. Unrelated dirty files left untouched.
- Validation: Markdown link resolution from the new doc and manifest row to
  every referenced target, fenced-code balance, `git diff --check`, and
  `git status --short --branch` passed. No typecheck/test/build run because no
  source or runtime contract changed (docs-only, risk-proportional per
  AGENTS.md).
- Commit status: ready for
  `docs(agent): expose Razavi fixed-style hard canon to Skill manifest`.

## 2026-08-07 - Editor text resize, default-label visibility, and annotation hit fix

- Target: fix three editor interaction defects — added plain-text cannot be
  resized; power/ground devices always render a default instance ID label
  (GND/VSS should default to none); selecting a note/text annotation conflicts
  with device selection because the device hit-target covers it.
- Changed areas: added `labelVisibility: shown|hidden` to `SymbolDefinition`
  (optional, default shown); marked `powerPortSymbol("vdd"|"vss")` and the
  Razavi `ground` catalog asset `labelVisibility: "hidden"`; renderer skips the
  default instance label for hidden-default symbols while explicit
  instance-label annotations still render; added optional `sizeScale` to
  `AnnotationSchema` and a `sizeScale` parameter to `schematicTextSizeAttribute`
  so `plain-text` font size scales (Razavi only; legacy profile unchanged);
  editor Text panel gained a size-scale input and `applyAnnotationText` writes
  `sizeScale` for plain-text; annotation hit-target radius raised from 10 to 18
  to reduce device-circle swallowing of text selection.
- Validation: typecheck, workspace build, Phase 5 visual check, Phase 7 export
  check, two new focused render tests (label-hidden symbol, plain-text
  sizeScale), formatting, and `git diff --check` passed.
- Dirty-state decision: the worktree carries the ongoing
  `hidden-mos-terminal-correctness` target plus pre-existing RV-6A
  visio-core-analog work that changed several Razavi symbol JSON geometries
  (resistor, capacitor, diode, voltage-source) without re-syncing
  `catalog.json` hashes or dependent test/golden assertions. As a result five
  pre-existing tests fail at this point — three in `razavi-catalog.test.ts`
  and two in `apps/editor` (`clipboard`, `delete-selection`) that depend on
  resistor pin geometry — none caused by this target's edits (verified: these
  files pass at HEAD without the dirty symbol work; they fail once that work is
  restored). `symbols:razavi:check` likewise remains red on the pre-existing
  capacitor hash mismatch. The full catalog re-sync and those test/golden
  updates are left to a dedicated symbol-consistency target. This target only
  touched ground/vdd/vss label visibility, annotation sizeScale, and the
  annotation hit-target radius.
- Commit status: ready for
  `feat(editor): add text resize, default-label visibility, and annotation hit fix`.

## 2026-08-07 - Bound agent-routing expander to Agent-local, non-rerouting scope

- Target: write ADR 0008 before any `packages/agent-routing` code, fixing the
  boundary that keeps a `RouteTreeDecision` and its expander inside ADR 0007's
  accepted Snapshot-driven Agent-local model and outside the vetoed Layout
  Intent / query-language / automatic-router space.
- Changed areas: added `docs/adr/0008-agent-local-route-tree-expander.md`;
  listed it in `docs/adr/README.md`.
- Decision (two nails): (1) `RouteTreeDecision`/`RouteTreeExpansion` are
  Agent-local and transient — types live only in `packages/agent-routing`,
  must not enter `agent-adapter` or `model` schemas, must not persist into
  `.icproj`, must not grow select/query/region capabilities, and add no Agent
  API endpoint; the Skill contract may carry them, the API contract may not.
  (2) The expander detects conflicts (crossing/overlap/wire-through-symbol/
  off-grid) but does not auto-reroute: no silent shape fallback, no
  `auto`/`best` shape, no rerouting to drive a counter to zero.
- Dirty-state decision: owned paths do not overlap the ongoing editor and
  symbol-consistency dirty work; unrelated files left untouched.
- Validation: Markdown link resolution to 0007, agent-api.md,
  connectivity-and-routing.md, rule-guided-layout-architecture.md,
  razavi-style-canon.md, and the Skill manifest; fenced-code balance;
  `git diff --check` passed. Docs-only; no typecheck/test/build run
  (risk-proportional).
- Commit status: ready for
  `docs(adr): bound agent-routing expander to Agent-local, non-rerouting scope`.

## 2026-08-07 - Localize transact failures and return resolved Route geometry

- Target: close three Agent self-consistency gaps in the `transact` path (target
  #2 of the routing-quality sequence) so an Agent sees the consequence of its
  own operation.
- Changed areas: `packages/edit-engine/src/transaction.ts` (EditDiagnostic gains
  optional objectIds/parameters; rejectTransaction gains optional path/objectIds;
  the apply loop is indexed with a rejectAt closure binding `["edits", index]`;
  in-loop rejections name the offending routeId; the post-loop Route geometry
  failure carries `["routes", routeId]`), `packages/agent-adapter/src/schema.ts`
  (optional `resolvedRoutes` on the transact success response),
  `packages/agent-adapter/src/service.ts` (stop stripping failure diagnostics;
  collect and return resolvedRoutes), two focused service tests, and
  `docs/specs/agent-api.md` + `docs/agent/api-usage.md` documenting both.
- Result: a rejected transact localizes the failing edit via `["edits", index]`
  (or `["routes", routeId]` for a Route geometry failure) and names the object
  in `objectIds`; a successful transact returns the post-normalization polyline
  for each touched Route, so the Agent learns the actual stored geometry after
  `set_route_points`/`add_junction` normalization without an immediate snapshot.
- Dirty-state decision: owned paths do not overlap the existing editor/symbol/
  fixture dirty set. The agent-api schema artifacts were already dirty from
  prior uncommitted schema.ts work; regenerated to validate, but NOT staged here
  because they bundle pre-existing schema.ts changes not authored by this target.
- Validation: full workspace `pnpm typecheck`, `prettier --check`, 47 tests in
  8 files (agent-adapter + edit-engine), `agent-api:artifacts:check`, and
  `git diff --check` passed.
- Commit status: ready for
  `feat(agent-api): localize transact failures and return resolved Route geometry`.

## 2026-08-07 - Add Agent-local route-tree expander and shape dictionary

- Target: target #3b of the routing-quality sequence — remove the multi-endpoint
  Net tree-arithmetic bottleneck by expanding a topology-only RouteTreeDecision
  into typed edits with resolved coordinates, inside the ADR 0008 boundary.
- Changed areas: new `packages/agent-routing` package (`types.ts`, `expand.ts`,
  `index.ts`) with `expandRouteTree` and per-shape expanders for direct /
  local-branch-tree / shared-trunk / labeled-islands / ordered-bus; thin Skill
  caller `skills/circuit-layout/scripts/expand-route-tree.mjs`; non-recipe shape
  dictionary `docs/agent/knowledge/route-tree-shapes.md`; manifest row; one
  `tsconfig.check.json` path entry; 8 focused tests.
- Boundary held: the expander applies the grid=10 canon, returns conflicts
  (UNKNOWN_SHAPE, MISSING_ENDPOINT, SHAPE_MISMATCH, TRUNK_CORRIDOR_BLOCKED)
  without auto-rerouting, has no `auto`/`best` shape, and never silently
  switches shapes. It depends on `@icm/model` and `@icm/edit-engine` types only;
  RouteTreeDecision/Expansion do not enter the Agent API or model schemas.
- Dirty-state decision: additive owned paths do not overlap the existing dirty
  set; `pnpm install` re-linked the workspace without lockfile changes.
- Validation: full workspace `pnpm typecheck`, `prettier --check`, 8 tests, and
  `git diff --check` passed.
- Commit status: ready for
  `feat(agent-routing): add Agent-local route-tree expander and shape dictionary`.

## 2026-08-07 - Add read-only routing-quality metrics

- Target: target #4 of the routing-quality sequence — give the Agent measurable
  routing feedback beyond structural codes, as evidence only (never pass/fail,
  never moving objects).
- Changed areas: `packages/derived/src/visual.ts` (new
  `pushRoutingQualityMetrics` with VISUAL_WIRE_THROUGH_SYMBOL,
  VISUAL_ROUTE_OVERLAP, VISUAL_TERMINAL_DEPARTURE; segmentIntersectsRect and
  firstCollinearOverlap helpers), one focused test, and
  `docs/agent/knowledge/routing-and-diagnostics.md` documenting the codes.
- Boundary held: metrics are read-only derived diagnostics; terminal departure
  is `info` evidence; overlap and wire-through-symbol are `warning`. They never
  move objects and never claim good/bad. The VisualDiagnostic type and Agent
  Snapshot mapping were unchanged.
- Dirty-state decision: owned paths do not overlap the existing dirty set.
- Validation: full workspace `pnpm typecheck`, `prettier --check`, 17 tests in
  4 files, and `git diff --check` passed.
- Commit status: ready for `feat(derived): add read-only routing-quality metrics`.

## 2026-08-07 - Stretch connected routes on instance move (ADR 0009)

- Target: target #5 of the routing-quality sequence — a device move no longer
  drags connected Routes into an invalid state; the Agent can revise placement.
- Changed areas: ADR 0009 (move stretches, never reroutes; scope move_instance,
  Junction move deferred); `packages/edit-engine/src/transaction.ts`
  (applyStretchedRoutes called from move_instance using proposeLocalStretch;
  protected adjacent segments skipped, post-loop validation still rejects);
  `routing.test.ts` rewritten; `packages/agent-adapter/src/snapshot.ts`
  (topologyHash excludes diagnostics — derived evidence is not topology);
  `scripts/phase-9-generalization.mjs` (finalDiagnosticCount counts error only);
  `docs/specs/edit-engine.md`; and regenerated Phase-9 fixtures whose pinned
  hashes/count assertions changed as a direct consequence of #4/#5.
- Boundary held: stretching preserves topology and locks; it never reroutes or
  breaks a lock. move_junction still relies on post-loop validation (deferred).
- Dirty-state decision: owned paths do not overlap the existing editor/symbol
  dirty set; Phase-9 fixtures regenerated because the topologyHash fix and #4
  metrics changed their pinned values (hash/count-only diffs).
- Validation: full workspace `pnpm typecheck`, `prettier --check`, 72 tests in
  13 files, all Phase-9 checks (heldout flash/chopper/ring, skill,
  generalization, snapshot audit), `agent-api:artifacts:check`, and
  `git diff --check` passed.
- Commit status: ready for
  `feat(edit-engine): stretch connected routes on instance move (ADR 0009)`.

## 2026-08-07 - Defer automatic router / obstacle avoidance / auto cleanup

- Target: target #6 (final) of the routing-quality sequence — evaluate whether
  to implement A* / automatic avoidance / auto cleanup.
- Decision: do not implement. Evidence: thermometer flat layout reached 0
  defects via tree choice + diagnostics, not a router; ADR 0008 bounds the
  expander to detect-not-reroute; Phase 9 measured recipe-ization as harmful;
  ADR 0007 requires helpers be optional and the workflow complete without them;
  and #1–#5 already closed the reason/decide/see/feedback/revise loop.
- Changed areas: `plan/2026-08-07-defer-automatic-router/plan.md` only.
- Validation: `git diff --check`. Docs-only.
- Commit status: ready for
  `docs(plan): defer automatic router per ADR 0008 and Phase 9 evidence`.

## 2026-08-08 - Evaluate the new Agent-routing architecture on a flat CDAC

- Target: generate a genuinely flattened SKY130 6-bit switched-capacitor DAC
  through API v2 Snapshot/transact/render, with Agent-selected Net trees and
  `@icm/agent-routing` expansion, then audit the resulting electrical and
  visual behavior.
- Changed areas: additive evaluation script and Project/SVG/PNG/PDF artifacts
  under `netlists/sky130-switched-capacitor-dac-6bit-pvt/`, plus the bounded
  target plan. Existing overlapping `agent-scdac-newarch.*` files and the dirty
  Agent-routing source remained read-only.
- Result: 46 placed primitive instances (12 PMOS, 13 NMOS, 7 capacitors, 14
  local power helpers), 22 Nets, 110 Routes, 33 Junctions, no hierarchy blocks,
  no unresolved symbols, and no error-severity diagnostics. The formal render
  exposes correct bit order, weights, switch branches, reset, and common plate.
- Findings: shared-trunk tap Junctions do not split the trunk and coincident
  endpoint/tap geometry can crash route normalization; local-branch-tree makes
  a readable rail using overlapping Routes; labeled-islands do not emit label
  semantics and leave 14 VDD/VSS flightlines; Expander metrics do not reflect
  Engine-resolved bends; routing dry-runs returned zero resolved Routes while
  commits returned the actual geometry.
- Validation: API `2.0` capabilities and Snapshot `1.0`; six successful
  dry-run/commit batches; Project validation and formal API render; electrical
  terminal-count audit; whole-page PNG inspection; target Prettier check,
  structural assertions, repository-wide `git diff --check`, and final status
  audit passed.
- Commit status: intentionally uncommitted and unpushed because the evaluation
  depends on a dirty shared Expander and overlapping candidate files have
  unknown ownership.

## 2026-08-08 - Close the routing closed loop (caller, tap geometry, dry-run, multi-move)

- Target: address the four P0/P1 blockers the reviewer identified so the
  Agent -> Expander -> dry-run -> transact -> diagnostics loop actually runs.
- Changes:
  - #2 tap geometry: shared-trunk and ordered-bus now create a real per-endpoint
    tap Junction (not a trunk-end Junction); local-branch-tree dedups undirected
    g1<->g2 links so a pair is never emitted twice.
  - #1 caller: `expand-route-tree.mjs` resolves the agent-routing dist via a
    repo-root-relative file:// URL (no hoisted node_modules needed); a
    `SerializedExpansionInput` + `hydrateExpansionInput` turn the JSON endpoint
    array into the Map the expander expects. Added a CLI vitest that spawns the
    caller with fixtures.
  - #3 dry-run geometry: `executeTransaction` dryRun now returns the validated
    candidate (`candidate.data`) instead of the original Document, so
    `resolvedRoutes` reports proposed polylines; the Adapter still only commits
    on `applied`, so the store is untouched.
  - #4 multi-instance move: `move_instance` passes the progressive `draft`
    (not the pre-transaction Document) to `applyStretchedRoutes`, so a later
    move in the same transaction sees earlier moves' effect on shared Routes.
    Diagonal moves on both endpoints remain limited by proposeLocalStretch's
    inability to insert corners (documented; axial multi-move regression added).
  - #5 regenerated the CDAC recipe under the new architecture (22 overlaps
    remain, all from independent route_orthogonal escapes sharing a channel —
    the known no-obstacle-avoidance limitation, not a loop bug).
- Validation: full workspace `pnpm typecheck`, `prettier --check`, 60 tests in
  10 files (agent-routing, edit-engine, agent-adapter, skill caller CLI),
  CDAC regeneration, and `git diff --check` passed.
- Commit status: ready for
  `fix(agent-routing): close the expander loop (caller, tap geometry, dry-run, multi-move)`.

## 2026-08-08 - Demote expander to route-graph geometry helper

- Target: correct the abstraction drift — the previous expander was a "shape
  compiler" that decided junction count, trunk line, tap order, and hub
  connectivity from a compressed `shape` + `endpointGroups` decision, silently
  moving the Agent's visual-topology judgment into a weak deterministic
  planner. Rewrote @icm/agent-routing as a route-graph geometry helper.
- Changed areas: `packages/agent-routing/src/types.ts` (new RouteGraph
  nodes/edges interface replacing RouteTreeDecision), `expand.ts`
  (expandRouteGraph resolves node coordinates + projects edges to typed edits;
  never decides topology, never reroutes), `shapes.ts` (optional graph
  constructors: buildDirectGraph, buildSharedTrunkGraph, buildLocalBranchTree,
  buildLabeledIslands — advisory starting points, not a closed enum),
  `test/expand.test.ts` (10 tests), and the CDAC recipe `agent-cdac-flat.mjs`
  rewritten to give explicit Route graphs per Net.
- Boundary held: RouteGraph types live only in @icm/agent-routing (not in
  agent-adapter/model schemas, not persisted). The helper resolves coordinates
  and assembles edits; the Agent decides every node and edge. Conflicts are
  returned (MISSING_NODE_POSITION, ESCAPE_MALFORMED), never median-guessed.
- CDAC result: 48 routes, 19 junctions, 0 conflicts, 0 errors. Diagnostics:
  10 ROUTE_OVERLAP (collinear escapes, evidence-only), 2 AMBIGUOUS_JUNCTION, 1
  LABEL_OVERLAP, 2 WIRE_THROUGH. Visually much improved: explicit vdd rail,
  segmented vout common-plate, labeled vss islands, correct schematic-math
  labels.
- Validation: full workspace `pnpm typecheck`, `prettier --check`, 10 tests,
  CDAC recipe regenerated, `git diff --check` passed.
- Commit status: ready for
  `refactor(agent-routing): demote expander to a route-graph geometry helper`.

## 2026-08-08 - Migrate Visio core-analog Batch A to source-derived assets

- Target: land the self-contained core-analog catalog migration as group 1 of a
  worktree-split sequence, after the user instructed splitting the dirty
  worktree into self-contained commit groups.
- Changed areas: 8 razavi-v1 symbol assets (`resistor`, `capacitor`, `inductor`,
  `diode`, `ground`, `port`, `current-source`, `voltage-source`), `catalog.json`
  - asset README, regenerated `razavi-catalog.generated.ts`; `schema.ts`
    (`labelVisibility`), `builtins.ts` (power-port hidden default label +
    polyResistor) + test, `pdk-registry.ts` (sky130 high-po mapping) + test;
    `scripts/generate-razavi-symbol-catalog.mjs` generation policies; 8 checked
    Visio reference SVGs under `fixtures/visual-reference/visio-core-analog/`;
    `fixtures/visual-golden/visio-core-analog-fidelity.svg`;
    regenerated `phase-5-symbol-review.svg` and `vss-migration-candidates.svg`;
    `fixtures/spice/current-corpus-summary.json` (fewer generic symbols after
    improved mapping; connectivity hashes unchanged); the two target plans.
- Dirty-state decision: group 1 has no cross-package source coupling to the
  editor/model/renderer/derived/agent-api changes held in subsequent groups;
  `packages/symbols/src/schema.ts` (labelVisibility) is distinct from
  `packages/model/src/schema.ts` (annotation, group 2). No hunk-level split
  needed.
- Validation: `symbols:razavi:check` (14 assets + 1 primitive),
  `symbols:visio-core-analog:check` (8 assets + fidelity board),
  `pnpm typecheck`, symbol review (12 reviewed + 13 candidate), 26 focused
  symbols tests, workspace build, `references:check` (4), prettier on owned
  files, `git diff --check` — all green.
- Commit status: committed as `7a38734` and pushed to `origin/main`
  (group 1 of the split sequence). Correction: the agent-routing _package_ was
  largely committed in `e7e7aa4`..`c70a813`, but one `expand.ts` wire-through-symbol
  fix remained uncommitted in the worktree; see the group-4 entry below.

## 2026-08-08 - Add netlist-to-schematic pipeline architecture review

- Target: group 5 of the worktree-split sequence — land the reference
  architecture/pipeline walkthrough and index it from the docs map.
- Changed areas: `docs/architecture-and-pipeline-review.md` (new, 306-line
  non-normative reference covering repository structure, the 12-stage
  netlist-to-schematic pipeline, and the Agent Razavi-layout gap assessment);
  one index row in `docs/README.md`.
- Dirty-state decision: docs-only, no shared-contract or source coupling to
  any other group; `docs/` is outside the `format:check` glob, so validation
  was link resolution, fence balance, and content review (risk-proportional).
- Validation: README link resolves to the new doc; fenced-code balance;
  `git diff --check` passed.
- Commit status: committed as `26ca479` and pushed to `origin/main`.

## 2026-08-08 - Regenerate Agent API circuit schema fixtures

- Target: group 6 of the worktree-split sequence — land the three checked
  Agent API artifacts regenerated from the current `@icm/agent-adapter` schema.
- Changed areas: `fixtures/agent-api/agent-circuit-request.schema.json`,
  `agent-circuit-response.schema.json`, `agent-circuit.openapi.json`
  (+918 lines).
- Dirty-state decision: the fixtures are generated downstream of
  `packages/agent-adapter` (and transitively `packages/model`) schema.
  `agent-api:artifacts:check` passes against the current worktree, so the
  fixtures are consistent with the as-yet-uncommitted model schema changes
  (group 2/3); committing them first introduces no drift, and the model
  source will align when group 2/3 lands.
- Validation: `agent-api:artifacts:check` (Validated 3 Agent API artifacts);
  `git diff --check` passed.
- Commit status: committed as `b1de6e4` and pushed to `origin/main`.

## 2026-08-08 - Record OTA redraw plan (group 7, plan-follows-code)

- Target: group 7 (partial) of the worktree-split sequence — land the OTA
  redraw plan now that its generated artifacts are settled. Per the user's
  "plan follows code" rule, plans bound to uncommitted code groups
  (route-attached-current-arrow, annotation-editing, editor-text-label-hit-fixes,
  flat-cdac-new-architecture-audit) stay with their code; only this plan, whose
  artifacts are gitignored local build outputs, lands now.
- Changed areas: `plan/2026-08-07-redraw-ota-with-repaired-bulk-and-new-symbols/plan.md`.
- Note: the referenced `razavi-ota-5t-redrawn.*` and `razavi-layout.mjs` are
  gitignored under `netlists/` and are intentionally not version-controlled;
  the plan records intent and factual outcome only.
- Validation: `git diff --check` passed. Docs-only.
- Commit status: committed as `4d738eb` and pushed to `origin/main`.

## 2026-08-08 - Restore atomic flat-CDAC Route-graph generation

- Target: repair the regressed transistor-level CDAC experiment without
  reintroducing a shape compiler or automatic router.
- Changed areas: atomic `@icm/agent-routing` conflict behavior; transient bend
  nodes folded into Route waypoints; opt-in pre-export generator completeness
  gate; explicit full-topology CDAC Route graphs; regenerated Project, SVG, PNG
  and PDF artifacts.
- Dirty-state decision: pre-existing editor, renderer-test and current-arrow
  work belonged to other targets and remained read-only. The generated visual
  was inspected using the available renderer build.
- Result: 32 placed primitive instances, 22 Nets, 103 Routes, 40 semantic
  junctions, 0 helper conflicts, 0 visual errors/warnings, 0 crossings and 0
  flightlines. All visible Nets form one connected component. No simulation
  claim; validation is structural topology mapping and visual presentation.
- Validation: 14 focused agent-routing tests, package build, workspace
  typecheck, owned-file Prettier check, deterministic double generation with
  identical hashes, structural audit, and original-resolution PNG inspection.
- Commit status: ready for
  `fix(agent-routing): restore atomic flat CDAC generation`.

## 2026-08-08 - Clarify flat-CDAC inverter wiring and labels

- Target: remove the ambiguous double-node DP/DN wiring and move repeated MOS
  labels outside active wiring corridors.
- Changed areas: flat CDAC placement/Route graphs and regenerated formal
  Project/SVG/PNG/PDF artifacts.
- Result: each unit now has one inverter-output junction, one NB horizontal
  handoff, one switch-gate fanout and one BOT junction. DP/SP labels are above
  devices, DN/SN below, and NB above its handoff. The flat target remains at 0
  visual errors/warnings, 0 crossings and 0 flightlines.
- Validation: completeness gate, workspace typecheck, deterministic artifact
  hashes and original-resolution PNG inspection. Presentation-only; no
  simulation claim.
- Commit status: ready for `fix(cdac): clarify inverter wiring and labels`.

## 2026-08-08 - Route-attached current arrow, annotation editing, and hit fixes (editor layer)

- Target: land the editor layer for three intertwined annotation/current-arrow
  features whose model/renderer/derived contracts had already been committed
  earlier in the worktree-split sequence.
- Changed areas: `apps/editor/src/App.tsx` (Add current arrow command,
  drag-along-segment, Reverse arrow, clipboard route-reference remap,
  Text-panel size-scale draft/commit, padded annotation hit bounds),
  `apps/editor/src/styles.css` (pointer-events), focused
  `current-arrow.test.ts`, route-attached/sizeScale/labelVisibility cases in
  `packages/render-svg/src/render.test.ts`, checked
  `fixtures/projects/route-attached-current-arrow/` and visual-golden, plus the
  three target plans.
- Dirty-state decision: the lower-layer contracts (`RouteAnnotationAttachment`,
  `routeAttachmentPlacement`, `sizeScale` renderer branches, Ground
  `labelVisibility`) had already landed in `7a38734` / `a6eeccf` / `64eefa1` /
  `baffb44`; this commit is the editor-layer consumer only. It is file-level
  disjoint from the concurrent flat-CDAC agent-routing work and does not touch
  any of its files. The three plans are committed together because they share
  one `App.tsx` working set.
- Validation: render-svg 15/15, editor 6/6, full vitest 194/195 (the single
  failure is an unrelated `agent-routing/test/integration.test.ts` assertion
  from the unpushed flat-CDAC commit, not touched by this set), typecheck,
  prettier on owned files, `git diff --check`.
- Commit status: committed as `a9a90e6`, not yet pushed. Note: the local
  branch also carries unpushed flat-CDAC commits (`36279ed`, `2bb4c2b`) from a
  concurrent worker; push order and the integration-test failure they
  introduce need a decision before pushing.

## 2026-08-08 - Make Razavi the new-canvas default and expose style selection

- Target: ensure manual drawing uses the approved Razavi typography by default
  while retaining an explicit compatibility choice for existing Documents.
- Changed areas: model factory default; typed, undoable
  `set_presentation_style` Edit Engine operation; editor `Style` command menu;
  focused default and history tests.
- Result: newly created Documents persist `razavi-textbook-v1`. An existing
  Document remains unchanged until the user chooses `Style > Razavi textbook`;
  the selection can be undone.
- Validation: focused tests (9/9), model/edit-engine package builds, editor
  production build, and `git diff --check` passed. Workspace typecheck and
  recursive build are blocked by a concurrent missing-return error in
  `packages/agent-adapter/src/service.ts:437`, outside this target.
- Commit status: uncommitted.

## 2026-08-08 - Tighten device hit targets and make text markup authorable

- Target: stop oversized device selection regions from masking nearby wiring
  interactions and expose usable subscript/italic entry for annotations.
- Changed areas: editor Symbol-viewBox hit rectangles; selection-aware Text
  panel formatting buttons; explicit Razavi text markup parser; focused render
  coverage.
- Result: device targets follow each transformed symbol's real bounds rather
  than a fixed 36-unit circle. `M_{1}` and `V_{DD}` render mathematical
  subscripts; `\\it{gain}` renders italic text, including in plain annotations.
- Validation: renderer/model/edit-engine suites (25/25), editor build, render
  package build and `git diff --check` passed. Full typecheck is blocked only
  by the concurrent `packages/agent-adapter/src/service.ts:437` missing return.
- Commit status: uncommitted.

## 2026-08-08 - Calibrate Razavi symbol proportions and strokes

- Target: make the fixed Razavi assets closer to the supplied reference while
  preserving the electrical connection grid.
- Changed areas: Visio-derived MOS/core-analog generators and regenerated
  assets/catalog/fidelity boards; Symbol DSL circle presentation; Razavi SVG
  style tokens and formal SVG goldens.
- Result: MOS internal geometry is 10% narrower along its gate axis while
  D/G/S/B anchors remain unchanged; Ground artwork is 18% longer along its
  lead axis; standard component strokes use the 1.6-unit wire width; VDD/VSS
  bars are 16 units; and the palette Port endpoint is a filled, stroke-free
  dot. Source-derived output stays generator-owned rather than hand-edited.
- Validation: MOS/core-analog/catalog generator checks; 27 focused symbol and
  renderer tests; dependency-aware render-svg build; Phase 1/5 formal-golden
  regeneration; editor production build; and `git diff --check` passed.
- Commit status: uncommitted.

## 2026-08-08 - Align Razavi MOS and Ground geometry to reference

- Target: replace approximate fixed-asset scaling with the supplied Razavi
  reference's MOS and Ground proportions.
- Changed areas: Visio MOS source generator, regenerated MOS catalog assets
  and visual/fidelity baselines, focused catalog coverage, and dependent
  formal SVG goldens.
- Result: three-terminal MOS retains the reference-calibrated 1.15 gate-axis
  scale; the MOS body is additionally contracted symmetrically to 76.5% along
  the S/D axis. Drain/source spans, arrow shafts, and vertical leads retain
  their original stroke presentation. Only the two semantic gate bars are
  sharp-cornered, filled 3.24-unit rectangles, independent of instance
  rotation. The attempted PMOS arrow normalization was rolled back because it
  hid a required visible S branch. Ground retains the reference 1 : 0.5 : 0.25
  bar progression and 1.18 lead-axis length. The built-in VDD symbol has a
  connected 17.5-unit stem (formerly 32; 25 before this refinement) and a
  sharp-cornered, filled 3.24-unit horizontal bar. Four-terminal electrical
  pin anchors and hidden-bulk semantics are unchanged. The DC voltage source
  now draws fixed, external left-side `+`/`−` marks at an 8-unit span (about
  half the 16-unit Razavi text size); the DC current source has a shorter shaft
  and an 8.93-unit-wide triangular arrowhead while retaining its Visio-derived
  circle and pin anchors.
- Validation: regenerated MOS/formal SVG baselines; MOS/core-analog/catalog
  generator checks; 36 focused symbols/renderer tests; render-svg dependency
  build; editor production build; and `git diff --check` passed.
- Commit status: uncommitted.

## 2026-08-08 - Establish four-layer Agent schematic guidance

- Target: make Agent layout work repeatable through separate workflow,
  tool-behavior, response-semantics, and circuit/style knowledge layers.
- Changed areas: four canonical Agent guidance pages; thin `circuit-layout`
  Skill and progressive-loading manifest; Agent documentation navigation;
  corrected RouteGraph shape vocabulary; refreshed Phase 9 Skill-structure
  report.
- Dirty-state decision: concurrent editor, model, renderer, test, plans, and
  two prior `plan/log.md` entries belonged to other targets and were preserved.
  This target is staged independently from those changes.
- Result: the Skill now requires both structural and semantic visual completion
  gates, documents real API/RouteGraph/generator behavior and result codes, and
  teaches junction/bend/crossing, bump repair, common transistor structures,
  labels, and render review without reintroducing Layout Intent or a shape
  compiler.
- Validation: Skill Creator validation passed; Phase 9 Skill check passed with
  16 valid manifest links and all contract checks true; direct local Markdown
  link check passed for eight entry files; `git diff --check` passed.
- Commit status: ready for
  `docs(agent): establish four-layer layout guidance`.

## 2026-08-08 - Text, annotation, and peripheral editing system plan

- Target: define an execution-ready, non-electrical drafting layer for rich
  text, route markers, arrows, leaders, callouts, construction lines, floating
  symbols, and editor-only guides.
- Changed areas: added
  `docs/roadmap/text-annotation-peripheral-editing-plan.md`; created the
  associated bounded target plan.
- Evidence: audited the current model annotation schema, shared Edit Engine
  annotation operations, route attachment resolver, SVG text/current-arrow
  renderer, editor commands, and accepted Editor Interaction/Schematic Model/
  Agent API contracts. The plan deliberately preserves existing electrical
  label semantics while separating exportable drafting from non-exported
  guides.
- Validation: cross-referenced the current schemas, engine operations,
  renderer/editor behavior, and accepted contracts; `git diff --check` passed.
  No runtime code or circuit assets changed.
- Commit status: not committed; repository contains concurrent dirty work
  outside this documentation target.

## 2026-08-08 - Land concurrent Razavi editor/style/symbol targets

Three coordinated but uncommitted targets, left green and landed as separate
commits by a coordination target before starting the Text & Peripheral
Editing System work.

- Target: razavi-default-and-style-switch.
- Changed areas: model factory default + schema test; edit-engine
  `set_presentation_style` typed edit + presentation history test;
  agent-adapter `editCategory` classification of the new edit.
- Result: new Documents persist `razavi-textbook-v1`; style selection is
  revisioned with Undo; opening an existing monochrome Project does not
  migrate it.
- Validation: focused model/edit-engine tests; full suite 203/203; workspace
  typecheck clean; editor build succeeds.
- Commit: `feat(editor): default Razavi style and undoable style switch`.

- Target: precise-hit-targets-and-text-markup.
- Changed areas: render-svg schematic-text explicit `M_{1}`/`V_{DD}`/`\it{}`
  parsing with per-run style discriminator + updated test expectations;
  editor App.tsx transformed-Symbol-bounds hit targets, Text-panel subscript
  and italic buttons, and styles.css.
- Result: device selection no longer masks nearby routing; explicit markup
  renders across all annotation kinds including plain text.
- Validation: focused render tests; full suite 203/203; editor build
  succeeds.
- Commit: `fix(render): precise hit targets and explicit text markup`.

- Target: razavi-symbol-proportion-and-stroke-calibration.
- Changed areas: regenerated Visio-derived MOS and core-analog geometry and
  fidelity goldens; both generator scripts; symbols schema/builtins/catalog
  tests and generated catalog; render-svg `style-profile` Razavi `normal`
  stroke 1.2->1.6 + updated test, and render/render.test.
- Result: Visio-exact MOS and core-analog proportions; Razavi normal stroke
  aligns with wire/symbol stroke.
- Validation: full suite 203/203; `generate-razavi-symbol-catalog`,
  `generate-visio-mos-assets`, and `generate-visio-core-analog-assets`
  `--check` all pass; workspace typecheck clean.
- Commit: `feat(symbols): Visio-exact MOS and core-analog proportion calibration`.

- Target: arrowhead-proportion-calibration (fourth concurrent target,
  surfaced during landing).
- Changed areas: regenerated `fixtures/visual-golden/phase-1-manual.svg`,
  `phase-5-dense-analog.svg`, and `route-attached-current-arrow.svg` against
  the widened MOS source arrow geometry. The symbol-asset geometry and the
  `razavi-catalog.test.ts` regression assertion had already landed with the
  symbol-proportion commit.
- Result: formal rendering matches the committed symbol assets.
- Note: the three goldens were stale relative to the committed symbols; the
  in-repo `dist` used by the golden `--check` script was also stale, which had
  masked the mismatch until `dist` was rebuilt.
- Validation: `phase-5-golden`, `route-attached-current-arrow-golden`, and all
  catalog/asset generation `--check` scripts pass; full suite 203/203;
  workspace typecheck clean.
- Commit: `style(razavi): calibrate MOS and current-source arrowheads`.

- Coordination target: coord-land-concurrent-razavi-targets. It owned only
  the stale-expected-value/classifier fixes that made the in-flight work
  internally consistent (`agent-adapter/service.ts` `set_presentation_style`
  case, `schematic-text.test.ts` `style` field, `style-profile.test.ts`
  1.2->1.6) plus the rebuilt `dist` and regenerated goldens, and this log
  entry. It staged and committed the four targets' full file sets.
  `apps/editor/src/App.tsx`, shared by the style and hit-text targets, landed
  with the hit-text commit per that workstream's plan.
- Commit status: all four commits landed on `main`; worktree now clean of the
  concurrent Razavi work.

## 2026-08-08 - WP-A0: freeze text, annotation, and peripheral editing contracts

- Target: freeze the four shared-contract specs, the V1 syntax/object scope,
  and an ADR for the schema major version bump, plus three fixture Projects
  and their formal SVG goldens, before any runtime implementation (WP-A1).
- Changed areas: new ADR 0010 (schema 1->2, four frozen decisions);
  `docs/specs/schematic-model.md` 1.1->1.2 (DraftingLayer, RichText AST,
  VisualAnchor, DraftingObject/Guide, narrowed SchematicAnnotation, migration,
  invariants); `docs/specs/edit-engine.md` 1.7->1.8 (six new edit kinds,
  dry-run anchor/overlap diagnostics, lock discipline);
  `docs/specs/agent-api.md` 2.0->2.1 (Snapshot drafting objects with canonical
  RichText AST, resolved anchors, default-off guide coordinates with
  `includeEditorGuides`, no-injection invariant);
  `docs/specs/editor-interaction.md` 1.2->1.3 (Text/Markup/Guides groups,
  Ctrl+K palette, T/A/G shortcuts, in-place rich-text editor, unified
  hit-test/stacking, construction-line vs guide); ADR README index.
- New fixtures: `fixtures/projects/text-rich-text`,
  `text-route-marker`, `text-callout-guide`, and their
  `fixtures/visual-golden/text-*.svg` goldens, plus
  `scripts/text-annotation-wp-a0-golden.mjs`. Fixtures are expressed with the
  current schema-1 annotation model; WP-A1 reinterprets/enriches them into the
  drafting container. The callout-guide golden contains no Guide bytes (Guides
  never export).
- Frozen decisions (per user, roadmap defaults): RichText V1 six nodes;
  annotations narrow to SchematicAnnotation with plain-text/figure-caption ->
  drafting; Guides persist but always export:false and default-off in
  Snapshot; floating-symbol decorative-only whitelist; schema 1->2 with
  idempotent migration and ADR.
- Dirty-state decision: one concurrent symbol/arrowhead worker (user-confirmed)
  is iterating a third pass on `packages/symbols/**` and
  `scripts/generate-visio-*.mjs`, leaving `render.test.ts` and
  `razavi-catalog.test.ts` red from stale goldens/expectations. That work does
  not overlap this target's owned paths (specs, new fixtures, goldens, plan,
  log); WP-A0 wrote no runtime code, so it cannot affect those failures. The
  three WP-A0 goldens were regenerated against the current source.
- Validation: the three fixtures parse against schema 1 and their goldens are
  idempotent under `text-annotation-wp-a0-golden.mjs --check`; the rich-text
  golden renders subscripts and italic runs, the route-marker golden renders
  the attached current arrow, and the callout-guide golden has zero Guide
  bytes; `npx tsc -p tsconfig.check.json --noEmit` clean; `git diff --check`
  clean. The two red tests are owned by the concurrent worker.
- Commit status: ready for
  `docs(specs): freeze text, annotation, and peripheral editing contracts (WP-A0)`.

## 2026-08-08 - WP-A0.1: contract revision for six review findings

- Target: re-freeze the WP-A0 contracts before any WP-A1 code, fixing six P0
  gaps that would have caused rework in fallback, delete semantics, hash
  identity, and consumer compatibility.
- Changed areas: ADR 0010 revised to `accepted` (six fixes); schematic-model,
  edit-engine, and agent-api specs updated to match; WP-A1 plan restructured
  into A1a / A1b / integration-gate stages; three `expected-schema2.json`
  post-migration expectation fixtures added; WP-A0 plan Guide-Snapshot wording
  corrected to the ADR/API version.
- The six frozen fixes:
  1. `VisualAnchor` now persists `fallbackPosition` on `object`/`route`;
     warning state is a derived diagnostic, not a persisted boolean; V1
     `object` anchors target only Instance/Port/Junction (no drafting-to-
     drafting cycles).
  2. Anchor-target delete is non-cascading and non-rejecting: same transaction
     writes `fallbackPosition`, anchor becomes unresolved; content locks do not
     block fallback maintenance.
  3. `electricalTopologyHash` replaces the over-broad `topologyHash` (current
     impl covers the whole Snapshot minus diagnostics, per snapshot.ts:397);
     it covers only instances/ports/Nets/hierarchy, so the migration invariant
     actually holds.
  4. WP-A1 staged A1a (v2 types + migration + resolver, constant stays 1) ->
     A1b/WP-A2 (renderer/Snapshot consumption) -> integration gate (flip
     constant, rename hash, remove old kinds); `main` never sits in a
     "migrates but text/markers vanish" state.
  5. RichText restated as four node kinds with `span` four styles, plus frozen
     resource bounds (depth 4, 64 runs, 256 chars/run, non-empty fraction).
  6. `voltage` migration is a deterministic rule: resolvable `attachedObjectId`
     -> object-anchor route-marker/voltage; else free DraftText + migration
     diagnostic; never guess Route/segmentIndex/t. Review signal is a migration
     diagnostic, not a scattered field.
- Plus P1: floating-symbol `decorative` validation is Edit-Engine-resolver-
  enforced (not model Zod); WP-A0 fixtures get schema-2 expectation JSON.
- Validation: documentation + deterministic-expectation fixtures only; no
  runtime code changed. `npx tsc -p tsconfig.check.json --noEmit` clean and
  `git diff --check` clean as a no-code-edit guard.
- Commit status: ready for
  `docs(specs): re-freeze text/annotation contracts with fallback, hash, and sequencing fixes (WP-A0.1)`.

## 2026-08-08 - WP-A1a: v2 model types, migration, anchor resolver, typed edits

- Target: land the schema-2 model foundation, versioned migration, general
  VisualAnchor resolver, electricalTopologyHash, and the six typed Edit Engine
  edits as an additive A1a step. CURRENT_PROJECT_SCHEMA_VERSION stays 1; the
  integration gate (separate commit, after A1b) flips it to 2.
- Changed areas:
  - model: schema.ts adds RichTextDocument/Run (four node kinds, span four
    styles, bounds depth 4 / 64 runs / 256 chars / non-empty fraction),
    VisualAnchor (free|object|route with fallbackPosition), Guide,
    DraftingObject union (text/arrow/leader/callout/construction-line/
    floating-symbol), DraftingLayer; optional `drafting` on SchematicDocument;
    RouteMarkerKindSchema and optional markerKind field (route-marker enum
    entry deferred to the gate so renderer/editor typecheck unchanged);
    factories createEmptyDocument emits an empty drafting layer; new
    migration-v1-to-v2.ts (deterministic voltage rule, idempotent, migration
    diagnostics) + 7 tests; index exports.
  - derived: new anchor.ts resolveVisualAnchor (generalizes
    routeAttachmentPlacement; fallback + diagnostic, never silent re-attach;
    object anchors target Instance/Port/Junction only); new topology-hash.ts
    electricalTopologyHash (instances/ports/Nets/hierarchy only); tsconfig
    adds node types; index exports; 8 tests.
  - edit-engine: transaction.ts adds upsert/remove_schematic_annotation,
    upsert/remove_drafting_object, set/remove_guide (additive union members)
    with lock checks and a Symbol-Resolver-validated floating-symbol (rejected
    until a terminal-free decorative catalog exists); 7 tests.
  - agent-adapter: service.ts editCategory classifies the six new edits.
- Dirty-state decision: a concurrent worker (user-confirmed) has uncommitted
  symbol/style-profile/visio-script changes that leave render.test.ts,
  style-profile.test.ts, and razavi-catalog.test.ts red from stale
  goldens/expectations. Those failures are not owned by this target and are
  not caused by it; the four packages this target touches (model, edit-engine,
  derived, agent-adapter) are fully green (111/111), the workspace typecheck
  is clean (proving renderer/editor/agent-adapter need no edits), and the
  worker's files are never staged here.
- Validation: model + edit-engine + derived + agent-adapter suites 111/111
  pass; workspace `tsc -p tsconfig.check.json --noEmit` clean; migration
  idempotent and topology-hash-stable; anchor resolver returns fallback +
  diagnostic on deleted route/object; floating-symbol rejected without a
  resolver; `git diff --check` clean.
- Note: route-marker is intentionally absent from AnnotationKindSchema in A1a;
  the migration produces route-marker records that are schema-validated only
  at the integration gate. expected-schema2.json fixtures document the target
  shape.
- Commit status: ready for
  `feat(model): v2 drafting types, schema-1->2 migration, and VisualAnchor resolver (WP-A1a)`.

## 2026-08-08 - Unblock renderer + WP-A1b: drafting consumption

- Target: land the concurrent arrowhead calibration (its symbol geometry,
  goldens, and expectations together) so the renderer is green, then add the
  minimal A1b drafting consumption in the renderer and Agent Snapshot.
- Unblock commit (`style(razavi): finalize arrowhead calibration...`):
  regenerated phase-1/phase-5/route-attached/visio-mos/visio-core-analog/text-*
  goldens and updated style-profile (annotation tokens) and razavi-catalog
  (nmos source-arrow and current-source head geometry) expectations against the
  current symbol assets. Full suite 225/225; all six generation/golden --check
  scripts pass; typecheck clean.
- A1b: render-svg renders DraftText objects in a data-layer="drafting" group
  stacked above annotations (flat text projection; full RichText tspan renderer
  is WP-A2), escapes XML, omits the group when empty, and never renders guides.
  Agent Snapshot exposes drafting.objects (canonical shape) and a guide summary
  (id/visible/locked only); drafting is excluded from topologyHash (renamed to
  electricalTopologyHash at the gate).
- Validation: full suite 229/229 (adds 4 drafting-render tests); workspace
  typecheck clean; agent-adapter typecheck clean.
- Commit status: ready for
  `feat(render): minimal drafting consumption in renderer and Snapshot (WP-A1b)`.

## 2026-08-08 - WP-A1 integration gate: schema 2 live

- Target: flip CURRENT_PROJECT_SCHEMA_VERSION to 2, register the idempotent
  schema-1->2 migration, accept route-marker as a SchematicAnnotation, and
  update every consumer and fixture so the whole workspace is green on the
  single new truth.
- Changed areas:
  - model: CURRENT_PROJECT_SCHEMA_VERSION = 2; route-marker added to
    AnnotationKindSchema with markerKind/anchor (VisualAnchor) validated on
    route-marker; migration registered in defaultProjectMigrations so legacy
    Projects auto-upgrade on read; persistence/schema tests updated.
  - render-svg: route-marker added to SchematicTextKind and the font-size
    switch; migration means current/voltage/figure-caption now render as
    route-marker text / draft-text until WP-A2 builds full marker rendering;
    render.test assertions updated.
  - editor: demo-project.ts and routing-demo.ts use CURRENT_PROJECT_SCHEMA_VERSION.
  - fixtures: minimal, phase-1-manual, phase-2-imported-rlc, phase-3-routing
    Projects upgraded to schema 2; phase-5-dense-analog,
    route-attached-current-arrow, and text-* visual goldens regenerated.
- The migration is idempotent and does not change Net/Route/Junction/instance
  or rewrite SPICE; current -> route-marker/current, voltage -> object-anchor
  route-marker/voltage or free DraftText + migration diagnostic, plain-text/
  figure-caption -> drafting text.
- Note: the topologyHash -> electricalTopologyHash Snapshot field rename is
  deferred to a focused API step (it touches the phase-9 evaluation scripts and
  their fixtures); drafting is already excluded from the hash computation.
- Validation: full suite 229/229; workspace typecheck clean; all six
  generation/golden --check scripts pass; `git diff --check` clean.
- Commit status: ready for
  `feat(model): switch to schema 2 with idempotent migration and route-marker (WP-A1 gate)`.

## 2026-08-08 - WP-A2: unified RichText renderer and route-marker rendering

- Target: build the single RichText AST -> tspan renderer (subscript/superscript/
  italic/bold/fraction) shared by canvas/formal SVG/PNG/PDF, and render
  route-markers fully (current arrow + voltage polarity via the VisualAnchor).
- Changed areas:
  - render-svg: new `rich-text.ts` `renderRichTextDocument` renders the four
    node kinds into tspans honoring the style profile tokens (math weight/style,
    subscript scale + baseline shift reused for superscript, fraction stack);
    drafting text now uses it (monochrome stays byte-stable via flat escape);
    route-marker renders through the existing current/voltage branches by
    resolving its VisualAnchor (`resolveRouteMarkerPlacement` reuses the legacy
    routeAttachmentPlacement math so a migrated current marker renders
    identically to its pre-migration form); `schematic-text.ts` adds route-marker
    to SchematicTextKind and the font-size switch.
  - tests: new `rich-text.test.ts` (5 tests) covering text escape, italic/bold
    spans, sub/superscript, fraction, line-break; render.test assertions updated
    for restored route-marker arrow rendering; drafting-render.test for rich text.
  - goldens: phase-5-dense-analog, route-attached-current-arrow, and text-*
    regenerated.
- Scope decision: removing the legacy plain-text/current/voltage/figure-caption
  annotation kinds is deferred to WP-A3. The editor creates those kinds
  interactively; removing them without the WP-A3 editor rewrite would leave the
  editor unable to author annotations. WP-A3 rebuilds the editor to author
  drafting text / route-markers and removes the legacy kinds together.
- Validation: full suite 234/234; workspace typecheck clean; all six
  generation/golden --check scripts pass; `git diff --check` clean.
- Commit status: ready for
  `feat(render): unified RichText renderer and route-marker rendering (WP-A2)`.

## 2026-08-08 - WP-A3 step: editor authors drafting text and route-marker

- Target: convert the editor's "add text" and "add current arrow" commands
  from the legacy plain-text/current annotation kinds to the ADR 0010 drafting
  text and route-marker edits, so the editor authors the new types and the
  legacy kinds can be retired.
- Changed areas: apps/editor App.tsx addPlainText now commits
  upsert_drafting_object (DraftText, free anchor, single text run), and
  addCurrentArrow now commits upsert_schematic_annotation with a route-marker
  carrying a route VisualAnchor (routeId/segmentIndex/t/normalOffset/direction/
  orientation + fallbackPosition) instead of the legacy current routeAttachment.
- Remaining WP-A3 work (not in this step): the read-side hit-test/bounds/panel
  code still keys on the legacy current kind, so migrated route-marker
  annotations are not yet selectable/editable in the editor; the in-place
  rich-text editor and the unified hit-test/drag/Alt-cycle/box-select redo are
  still pending. Removing the legacy kinds from the model waits for those so
  the editor stays functional.
- Validation: full suite 234/234; editor typecheck clean; `git diff --check`
  clean.
- Commit status: ready for
  `feat(editor): author drafting text and route-marker (WP-A3 step)`.

## 2026-08-08 - WP-A3 read-side: unified hit-test/bounds/drag/panel for route-marker

- Target: make the editor's read-side geometry (anchor resolution, hit box,
  drag constrain/commit, reverse-arrow, panel) handle the migrated route-marker
  annotation whose route association lives on its VisualAnchor, alongside the
  legacy current kind.
- Changed areas: apps/editor App.tsx adds effectiveRouteAttachment() (projects
  a route-marker route VisualAnchor onto the legacy RouteAnnotationAttachment
  shape) and isRoutedMarker(); annotationAnchor, annotationHitBox,
  constrainAnnotationPosition, the drag-commit path, reverseSelectedCurrentArrow,
  and the panel button now route through these helpers, so a migrated
  route-marker is selectable, hit-testable, draggable along its route, and
  reversable. apps/editor clipboard.ts copies route-marker annotations by their
  route VisualAnchor and re-maps the routeId on paste.
- Tests: current-arrow.test.ts adds a route-marker copy/paste case proving the
  route VisualAnchor is preserved and re-mapped.
- Validation: full suite 235/235; editor build succeeds; workspace typecheck
  clean; `git diff --check` clean.
- Commit status: ready for
  `feat(editor): unified route-marker hit-test, drag, and clipboard (WP-A3 read-side)`.

## 2026-08-08 - WP-A3 legacy-kind removal: plain-text/current/voltage/figure-caption

- Target: remove the four legacy annotation kinds now that route-marker and
  drafting text carry their content, leaving the single schema-2 truth.
- Changed areas:
  - model: AnnotationKindSchema narrows to instance-label | net-label |
    power-label | route-marker; the routeAttachment-only-on-current refine is
    gone (routeAttachment remains as a migration-era legacy field);
    migration-v1-to-v2 still reads the removed kinds on its v1 input side
    (tests widened to loose records).
  - render-svg: SchematicTextKind drops the legacy kinds; render.ts route-marker
    branch renders current arrows (shaft + head) and voltage polarity via the
    route VisualAnchor, with the arrow on the conductor and the label riding the
    normal offset (resolveRouteMarkerPlacement returns position + labelPosition);
    figure-caption/plain-text emphasis branches removed; drafting text is the
    single text path.
  - edit-engine/editor/agent-adapter tests updated to route-marker; editor
    reverse-arrow no longer branches on the removed current kind.
  - Goldens regenerated (phase-5, route-attached-current-arrow, text-*).
- The migration contract is unchanged: schema-1 Projects still upgrade on read,
  mapping current -> route-marker/current, voltage -> object-anchor or free
  DraftText + diagnostic, plain-text/figure-caption -> drafting text.
- Validation: full suite 235/235; workspace typecheck clean; all
  generation/golden --check scripts pass; `git diff --check` clean.
- Commit status: ready for
  `feat(model): remove legacy annotation kinds (WP-A3 legacy-kind removal)`.

## 2026-08-08 - Agent Snapshot electricalTopologyHash rename

- Target: complete the ADR 0010 hash work deferred at the WP-A1 gate — rename
  the Snapshot identity field to electricalTopologyHash and compute it from
  electrical facts only.
- Changed areas: agent-adapter schema.ts renames the Snapshot field to
  electricalTopologyHash; snapshot.ts computes it via the shared
  @icm/derived electricalTopologyHash over the Project view (falling back to a
  single-document view when no Project is available); derived topology-hash.ts
  parameter type widened to Pick<CircuitProject, id|topDocumentId|documents>;
  all six phase-9 scripts read the renamed field.
- New tests: snapshot.test.ts proves electricalTopologyHash is stable across
  instance placement, annotation text, and drafting/guide edits, and changes
  when Net terminal membership changes.
- Validation: full suite 237/237; workspace typecheck clean; `git diff --check`
  clean.
- Commit status: ready for
  `feat(agent-api): rename Snapshot identity hash to electricalTopologyHash`.

## 2026-08-08 - WP-A3 rich-text editor: markup parser and drafting text editing

- Target: deliver the parse-on-submit markup path and make drafting text
  objects selectable and editable in the editor (the core of the in-place
  rich-text editor without a full contenteditable widget).
- Changed areas:
  - render-svg: new `markup-parser.ts` parseMarkup / flattenMarkup converting
    the restricted import shorthand (subscripts `_{...}`, superscripts
    `^{...}`, `\it{...}`, `\bf{...}`, `\frac{num}{den}`, line breaks `\\`) to
    the canonical RichText AST; unparseable input is preserved as literal text,
    never dropped. Exported from the package index.
  - editor: drafting text objects now render hit boxes, are selectable, and a
    "Drafting text" panel edits their content as markup and commits
    parseMarkup -> upsert_drafting_object, so the editor authors the AST while
    the user types shorthand.
- Verified end-to-end: parseMarkup(\`V_{in}^{+} = \frac{g_m}{r_o}\`) -> AST ->
  renderRichTextDocument emits subscript, superscript, fraction, and numerator
  tspans.
- Tests: 8 markup-parser tests (plain text, subscript, superscript, italic,
  bold, fraction, line break, unparseable-preservation, flatten).
- Validation: full suite 245/245; editor build succeeds; workspace typecheck
  clean; `git diff --check` clean.
- Commit status: ready for
  `feat(editor): markup-rich text editing for drafting objects (WP-A3 rich text)`.

## 2026-08-08 - WP-A4: Guide tool

- Target: implement the editor Guide tool per the roadmap (add/move/lock/delete
  guides; Guides are editor aids, never exported, never electrical).
- Changed areas: apps/editor adds a "guide" EditorTool and `G` shortcut; the
  Guide tool click adds a vertical guide at the click x; guides render as a
  dashed blue overlay (locked = grey, not draggable) with drag-to-move,
  double-click-to-lock, and Delete-to-remove; the More menu gains a Guides
  group (add vertical/horizontal, show/hide, clear unlocked, Guide tool);
  styles.css adds .guide / .guide-locked / .command-group-label.
- edit-engine: drafting.test adds a locked-guide replacement-rejection test.
- Validation: full suite 246/246; editor build succeeds; workspace typecheck
  clean; `git diff --check` clean.
- Commit status: ready for
  `feat(editor): Guide tool with add/move/lock/delete (WP-A4 guides)`.

## 2026-08-08 - WP-A4 drafting object rendering

- Target: render the remaining DraftingObject kinds so the editor and exports
  show construction lines, arrows, leaders, callouts, and floating symbols.
- Changed areas: render-svg renderDraftingLayer now renders every DraftingObject
  kind: text (existing), construction-line (dashed/dotted per lineStyle), arrow
  (shaft + head), leader (origin-target line), callout (leader + rich text),
  and floating-symbol (resolves the symbol and renders its definition +
  variant primitives, transformed by anchor/rotation/mirror). The layer takes
  the SymbolResolver for floating symbols.
- Tests: drafting-render.test adds construction-line (dashed), draft arrow
  (head polygon), and floating-symbol (primitives + symbol id) cases.
- Validation: full suite 249/249; all golden --check scripts stable; workspace
  typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `feat(render): render construction-line, arrow, leader, callout, floating-symbol (WP-A4 rendering)`.

## 2026-08-08 - WP-A4 decorative symbol capability

- Target: give the Symbol Catalog a decorative capability so DraftFloatingSymbol
  can reference a terminal-free whitelist entry (ADR 0010).
- Changed areas: symbols schema adds optional `decorative` to SymbolDefinition
  and allows zero pins with a refine (decorative -> no terminals;
  non-decorative -> at least one pin); builtins adds `decorative-note-box`
  (a terminal-free dashed rectangle) and registers it first; edit-engine
  floating-symbol validation now requires `definition.decorative` and zero
  pins via the Symbol Resolver.
- Tests: edit-engine drafting.test proves decorative-note-box is accepted and
  nmos (terminal-bearing) is rejected when a resolver is present; builtins.test
  updated for the new symbol id.
- Validation: full suite 250/250; workspace typecheck clean; `git diff --check`
  clean.
- Commit status: ready for
  `feat(symbols): decorative symbol capability for floating symbols (WP-A4 decorative)`.

## 2026-08-08 - WP-A4 editor drafting creation commands

- Target: let the editor create construction lines, free arrows, and floating
  symbols from the More menu.
- Changed areas: apps/editor adds addConstructionLine (dashed horizontal line),
  addFreeArrow (horizontal arrow), and addFloatingSymbol (decorative-note-box
  via the whitelist); the More menu gains a Markup group with the three
  commands. The DocumentHistory context already carries the SymbolResolver, so
  floating-symbol validation runs through the Edit Engine.
- Validation: full suite 250/250; editor build succeeds; workspace typecheck
  clean; `git diff --check` clean.
- Commit status: ready for
  `feat(editor): construction-line, free arrow, and floating-symbol commands (WP-A4 commands)`.

## 2026-08-08 - WP-A5: strict Snapshot drafting schema and GUI/Agent parity

- Target: tighten the Agent Snapshot drafting schema and prove GUI/Agent
  parity for drafting edits (same object, same anchor, same SVG).
- Changed areas:
  - agent-adapter schema.ts: drafting.objects now validates against the shared
    DraftingObjectSchema (canonical RichText AST + VisualAnchor) instead of
    z.unknown(); guide summaries keep id/visible/locked.
  - New parity.test.ts: (1) the same typed drafting edits (route-marker,
    drafting text, guide) submitted through the Agent service `transact` and
    through the shared Edit Engine produce the identical persisted Project,
    identical Document, and identical rendered SVG; (2) adding drafting leaves
    the electrical identity unchanged.
- Validation: full suite 252/252; workspace typecheck clean; `git diff --check`
  clean.
- Commit status: ready for
  `feat(agent-api): strict drafting Snapshot schema and GUI/Agent parity (WP-A5)`.

## 2026-08-08 - WP-A5 regression: regenerate Agent API and phase-9 artifacts

- Target: bring every generated artifact back in sync after the
  electricalTopologyHash rename and the strict drafting Snapshot schema.
- Changed areas: regenerated fixtures/agent-api (request/response schemas and
  OpenAPI, now carrying electricalTopologyHash and the strict drafting object
  schema) and all five phase-9 layout-eval artifacts (generalization report,
  heldout import reports and start projects, snapshot audit, 128-transistor
  render) after the Snapshot field rename.
- Validation: agent-api-artifacts --check passes; all six generation/golden
  --check scripts pass; all five phase-9 --check scripts pass; full suite
  252/252; workspace typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `chore(fixtures): regenerate Agent API and phase-9 artifacts after hash rename (WP-A5 regression)`.

## 2026-08-08 - Markup parser: nested braces in command bodies

- Target: fix the markup parser so fraction/italic/bold/subscript/superscript
  bodies may contain one nested `{...}` group (e.g. `\frac{V_{DD}}{2}`), which
  the roadmap acceptance scenario for `V_{in}^{+} = \frac{V_{DD}}{2}` requires.
- Changed areas: render-svg markup-parser.ts command regexes now match a body
  of plain text or one nested brace group; added a test for a fraction whose
  numerator contains a subscript.
- Verified end-to-end: `V_{in}^{+} = \frac{V_{DD}}{2}` parses to an AST and
  renders subscript, superscript, fraction, numerator, and denominator tspans.
- Validation: full suite 253/253; workspace typecheck clean; `git diff --check`
  clean.
- Commit status: ready for
  `fix(render): parse nested braces inside markup command bodies`.

## 2026-08-08 - Restore browser-compatible editor startup

- Target: restore the GUI after the new electrical topology hash caused the
  browser application to fail during module evaluation.
- Root cause: `packages/derived/src/topology-hash.ts` imported Node-only
  `node:crypto`; Vite externalized it and the editor threw before React could
  mount.
- Changed areas: replaced the Node dependency with a synchronous
  browser/Node-compatible SHA-256 implementation and added an exact digest
  assertion so the public hash contract cannot silently change.
- Validation: focused topology-hash tests 3/3; workspace typecheck; derived
  build followed by editor production build; fresh live browser load at
  `http://localhost:5173/` with the editor DOM present and no console warnings
  or errors; `git diff --check` clean.
- Commit status: ready for
  `fix(editor): keep topology hashing browser compatible`.
## 2026-08-08 - WP-R0 + WP-R1: drafting runtime completion (contract + unified geometry)

- Target: start the Drafting Runtime Completion project per the review: freeze
  the derived-only geometry contract and add the single
  resolveDraftingObjectGeometry entry, so renderer/editor/Snapshot stop each
  re-implementing anchor math.
- WP-R0: ADR 0010 gains a "Runtime completion status" section with the
  per-object capability matrix (honest: model/Edit Engine/basic renderer
  complete; runtime/editor interaction incomplete) and the derived-only
  geometry rule; agent-api spec documents includeEditorGuides (default false)
  and notes the resolved-geometry fields land in WP-R4.
- WP-R1: packages/derived/src/drafting-geometry.ts adds DraftingDiagnostic
  (code/severity/anchorRole/targetObjectIds), ResolvedDraftingGeometry (a
  discriminated union per kind with position(s)/bounds/diagnostics), and
  resolveDraftingObjectGeometry(document, resolver, object) reusing
  resolveVisualAnchor for every anchor field (text->anchor, arrow->from+to,
  leader/callout->anchor+target, floating-symbol->anchor,
  construction-line->points). Invalid anchors use fallbackPosition, emit a
  warning, never guess a new route, never mutate the Document. Bounds rules per
  kind with stroke/arrowhead padding; floating-symbol bounds from the resolved
  symbol viewBox.
- Tests: 8 drafting-geometry tests (free text, object-anchor follow on instance
  move, missing target fallback+diagnostic, route stretch follow + invalid
  segment fallback, arrow dual-anchor, construction-line bounds, unresolved
  floating symbol, determinism).
- Dirty-state note: a concurrent worker committed
  `fix(editor): keep topology hashing browser compatible` (topology-hash.ts)
  while this target ran; it does not overlap drafting-geometry.ts or the owned
  docs. This target's changes are staged independently.
- Validation: full suite 261/261; workspace typecheck clean; `git diff --check`
  clean.
- Commit status: ready for
  `docs(drafting): freeze runtime completion contract and capability matrix (WP-R0)`
  and `feat(derived): resolve drafting object geometry (WP-R1)`.
## 2026-08-08 - WP-R2: renderer consumes unified drafting geometry + bounds

- Target: make the formal SVG renderer and export bounds consume the single
  resolveDraftingObjectGeometry entry, and include drafting bounds so callouts
  and floating symbols outside the circuit are not clipped.
- Changed areas: render-svg render.ts renderDraftingLayer now resolves each
  object's geometry once and passes it to kind-specific renderers; the
  draftObjectPosition helper (which branched on free/fallback) is removed;
  deriveBounds pushes every drafting object's resolved bounds into the export
  viewBox; unresolved anchors still export using the fallback and carry
  data-anchor-resolved="false" without changing the visual style; guides never
  enter formal output or bounds.
- Tests: drafting-render.test adds drafting-bounds-in-viewBox and
  fallback-export-with-diagnostic cases; phase-5/route-attached/text goldens
  regenerated (viewBox now covers drafting content).
- Validation: full suite 263/263; workspace typecheck clean; all golden --check
  scripts pass; `git diff --check` clean.
- Commit status: ready for
  `fix(render): consume unified drafting geometry and include drafting bounds (WP-R2)`.
## 2026-08-08 - WP-R3: lossless rich-text editing

- Target: eliminate the flatten->parse->overwrite corruption path in editing.
- Changed areas: render-svg markup-parser.ts adds serializeMarkup (AST ->
  reversible markup: text verbatim, line-break `\`, span styles `_{}`/`^{}`/
  `\it{}`/`\bf{}`, fraction `\frac{}{}`); editor App.tsx initializes the
  drafting-text draft from serializeMarkup (never flattenMarkup), commits
  parseMarkup -> upsert_drafting_object only when the parsed AST differs from
  the stored AST (no revision for an unedited Apply), and the text control is a
  multi-line textarea (Enter inserts a line break, Ctrl+Enter commits).
- Tests: markup-parser adds round-trip scenarios (V_{in}^{+},
  \frac{V_{DD}}{2}, \it{gain}, \bf{RESET}, line break, nested span, empty span,
  consecutive text runs, Unicode) asserting
  parseMarkup(serializeMarkup(ast)) equals ast, plus a dedicated line-break
  round trip.
- Validation: full suite 265/265; editor build succeeds; workspace typecheck
  clean; `git diff --check` clean.
- Commit status: ready for
  `fix(editor): preserve rich text through lossless markup editing (WP-R3)`.
## 2026-08-08 - WP-R4: Agent Snapshot exposes resolved drafting geometry

- Target: let the Agent read the derived visual facts (resolved position/
  bounds/diagnostics) instead of re-deriving anchors, and support
  includeEditorGuides per the agent-api spec.
- Changed areas: agent-adapter schema.ts adds includeEditorGuides to the
  snapshot request (default false) and wraps each drafting object in
  { object, resolvedGeometry, bounds, diagnostics } (float-tolerant bounds;
  guides gain optional axis/coordinate); snapshot.ts computes resolvedGeometry
  via the single resolveDraftingObjectGeometry entry and includes guide
  coordinates only when the request opts in; service.ts forwards
  includeEditorGuides; Agent API artifacts regenerated.
- Tests: snapshot.test adds resolved-geometry-matches-persisted-anchor and
  guide-coordinates-hidden-by-default / opt-in cases.
- Validation: full suite 267/267; agent-api-artifacts --check passes; workspace
  typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `feat(agent-api): expose resolved drafting geometry and includeEditorGuides (WP-R4)`.
## 2026-08-08 - WP-R5 (part 1): drafting selection, drag, and delete

- Target: fix the drafting selection bug called out in review and give drafting
  objects real selection/drag/delete interactions.
- Changed areas: apps/editor adds selectDraftingObject(id) as the single
  selection entry (clears annotation/route/instance selection, initializes the
  edit draft from serializeMarkup for text); addPlainText now calls it instead
  of the wrong setSelectedAnnotationId; beginDraftingDrag moves a free-anchored
  text via upsert_drafting_object (locked objects are not draggable;
  object/route anchors follow their target by construction and only select);
  deleteSelection removes the selected drafting object via remove_drafting_object
  (rejecting locked objects).
- Validation: full suite 267/267; editor build succeeds; workspace typecheck
  clean; `git diff --check` clean.
- Commit status: ready for
  `feat(editor): drafting selection, drag, and delete (WP-R5 part 1)`.
## 2026-08-08 - WP-R5 (part 2): select/delete all drafting kinds via shared geometry

- Target: give every DraftingObject kind a selectable/deletable hit box derived
  from the shared resolveDraftingObjectGeometry bounds (previously only text
  had one).
- Changed areas: apps/editor drafting hit-box rendering now maps every
  drafting object to a rect spread from geometry.bounds (not a text-only
  estimate); free-anchored unlocked text drags via beginDraftingDrag, all other
  kinds select via selectDraftingObject; the shared geometry bounds replace the
  flattenMarkup width estimate.
- Validation: full suite 267/267; editor build succeeds; workspace typecheck
  clean; `git diff --check` clean.
- Commit status: ready for
  `feat(editor): select/delete all drafting kinds via shared geometry (WP-R5 part 2)`.
## 2026-08-08 - WP-R6: parity rename, real browser E2E, and full exit gate

- Target: complete the Drafting Runtime Completion project with a truthful
  parity test name, real browser coverage of drafting workflows, and the full
  exit gate.
- Changed areas:
  - parity.test.ts renamed "GUI/Agent drafting parity" to "Agent/Edit Engine
    drafting parity" and clarified it exercises typed-edit semantics, not the
    GUI.
  - New apps/editor/e2e/drafting.spec.ts with three browser scenarios:
    (A) add drafting text with rich markup V_{in}^{+} = \frac{V_{DD}}{2}, assert
    the canonical AST is persisted (fraction + span runs) and undo/redo
    restores it; (E) export bounds include drafting and guides never appear in
    the exported SVG; (F) the production build mounts with no console errors.
  - Prettier formatting normalized 21 files (including files from earlier WP-R
    commits that did not match the repo style gate).
- Exit gate (all pass): format:check; typecheck; vitest 267/267; pnpm build
  (12 packages); playwright test 10/10; agent-api-artifacts --check; phase-5/
  route-attached/text golden --check; release:package; git diff --check.
- Commit status: ready for
  `test(editor): drafting E2E, parity rename, and formatting (WP-R6)`.

## 2026-08-08 - Razavi unified MOS presentation

- Target: make Razavi a single, consistent manual MOS presentation instead of
  allowing raw three-terminal stencil assets and the canonical four-terminal
  arrow to leak into the editor palette.
- Changed areas: standard NMOS/PMOS palette placement persists the canonical
  `textbook-3terminal` visual variant while retaining D/G/S/B electrically;
  thumbnails resolve that same variant; raw `nmos3`/`pmos3` imports remain in
  the catalog as provenance but are no longer palette choices; calibrated
  source-arrow support lines meet their triangle base with a butt cap, while
  base four-terminal bulk primitives are unchanged. Regenerated the MOS
  assets, Razavi catalog, and fidelity board.
- Tests: 16 focused editor/symbol Vitest tests; editor production build; 2
  relevant browser E2E scenarios; both MOS and Razavi generated-asset checks;
  `git diff --check` clean.
- Commit status: ready for `fix(razavi): unify default MOS presentation`.

## 2026-08-08 - Razavi existing MOS presentation migration

- Target: apply the Razavi visual contract to eligible legacy MOS instances,
  not just newly placed components.
- Changed areas: applying (or reapplying) Razavi now batches canonical
  NMOS/PMOS visual-variant edits in the same undoable transaction. An absent
  bulk net or supply bulk (`0`, GND, VSS, VDD, VDDA, VSSA, VGND, VPWR) is shown
  in the three-terminal textbook view; an independent body-bias net remains
  four-terminal and electrically visible.
- Tests: focused App test validates the classifier; browser E2E opens a legacy
  project, applies Razavi, saves it, and proves an eligible PMOS migrated while
  an NMOS on local Vbody did not. Focused 5-test Vitest, editor build, and 3
  relevant browser tests passed; `git diff --check` clean.
- Commit status: ready for
  `fix(razavi): migrate eligible existing MOS to textbook view`.

## 2026-08-08 - Razavi MOS arrow seam and PMOS parity

- Target: remove visible gaps at the MOS source arrow and verify PMOS receives
  the same three-terminal presentation contract as NMOS.
- Changed areas: the VSS-derived source-arrow support now extends under its
  later-rendered filled triangle by half a source-shape stroke; triangle and
  electrical coordinates remain unchanged. Catalog tests verify both NMOS and
  PMOS hide `bulk-lead` / `source-arrow-host` and expose a filled source arrow
  with the calibrated, overlapping support line.
- Validation: focused 17-test symbol/editor Vitest, both generated-asset
  checks, and browser palette E2E passed; `git diff --check` clean.
- Commit status: ready for
  `fix(razavi): close MOS arrow seams and verify PMOS variant`.

## 2026-08-08 - Razavi MOS arrow family unification

- Target: ensure PMOS and NMOS use the same visible Razavi source-arrow
  proportions, allowing only their physical arrow direction to differ.
- Changed areas: decoded PMOS / PMOS3 VSS source markers are 22/25 of NMOS
  after symbol transforms. The generator compensates their arrow-only metrics
  by 25/22, so both polarity families have visible length 8.28 and half-width
  3.78675. Four-terminal pin geometry and topology remain intact.
- Validation: focused 12-test catalog test, MOS and catalog generation checks,
  palette browser E2E, and `git diff --check` passed.
- Commit status: ready for
  `fix(razavi): unify PMOS and NMOS arrow proportions`.

## 2026-08-08 - MOS terminal presentation control

- Target: make the preserved four-terminal MOS view explicitly usable in the
  editor, rather than leaving it as an unexposed base symbol.
- Changed areas: selected canonical NMOS/PMOS has inspector actions for
  textbook three-terminal and Bulk-visible four-terminal presentation. The
  switch is a typed, undoable `set_instance_symbol` edit; it retains the same
  symbol ID and D/G/S/B electrical terminals while changing only the visual
  variant.
- Validation: editor build and a PMOS browser E2E prove B appears when the
  four-terminal view is selected and disappears when textbook view returns;
  `git diff --check` clean.
- Commit status: ready for
  `feat(editor): expose MOS three and four terminal views`.
## 2026-08-08 - P0-2: drafting drag uses preview and commits one transaction

- Target: fix the review P0 that a drafting drag committed one transaction per
  pointermove (dozens of revisions, undo per mouse sample, history bloat).
- Changed areas: apps/editor beginDraftingDrag now records a live position in
  draftingDragPositionRef and a draftingDragPreview state during pointermove
  (no transact); pointerup reads the ref and commits ONE upsert_drafting_object;
  Escape/pointercancel discard the preview. The drafting hit box follows the
  preview during the drag so the object appears to move without committing.
  Transact is never called from a React state updater (Strict Mode would run it
  twice); also fixed a worker-introduced typecheck break in setPresentationStyle
  (kind literal narrowing).
- E2E: drafting drag commits one revision and undoes atomically (long 12-step
  drag -> revision 3, one Ctrl+Z -> revision 4 and position restored).
- Validation: full suite 270/270; drafting E2E 4/4; editor build succeeds;
  workspace typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `fix(editor): drafting drag preview with single atomic commit (P0-2)`.
## 2026-08-08 - P1: freeze final-rotation semantics (geometry is the single truth)

- Target: fix the review P1 that derived geometry reported anchor rotation
  while the renderer used the raw persisted object rotation, so bounds and SVG
  disagreed.
- Changed areas: derived drafting-geometry.ts adds composeRotation with the
  frozen rule finalRotation = anchor.orientation === "follow"
  ? normalize(anchorRotation + object.rotation) : object.rotation, applied to
  text and callout; render-svg render.ts text/callout now consume
  geometry.rotation instead of object.rotation, so renderer, export bounds, and
  Snapshot all report the same rotation.
- Tests: drafting-geometry adds a rotation-semantics case (follow route anchor
  composes 0+90 -> 90; horizontal/non-follow and free anchors keep object
  rotation).
- Validation: full suite 271/271; workspace typecheck clean; goldens stable;
  `git diff --check` clean.
- Commit status: ready for
  `fix(derived): freeze composed rotation as the single geometry truth (P1 rotation)`.
## 2026-08-08 - P1: accurate floating-symbol and multi-line text bounds

- Target: fix the review P1 that floating-symbol bounds ignored viewBox x/y,
  put mirror-x on the wrong side, did not swap width/height on 90/270, and
  never applied the SVG transform; and that text bounds used a fixed height and
  did not read typographyToken or count lines.
- Changed areas: derived drafting-geometry.ts transformSymbolCorner applies the
  exact SVG transform (translate(position) rotate(rotation) scale(-1 1) for
  mirror-x) to all four viewBox corners and takes the AABB; textBounds now
  takes a per-token font size (caption 14, body/label 16), measures lines from
  line-break runs, and flattens nested spans/fractions recursively instead of a
  fixed "XX". Renderer and Snapshot consume the same geometry.
- Tests: drafting-geometry adds floating-symbol rotate/mirror AABB and
  multi-line text height/width cases.
- Validation: full suite 273/273; goldens regenerated (text bounds changed the
  export viewBox); workspace typecheck clean; all golden --check pass;
  `git diff --check` clean.
- Commit status: ready for
  `fix(derived): accurate floating-symbol and multi-line text bounds (P1 bounds)`.
## 2026-08-08 - P1: strict Snapshot geometry schema (no z.unknown, no duplicate bounds)

- Target: fix the review P1 that Snapshot resolvedGeometry/diagnostics were
  z.unknown and bounds appeared both at entry level and inside resolvedGeometry.
- Changed areas: packages/model/src/drafting-geometry-schema.ts defines and
  exports ResolvedDraftingGeometrySchema (a discriminated union per kind with
  typed position/rotation/bounds/diagnostics) and DraftingDiagnosticSchema
  (typed code/severity/anchorRole/targetObjectIds); agent-adapter schema.ts
  references them and drops the redundant top-level bounds (resolvedGeometry
  carries bounds); snapshot.ts no longer emits entry.bounds. OpenAPI/JSON
  artifacts regenerated with a typed resolvedGeometry.
- Validation: full suite 273/273; agent-api-artifacts --check passes; workspace
  typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `feat(agent-api): strict drafting geometry schema in Snapshot (P1 typed)`.
## 2026-08-08 - P1: canvas drag-create for construction line and arrow

- Target: replace the fixed viewport-center insert for construction lines and
  arrows with real canvas drag gestures (press start, drag, release end) per
  the review P1.
- Changed areas: apps/editor EditorTool gains construction-line and arrow;
  beginCanvasGesture starts a draftingCreatePreview on pointerdown, move
  updates the end point, finishCanvasGesture commits one typed edit via
  commitDraftingCreate; a dashed drafting-create-preview line renders during
  the drag; the More Markup menu activates the tools instead of the old fixed
  insert. addFloatingSymbol stays a click-place.
- E2E: two new tests drag-create a construction line and an arrow, each
  committing exactly one revision.
- Validation: full suite 273/273; drafting E2E 6/6; editor build succeeds;
  workspace typecheck clean; goldens regenerated after a rebuild aligned
  source and dist symbol geometry; `git diff --check` clean.
- Commit status: ready for
  `feat(editor): canvas drag-create for construction line and arrow (P1 tools)`.
## 2026-08-08 - P2: distinguish invalid route segment diagnostics

- Target: fix the review P2 that DRAFTING_ROUTE_SEGMENT_INVALID was declared but
  never returned (route missing / polyline failure / segment out of range all
  collapsed into DRAFTING_ANCHOR_TARGET_MISSING).
- Changed areas: derived anchor.ts AnchorDiagnostic.code is now a precise
  union; resolveRouteAnchor returns DRAFTING_ROUTE_SEGMENT_INVALID when the
  route exists but its segment is invalid, and DRAFTING_ANCHOR_TARGET_MISSING
  for a missing route/unresolvable polyline; drafting-geometry propagates the
  precise code for both text and object anchors.
- Tests: drafting-geometry adds a case proving an out-of-range segmentIndex
  yields DRAFTING_ROUTE_SEGMENT_INVALID and a missing route yields
  DRAFTING_ANCHOR_TARGET_MISSING.
- Validation: full suite 274/274; workspace typecheck clean; agent-api
  artifacts regenerated; `git diff --check` clean.
- Commit status: ready for
  `fix(derived): return precise invalid-route-segment diagnostics (P2)`.
## 2026-08-08 - P1: shape-based drafting hit targets

- Target: fix the review P1 that every drafting object used a full bounding-rect
  hit area (pointer-events all), blocking canvas clicks under long
  leader/callout/arrow boxes.
- Changed areas: apps/editor drafting hit rendering now uses the object's
  actual shape: stroke polyline for construction lines, stroke line for
  arrows/leaders/callouts (shaft), and a rect only for text/floating-symbol
  (whose natural hit is a box). beginDraftingDrag accepts any SVG element.
- E2E: a new test proves a construction line selects via a polyline stroke hit
  and the element tag is polyline, not rect.
- Validation: full suite 274/274; drafting E2E 7/7; editor build succeeds;
  workspace typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `fix(editor): shape-based drafting hit targets (P1 hit)`.
## 2026-08-08 - P1: key-scenario E2E coverage + click-without-move fix

- Target: add the review-required E2E scenarios (unedited Apply no revision,
  drag atomic undo, anchor persistence) and fix the discovered bug that
  clicking a drafting text to select it committed a no-op revision.
- Changed areas: apps/editor beginDraftingDrag commits only when the pointer
  actually moved (click-without-move just selects, no revision); drafting.spec
  adds: unedited Apply keeps revision, drag-create commits one revision and one
  Ctrl+Z undoes it, drafting anchor survives save/recovery.
- Validation: drafting E2E 9/9; full suite 274/274; editor build succeeds;
  workspace typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `fix(editor): no-op drafting click; add key-scenario E2E (P1 scenarios)`.
## 2026-08-08 - P1: real production preview smoke

- Target: fix the review P1 that the "production build mounts" E2E actually ran
  the vite dev server, so it never exercised the production bundle.
- Changed areas: scripts/editor-production-smoke.mjs builds the editor, serves
  the dist with vite preview on 127.0.0.1:4174, opens it in a real Chrome
  browser, asserts the schematic canvas mounts, and fails on any console/page
  error or on "node:crypto has been externalized". Adds
  test:production-smoke / :check scripts and a committed report fixture
  (fixtures/editor-production-smoke/report.json) with --check idempotency.
- Validation: production smoke passes (mounted, 0 console errors, no
  node:crypto externalization); drafting E2E 9/9; full suite 274/274;
  workspace typecheck clean; `git diff --check` clean.
- Commit status: ready for
  `test(editor): production preview smoke against the built bundle (P1 smoke)`.
## 2026-08-08 - Final exit gate + formatting normalization

- Target: run the full Drafting Runtime Completion exit gate and normalize
  formatting so the workspace is clean.
- Changed areas: prettier --write normalized 8 files (drafting geometry/anchor,
  markup, editor App/e2e, smoke script, visio generator); full exit gate runs.
- Validation (all pass): format:check; typecheck; vitest 274/274; pnpm build
  (12 packages); playwright 19/19 (manual-editor 10 + drafting 9);
  editor-production-smoke --check; agent-api-artifacts --check; golden --check;
  release:package; git diff --check.
- Commit status: ready for
  `chore: format normalization after Drafting Runtime Completion (exit gate)`.
