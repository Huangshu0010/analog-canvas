---
status: completed
experience: none
---

# Define Capacitor Plate Semantics Without Changing Project Protocol

## Goal

Give the built-in `capacitor` and `variable-capacitor` stable
top-plate/bottom-plate meaning
for import, export, Agent reasoning, and later PDK mapping while preserving the
current artwork, pin names, SPICE node order, Project schema, and editor
interaction. This is the capacitor work package of the coordinated capacitor
and VDD plan; the independent VDD presentation work is tracked in
`plan/2026-08-22-vdd-rail-port-presentation/plan.md`.

## State and Ownership

The target began before a 69-commit remote-main advance. The local target files
are being checkpointed, `main` will be fast-forwarded to `origin/main` at
`a33a01e8`, and the target was then reapplied without conflicts. Unrelated `.pnpm-store/` and
`.worktrees/` infrastructure remains untouched. The only direct textual overlap
is `packages/devices/src/registry.test.ts`; the remote addition of
`variable-capacitor` is an intentional semantic scope expansion required by the
user.

Original start state from `git status --short --branch`:

```text
## codex/gate-planning-preflight
?? .pnpm-store/
?? .worktrees/
```

The tracked worktree is clean. The two untracked directories are local package
and worktree infrastructure and are unrelated to this target; leave them
untouched. The user explicitly authorized implementation on this current
mainline branch; preserve unrelated branch state and limit the commit to this
target's owned files.

Owned paths:

- `packages/devices/src/contract.ts`
- `packages/devices/src/descriptors/capacitor.ts`
- `packages/devices/src/descriptors/variable-capacitor.ts`
- `packages/devices/src/validation.ts`
- focused device, SPICE, and netlist tests required by the work below
- `docs/specs/circuit-ir.md`
- this target plan and its eventual factual `plan/log.md` entry

Read-only/shared boundaries:

- Read-only artwork: `packages/symbols/assets/razavi-v1/capacitor.symbol.json`
- Shared persisted contract: `packages/model/src/schema/instance.ts`
- Shared source-order evidence: `InstanceImportProvenance.terminalMapping`
- Shared exporter order: device descriptor `pinOrder`

Do not change the capacitor Symbol geometry, pin names, Project schema version,
`InstanceSchema`, generic annotation model, or SPICE grammar in this target.

## Decisions and Invariants

1. Keep canonical electrical pins exactly `1` and `2`; pin order remains
   `['1', '2']`.
2. Add optional non-persisted pin-semantic metadata to the current
   `DeviceDescriptor` contract. The capacitor declares pin `1` as
   `capacitor-top-plate` and pin `2` as `capacitor-bottom-plate`; the variable
   capacitor declares the equivalent stable roles on `P1` and `P2`.
3. Plate identity follows the stable pin, not page direction. Rotation and
   mirror operations never exchange the roles.
4. SPICE import continues mapping source position zero to pin `1` and source
   position one to pin `2`; import does not infer roles from Net names, supply
   connections, or visual placement.
5. SPICE/Spectre export remains byte-compatible in structure: node order comes
   from the existing descriptor `pinOrder`; no proprietary comment, extra
   parameter, or new source syntax is emitted.
6. Project JSON stores no duplicate plate field. The semantic role is recovered
   deterministically from `(device descriptor, stable pinName)`, while imported
   source order remains preserved by the existing terminal mapping.
7. This target does not add UI controls or visible top/bottom labels. A later
   PDK target may define model-specific plate roles, but must not silently
   override the generic built-in contract.

## Work

1. Extend the non-persisted device descriptor with a bounded optional pin-role
   map and validate that every declared role references one unique canonical
   `pinOrder` entry.
2. Declare mappings `1 -> capacitor-top-plate`,
   `2 -> capacitor-bottom-plate` for the fixed capacitor and
   `P1 -> capacitor-top-plate`, `P2 -> capacitor-bottom-plate` for the variable
   capacitor; leave other device classes unchanged.
3. Add a small descriptor query/helper if consumers otherwise need to inspect
   roles by stable pin name. Do not copy the role into Instances or Nets.
4. Protect import/export closure with tests showing that a parsed capacitor's
   first and second source nodes remain bound to pins `1` and `2`, and that
   rotation/mirroring the schematic Instance does not change exported node
   order or plate identity.
5. Document that plate semantics are descriptor facts and that raw SPICE
   preserves them only through positional terminal order.

## Validation

- `pnpm test:local packages/devices/src/registry.test.ts packages/spice/src/compiler.test.ts packages/netlist/src/roundtrip.test.ts`
- `pnpm gate:plan -- --base origin/main`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `git diff --check`
- `git status --short --branch`

## Gate Review

- Decision: affected
- Rationale: the intended device-contract paths are classified and do not
  require the advisory full fallback.
- Early gates: `pnpm gate:review:check -- --base origin/main`,
  `pnpm ci:static`, and `pnpm test:impact -- --base origin/main`.
- Affected gates: workspace unit selection plus the focused device, compiler,
  and netlist round-trip tests above.
- Final gates: before mainline delivery, run a clean
  `pnpm install --frozen-lockfile`, `pnpm ci:check`, push a review branch, and
  require GitHub checks to pass.
- Platform risks: descriptor/type generation and case-sensitive Linux module
  resolution; no browser, golden-image, binary-asset, or release artifact is
  expected to change.

## Test Impact

- Decision: tests-updated
- Contracts: descriptor role validation, positional capacitor import, stable
  `1/2` export order, and rotation-independent plate identity.
- Primary checks: `packages/devices/src/registry.test.ts`,
  `packages/spice/src/compiler.test.ts`, and
  `packages/netlist/src/roundtrip.test.ts` through `pnpm test:local`.

## Commit Intent

Commit as:

```text
feat(devices): define capacitor plate semantics
```

## Outcome

Implemented descriptor-owned plate semantics for both built-in capacitor
families without changing Project JSON, artwork, or SPICE syntax. Fixed
capacitors map `1/2` and variable capacitors map `P1/P2` to stable top/bottom
roles; validation rejects missing, duplicate, unknown, or non-capacitor plate
metadata. Import and rotation/export regressions confirm source-node order and
plate identity remain stable.

Validation passed: focused device/SPICE/netlist tests (18 tests), static
contracts and typecheck, the complete affected gate (178 unit files / 1105
tests and 124 browser tests), test-impact, formatting, documentation, MCP
projection, and diff checks.
