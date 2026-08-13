---
status: completed
experience: none
---

# Canonical junction nodes

## Goal

Replace direction-only junction heuristics with topology-backed canonical contact nodes so ordinary Wire-to-Route branches consistently create and render junction dots across Route, pin, Port, collinear, and power-Net corner cases without turning geometric crossings into electrical connections.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/canonical-junction-nodes...origin/main
```

The dedicated worktree is clean and starts at `origin/main` commit `525f770`, which includes the merged Agent Project lifecycle. This target owns:

- `packages/derived/src/contact.ts`
- `packages/derived/src/contact.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `fixtures/visual-golden/phase-5-dense-analog.svg`
- `fixtures/exports/phase-7-dense-analog/**`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/editor-interaction.md`
- `plan/2026-08-14-canonical-junction-nodes/plan.md`
- `plan/log.md`

Shared dependencies are the persisted Route/Junction/Net schemas and typed Edit Engine operations. They remain read-only unless characterization proves a schema or edit-contract change is necessary.

## Work

1. Characterize current contact evidence and Wire completion for route T branches, pin-on-route, coincident endpoints, collinear branches, Ports, power rails, and pure crossings.
2. Derive contact incidents from authored topology rather than every same-Net segment that happens to pass through a coordinate; retain explicit coincident endpoints as one canonical node.
3. Classify visible junction dots from independent route-arm count, terminal multiplicity, and branch directions instead of direction count alone.
4. Restrict power-rail dot suppression to contacts actually located on thick power-rail geometry rather than every node on the same VDD Net.
5. Ensure Wire completion that snaps to a Route always uses the canonical split/Junction edit path, with browser regression coverage for the reported T-branch behavior.
6. Update the accepted connectivity and interaction contracts, then run focused and branch-level validation.

## Validation

- `pnpm test:local packages/derived/src/contact.test.ts packages/render-svg/src/render.test.ts packages/edit-engine/src/wire-editing.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep <junction scenarios>`
- affected package builds and workspace typecheck
- `pnpm verify:branch` if the final change crosses editor, derived, renderer, and specifications as expected
- `git diff --check`
- `git status --short --branch`

Tests must distinguish true authored topology from same-coordinate geometric crossings; they must not merely assert implementation details.

## Commit Intent

Commit as:

```text
fix(connectivity): canonicalize junction node presentation
```

## Outcome

Canonical contact evidence now counts only explicitly authored same-Net
endpoints and Route ends. Geometric same-Net pass-through remains a crossing,
while every three-arm topology renders a junction dot even when arms overlap
or share a direction. Power-rail dot suppression is local to contacts actually
incident on the thick rail, so ordinary VDD branches retain their dots. No
persisted schema or Edit Engine operation changed; the existing route-tap and
component-on-Route transactions now feed the corrected shared read model.

Focused contact/render/edit tests, four routing browser regressions, all 728
unit tests, workspace typecheck/build, production smoke, visual/export golden
checks, docs/format/reference checks, and `git diff --check` passed.
