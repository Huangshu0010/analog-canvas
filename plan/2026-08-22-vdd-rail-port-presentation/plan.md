---
status: completed
experience: none
---

# Refine Power Rail Orientation and VDD Port Label Presentation

## Goal

Preserve the remote mainline's generic `Power Rail` user-facing name, allow the
existing power-rail interaction to
author either horizontal or vertical single-segment rails, and keep the
automatic VDD Port power label upright and clear through rotation and mirror.
Preserve all existing VDD electrical behavior and persisted object kinds. This
is the VDD work package of the coordinated capacitor and VDD plan; capacitor
plate semantics are tracked independently in
`plan/2026-08-22-capacitor-plate-semantics/plan.md`.

## State and Ownership

The target began before a 69-commit remote-main advance. The local target files
are being checkpointed and `main` fast-forwarded to `origin/main` at
`a33a01e8` before implementation. Remote main already renamed the virtual item
to generic `Power Rail`, added named-rail authoring, and changed several owned
editor files; those changes become the new baseline rather than being reverted.
Unrelated `.pnpm-store/` and `.worktrees/` infrastructure remains untouched.

Original start state from `git status --short --branch`:

```text
## codex/gate-planning-preflight
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean. The untracked package/worktree infrastructure
is unrelated and remains untouched. The user explicitly authorized
implementation on this current mainline branch; preserve unrelated branch
state and limit the commit to this target's owned files.

Owned paths:

- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/features/component-insert/use-component-placement.ts`
- `apps/editor/src/features/component-insert/vdd-power-label.ts`
- focused VDD component-insert and interaction tests
- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/transaction-routing.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/transaction-instance-annotations.ts`
- `packages/derived/src/instance-label-placement.ts`
- focused Edit Engine tests
- `packages/agent-client/src/authoring-helper.ts`
- focused Agent authoring-helper tests
- `docs/agent/tool-behavior.md`
- generated `apps/mcp-server/src/resources.generated.ts` projection of that
  Agent documentation
- `docs/specs/editor-interaction.md`
- `docs/specs/connectivity-and-routing.md`
- this target plan and its eventual factual `plan/log.md` entry

Shared/read-only boundaries:

- Persisted Route/Junction/Annotation schemas in `packages/model`
- VDD power-domain and canonical Net planning
- VDD Port reviewed Symbol geometry and Razavi visual reference
- Agent `vdd-rail` authoring primitive and `add_power_rail` edit kind (payload
  shape remains unchanged; its geometry validation is owned by this target)

Do not introduce a new VDD Symbol, Route presentation, Net type, edit kind,
Project schema field, migration, or export rule. Do not rename the canonical
global Net from `VDD`.

## Decisions and Invariants

1. User-facing Library text remains `Power Rail` (compact label `Rail`);
   internal virtual picker ID `vdd`, Agent primitive ID `vdd-rail`, and the
   selected named Net remain unchanged.
2. A rail remains one explicit named power Net, two route-anchor Junctions, one
   `power-rail` Route, and one attached RichText power-label annotation.
3. Rail geometry remains one non-zero, axis-aligned segment. Horizontal and
   vertical are valid; diagonal and multi-bend power rails remain invalid.
4. Existing horizontal creation, resizing, movement, tap splitting, deletion,
   undo/redo, and Net membership behavior must remain unchanged.
5. During creation, the dominant pointer delta selects horizontal or vertical;
   preview and commit use the same snapped axis. An exact zero-length second
   click is rejected.
6. Endpoint resize moves only along the current rail axis. Whole-rail movement
   continues translating every connected rail fragment and Junction as one
   visual component while ordinary branch wires reshape around moved taps.
7. Automatic rail and VDD Port labels remain horizontal/upright. Their default
   anchor is placed outside the current rail/port ink for all four rotations
   and mirror states.
8. A user-moved VDD Port power label is user-owned: rotation must preserve its
   intentional attachment rather than reapplying the automatic default.
9. VDD label correction is a narrow power-label rule. Do not alter generic
   Annotation anchoring, generic instance-label placement, or Net-label
   behavior.
10. The shared document-style resolver must remain authoritative while this
    annotation-follow path is touched; canonical instance labels continue to
    honor document font overrides during rotation/mirror.

## Work

1. Preserve the remote `Power Rail`/`Rail` Library naming and named-Net
   selection; do not restore the old `VDD Rail` name.
2. Centralize the rail-axis decision used by cursor preview and second-click
   commit so both produce the same horizontal or vertical endpoint.
3. Relax `add_power_rail` and Route validation from horizontal-only to
   single-segment axis-aligned, retaining all VDD Net and endpoint checks.
4. Generalize power-rail endpoint resizing from an x-only operation to an
   orientation-aware axis operation without changing persisted edit payloads or
   the `add_power_rail` edit kind.
5. Derive the automatic rail-label endpoint and offset from rail orientation;
   keep the glyph upright and leave manual label movement available.
6. Add a canonical VDD Port power-label placement helper based on reviewed
   symbol ink bounds and orientation. Reflow only the untouched automatic
   label during rotate/mirror; keep manually moved labels distinct.
7. Update normative interaction/routing text to say `power-rail` is
   axis-aligned rather than horizontal-only, and keep GUI and Agent geometry
   validation in parity without changing its electrical semantics.
8. Add unit and browser regressions for horizontal parity, vertical create and
   resize, tap-aware movement, Library naming, and VDD Port label clearance at
   0/90/180/270 degrees.

## Validation

- `pnpm test:local apps/editor/src/features/component-insert/vdd-power-label.test.ts apps/editor/src/features/component-insert/vdd-rail.test.ts packages/edit-engine/src/routing.test.ts packages/edit-engine/src/transaction.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts --grep "Power Rail|VDD"`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Power Rail|VDD"`
- `pnpm gate:plan -- --base origin/main`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Rationale: the intended editor/Edit Engine paths are classified and do not
  require the advisory full fallback.
