---
status: completed
experience: none
---

# Evidence-driven named Nets

## Goal

Stop Net Label and Free Net Port naming from destructively merging Base Nets.
Resolve schema-22 name/source/equivalence evidence once, then use the same
logical result for annotation text, highlight/connectivity indexing, and
design-netlist extraction so authoring remains visually and electrically
closed through export.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/project-net-lifecycle...origin/codex/project-net-lifecycle
```

The dedicated worktree is clean at `d47073e4`; no user or worker paths overlap.

- `packages/derived/src/logical-net.ts`
- `packages/derived/src/logical-net.test.ts`
- `packages/derived/src/index.ts`
- `packages/derived/src/connectivity-index.ts`
- `packages/derived/src/connectivity-index.test.ts`
- `packages/derived/src/annotation-text.ts`
- `packages/derived/src/annotation-text.test.ts`
- `packages/derived/src/net-highlight.test.ts`
- `packages/netlist/src/extract.ts`
- `packages/netlist/src/current-contract.test.ts`
- `packages/edit-engine/src/named-net-planner.ts`
- `packages/edit-engine/src/named-net-planner.test.ts`
- `packages/model/src/schema/document.ts`
- `packages/model/src/schema.test.ts`
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/properties/use-properties-editor.ts`
- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/hierarchy.spec.ts` (read-only browser contract)
- `packages/agent-client/src/authoring-helper.ts` (retain retired Agent raw
  `set_net_name`; do not route it through the GUI evidence planner)
- `packages/agent-client/src/authoring-helper.test.ts`
- `docs/adr/0039-connectivity-evidence.md`
- `docs/specs/schematic-model.md`
- `docs/specs/edit-engine.md`
- `docs/specs/circuit-ir.md`
- `plan/2026-08-23-evidence-driven-named-nets/plan.md`
- `plan/log.md`

Power-marker, Cell formal-interface, SPICE source-state UI, Net Inspector, and
legacy-field retirement remain read-only follow-ups. Physical wire contact may
still use the internal `merge_nets` atomic primitive; this target removes only
semantic same-name merges from the named-Net planner and its GUI callers.

## Work

1. Add one pure deterministic Document logical-Net resolver. Union Base Nets
   by explicit equivalence, matching scoped name claims, and matching SPICE
   source identity. Return canonical groups, Base-to-logical lookup, resolved
   name/scope, evidence IDs, and explicit conflicts without persisting derived
   state.
2. Make the existing Project connectivity index aggregate every Base Net in a
   logical group while preserving Base-Net lookup aliases, so current callers
   automatically highlight and trace all evidence-equivalent geometry.
3. Make annotation text prefer its owner-addressed claim and otherwise the
   resolver's unambiguous logical name, falling back to transitional
   `Net.name` only when no evidence resolves a name.
4. Make netlist extraction emit one node per resolved logical group, map every
   member Base Net terminal to that node, and diagnose name/scope conflicts.
   Generated names remain deterministic per logical group.
5. Change `planEnsureNamedNet` to require an owner and stable evidence ID,
   author/update a claim on the candidate Base Net, and emit neither
   `merge_nets` nor a new `Net.name` projection. Existing schema-migrated
   `Net.name` values remain readable, but new owner lifecycle must not survive
   owner deletion through an unowned legacy field. When editing a previously
   explicit/imported name, update that explicit claim deliberately so schema-21
   migrations and SPICE imports do not acquire an accidental conflict.
6. Migrate Route Net Label and Free Net Port placement/rename callers. Deleting
   their annotation/Instance uses the L4a owner cleanup and reveals any
   remaining claim without destroying physical topology.

## Validation

- `pnpm test:local packages/derived/src/logical-net.test.ts packages/derived/src/connectivity-index.test.ts packages/derived/src/annotation-text.test.ts packages/derived/src/net-highlight.test.ts packages/netlist/src/current-contract.test.ts packages/edit-engine/src/named-net-planner.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Free Net Ports|Net Label|highlight|structural SPICE"`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: full
- Early gates: gate-review, static contracts, and test-impact.
- Affected gates: workspace units plus hierarchy, project-file, Agent, and
  manual-editor browser contracts selected by the stacked branch diff.
- Final gates: canonical `pnpm ci:check` and remote required checks before
  mainline delivery.
- Risk: this changes electrical identity without changing persisted schema.
  Export, UI text, and highlight must consume the same resolver in this target;
  no second name-folding implementation is allowed.

## Test Impact

- Decision: tests-updated
- Primary contracts: resolver union/conflict determinism, one-node netlist
  extraction, multi-Base highlight, owner-specific annotation text, and
  planner proof that semantic naming emits no `merge_nets`.

## Commit Intent

Commit as:

```text
feat(connectivity): resolve evidence-driven named nets
```

## Outcome

Added one deterministic Logical-Net resolver and migrated GUI Free Net
Port/Route Label authoring, owner-specific annotation text, document/project
connectivity indexing, hierarchy/global highlighting, and design-netlist
extraction. Matching claims preserve separate physical Base Nets while sharing
one logical/export node; conflicts remain explicit. Label deletion and final
Port deletion now remove their claims and unreachable Base Nets without an
unowned `Net.name` projection keeping the name alive. The retired Agent keeps
its bounded raw legacy rename and cannot author evidence.

Validation passed: focused model/edit/derived/netlist contracts (381), affected
browser gates (24 component insert, 12 hierarchy, 10 project file, 1 Agent, 98
manual editor), all 1204 unit tests, build and production smoke, and canonical
`ci:check` including all 207 browser scenarios. The first canonical run exposed
three stale stacked lifecycle/schema browser expectations; they were repaired
and committed independently as `a8f51b71` before the green rerun.
