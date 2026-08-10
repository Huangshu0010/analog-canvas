# Text, Annotation, and Peripheral Editing System Plan

## Goal

Produce an execution-ready design plan for a coherent text, annotation,
callout, arrow, guide, and floating-symbol editing system. The plan must
separate visual-only drafting objects from electrical schematic objects and
define a staged, testable delivery path.

## Dirty-State Decision

The repository contains active uncommitted work across the editor, model,
renderer, symbol assets, visual goldens, and several other target plans. This
documentation target owns only the new roadmap document, this target plan, and
its factual log entry. All existing product code, fixtures, assets, and target
plans are read-only; their current behavior is inspected as evidence only.

## Owned Files

- `docs/roadmap/text-annotation-peripheral-editing-plan.md`
- `plan/2026-08-08-text-annotation-peripheral-system-plan/plan.md`
- `plan/log.md`

## Read-Only Dependencies

- `packages/model/src/**`
- `packages/edit-engine/src/**`
- `packages/derived/src/**`
- `packages/render-svg/src/**`
- `apps/editor/src/**`
- `packages/agent-adapter/src/**`
- `docs/specs/**`
- existing roadmap and Agent guidance documents

## Expected Work

1. Audit the current annotation schema, typed transaction boundary, route
   attachment support, SVG rendering, Agent Snapshot, and editor command
   surfaces.
2. Define a minimal durable object model that covers rich text, route-attached
   electrical annotations, free graphic annotations, guides, and decorative
   floating symbols without contaminating SPICE connectivity.
3. Specify interaction rules, keyboard/pointer behavior, Agent API semantics,
   migration strategy, sequencing, ownership boundaries, acceptance tests, and
   explicit non-goals.
4. Publish the plan under `docs/roadmap/` and record the factual outcome.

## Validation

- [x] inspect cross-references and stated current behavior against the source tree
- [x] `git diff --check`
- [x] `git status --short --branch`

## Outcome

- Published the proposed execution plan at
  `docs/roadmap/text-annotation-peripheral-editing-plan.md`.
- The plan preserves electrical label semantics, separates exportable drafting
  from editor-only guides, and stages shared-contract work before any UI button
  additions.

## Commit Intent

```text
docs(roadmap): plan text and peripheral editing system
```
