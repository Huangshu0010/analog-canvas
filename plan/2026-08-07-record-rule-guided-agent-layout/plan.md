# Refine Agent Reasoning Architecture and Prepare Phase 9

## Goal

Refine the proposed Agent-layout architecture around one complete, read-only
Document Snapshot; a two-part Skill/knowledge layer; safe typed edits; rendering;
and precise diagnostics. Remove the planned generic query language, make the
Skill and baseline trials lead Phase 9, and defer optional helpers until real
Agent measurements justify them.

## Dirty-State Note

Latest start state from `git status --short --branch`:

```text
## main...origin/main
 M apps/editor/e2e/manual-editor.spec.ts
 M apps/editor/src/App.tsx
 M docs/agent/README.md
 M docs/specs/symbol-dsl.md
 M fixtures/visual-golden/phase-1-manual.svg
 M fixtures/visual-golden/phase-5-dense-analog.svg
 M fixtures/visual-golden/phase-5-symbol-review.svg
 M fixtures/visual-golden/vss-migration-candidates.svg
 M packages/symbols/src/builtins.test.ts
 M packages/symbols/src/builtins.ts
 M packages/symbols/src/schema.ts
 M plan/log.md
?? docs/agent/rule-guided-layout-architecture.md
?? netlists/rlc-rf-bandpass-100mhz/razavi-100mhz-bandpass.*
?? netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-6bit-cdac.*
?? netlists/sky130-switched-capacitor-dac-6bit-pvt/razavi-layout.mjs
?? plan/2026-08-07-fix-manual-wire-endpoints-and-junction-delete/
?? plan/2026-08-07-record-rule-guided-agent-layout/
?? tools/agent-layout/
```

The editor, symbol, specification, golden-fixture, and manual-wire plan changes
belong to the user or another work target and remain untouched. The generated
circuit artifacts and prototype layout tooling are useful evidence but are not
owned by this documentation target. `docs/agent/README.md`, `plan/log.md`, this
plan, and the architecture draft are this target's existing changes and may be
refined.

During validation, additional `razavi-6bit-cdac-unit.*` artifacts and
`plan/2026-08-07-complete-cdac-hierarchy-layout/` appeared. They also belong to
another active target and remain untouched.

Later validation also observed concurrent render, SPICE, symbol-resolver,
hierarchical-block, corpus/golden, and
`plan/2026-08-07-render-faithful-hierarchical-ports/` changes. They remain
outside this documentation target and were not edited here.

## Owned Files

- `docs/agent/rule-guided-layout-architecture.md`
- `docs/agent/knowledge-and-skill-plan.md`
- `docs/agent/README.md`
- `docs/roadmap/phase-9-agent-reasoning-and-observability.md`
- `docs/roadmap/README.md`
- `plan/2026-08-07-record-rule-guided-agent-layout/plan.md`
- `plan/log.md`

## Read-Only Files

- `docs/overall-product-plan.md`
- `docs/specs/`
- `docs/agent/layout-guidance.md`
- `docs/roadmap/phase-0-contracts-and-scaffold.md`
- `docs/roadmap/phase-1-core-editor-slice.md`
- `docs/roadmap/phase-2-spice-import.md`
- `docs/roadmap/phase-3-connectivity-and-routing.md`
- `docs/roadmap/phase-4-full-spice-baseline.md`
- `docs/roadmap/phase-5-symbols-and-visual-quality.md`
- `docs/roadmap/phase-6-agent-api.md`
- `docs/roadmap/phase-7-export-and-hardening.md`
- `docs/roadmap/phase-8-direct-manipulation-and-manual-authoring.md`
- `packages/`
- `apps/editor/`
- `tools/agent-layout/`
- `netlists/`

## Shared Dependencies

- Project/Document hierarchy and persistence contracts.
- Agent API `capabilities/query/transact/render` boundary.
- Edit Engine typed-edit and revision semantics.
- Existing connectivity, routing, symbol, and visual-language contracts.

## Expected Work

1. Replace the formal Layout Intent/compiler proposal with an Agent-internal
   reasoning boundary and explicit product responsibilities.
2. Replace `select/expand/include` query planning with a complete derived
   `AgentDocumentSnapshot` and a simple refresh/switch path.
3. Reduce the Agent-facing documentation runtime to two parts: one governing
   `SKILL.md` and an on-demand knowledge library.
4. Record the revised large-circuit, revision refresh, file-flow, package,
   compatibility, and optional-helper boundaries.
5. Reorder Phase 9 around Snapshot/Skill co-design, early baseline trials,
   measured product-gap closure, and late optional acceleration.
6. Update the Agent and roadmap indexes and record the target in the maintenance
   log.

## Validation

- Run Prettier on all owned Markdown files.
- Check local Markdown links in the architecture, Agent index, Phase 9, and
  roadmap index.
- Check fenced code-block balance.
- Run `git diff --check`.
- Run `git status --short --branch` and confirm unrelated tracked and untracked
  work remains untouched.

These checks cover a documentation-only change without unnecessarily running
the product test suite.

## Experience Signal (for human review)

The RLC and CDAC experiments showed that the Agent benefits from complete
circuit facts, typed edits, revision checks, rendering, and precise feedback;
neither a query-planning language nor a formal Layout Intent improved its core
reasoning. This remains proposed until the Snapshot/Skill contract is reviewed.

## Commit Intent

Commit as:

```text
Prepare Snapshot-driven Agent workflow phase
```
