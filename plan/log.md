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
