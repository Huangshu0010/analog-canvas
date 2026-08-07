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
