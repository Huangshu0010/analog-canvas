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