- Early gates: `pnpm gate:review:check -- --base origin/main`,
  `pnpm ci:static`, and `pnpm test:impact -- --base origin/main`.
- Affected gates: workspace unit tests, component-insert browser tests,
  hierarchy browser coverage selected through shared routing code, and manual
  editor browser coverage.
- Final gates: before mainline delivery, run a clean
  `pnpm install --frozen-lockfile`, `pnpm ci:check`, push a review branch, and
  require GitHub checks to pass.
- Platform risks: pointer-coordinate behavior under browser zoom, Linux
  formatting/static checks, shared Edit Engine routing behavior, and keeping
  the declared MCP resource projection byte-identical to its edited Agent
  source. No generated Razavi catalog, visual golden, binary asset, or release
  package is expected to change.

## Test Impact

- Decision: tests-updated
- Contracts: unchanged horizontal rail behavior; valid vertical rail creation,
  validation, resizing, and movement; canonical VDD Net semantics; explicit
  Library name; upright non-overlapping automatic VDD Port labels; preservation
  of user-moved labels.
- Primary checks: focused VDD component-insert/Edit Engine unit tests and the
  `component-insert` plus `manual-editor` browser scenarios listed above.

## Commit Intent

Commit as:

```text
fix(editor): refine VDD rail and port presentation
```

## Outcome

Preserved the generic `Power Rail`/`Rail` product naming and existing named-Net
semantics while making GUI and Agent creation accept one horizontal or vertical
axis-aligned rail. Endpoint resizing now follows the current axis with live
preview, and whole-rail movement retains the existing connected-component/tap
behavior. Automatic VDD Port labels are derived from oriented visible ink,
remain upright and clear through rotation/mirror, and do not overwrite a
user-moved anchor. The Agent knowledge resource was regenerated from its
single source.

Validation passed: focused Power Rail, VDD label, Agent, and Edit Engine tests;
static contracts and typecheck; focused browser scenarios; the complete
affected gate (178 unit files / 1105 tests and 124 browser tests); test-impact,
formatting, documentation, MCP projection, and diff checks.
