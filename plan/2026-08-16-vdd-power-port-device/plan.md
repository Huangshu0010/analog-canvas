---
status: completed
experience: none
---

# Restore the VDD Power-Port Device Alongside the VDD Rail

## Goal

Restore the deleted VDD symbol device as a real Razavi catalog symbol with a
new id `vdd-port`, so the editor offers two VDD authoring modes: a default
placed device ("VDD Power Port") and the existing two-click VDD rail. The rail
version must remain byte-for-byte unchanged, including every gate that asserts
id `vdd` is not a symbol asset.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/vdd-power-port-device...origin/main
?? .worktrees/
```

The only dirty path is the untracked `.worktrees/` directory, which does not
overlap this target's owned files; it is left untouched.

Owned paths:

- `packages/symbols/assets/razavi-v1/vdd-port.symbol.json` (new)
- `packages/symbols/assets/razavi-v1/catalog.json`
- `packages/symbols/src/razavi-catalog.generated.ts` (generated)
- `packages/symbols/src/netlist.ts` and focused symbol tests
  (`builtins.test.ts`, `razavi-catalog.test.ts`, `netlist.test.ts`)
- `packages/symbols/assets/razavi-v1/README.md`
- `fixtures/visual-reference/razavi-reference-v1/vdd-geometry.json`,
  `vdd-reference.png`, `manifest.json` (restored from `9a552d3~1`)
- `apps/editor/src/features/component-insert/placement-connectivity.ts`
- `apps/editor/src/features/component-insert/vdd-power-label.ts` (new) and test
- `apps/editor/src/features/netlist-export/netlist-authoring.ts`
- `apps/editor/src/features/editor-shell/shapes-panel.tsx`
- `apps/editor/src/app/App.tsx` (placement-time power-label emission only)
- `apps/editor/e2e/component-insert.spec.ts`

Read-only / shared:

- Read-only (rail protection list): `vdd-rail.ts`, `vdd-rail-preview-symbol.ts`,
  `symbol-catalog.ts`, the `vdd-rail` request branch in `App.tsx`,
  `placeVddRail`, the `placing-vdd-rail` interaction state, the
  `add_power_rail` executor in `packages/edit-engine`, the Agent boundary
  rejection of `symbolId === "vdd"`, `razavi-catalog.test.ts:224`,
  `netlist.test.ts` `deviceNetlistDefinition("vdd")`, and the legacy-VDD
  placement guard in `placement-connectivity.test.ts`.
- Shared: `catalog.json` asset hashing and the reference-manifest sha256 pins
  (regenerated via `pnpm symbols:razavi`), `POWER_CONNECTION_BY_SYMBOL`
  (ground contract unchanged).

## Work

1. Restore the VDD reference fixtures from `9a552d3~1` (dedicated png +
   geometry + manifest entries; without the removed MOS3 pins) and author
   `vdd-port.symbol.json` with the final calibrated device geometry (pin `P`
   south at `{0,20}`, stem to `y=1.5`, filled bar `-10..10 x -0.88..2.36`,
   `labelVisibility: "hidden"`, no aliases).
2. Add the `vdd-port` catalog entry, regenerate catalog + generated TS, and add
   the `net-marker` netlist definition mirroring `ground`.
3. Wire the editor: `POWER_CONNECTION_BY_SYMBOL` entry, `VDD` placement prefix,
   compact library label, and a placement-time `power-label` annotation
   (RichText italic-bold V + subscript DD, object-anchored to the instance)
   emitted from `placeNewComponent` when the device establishes a power Net.
4. Add focused unit tests (standalone/contact/merge connectivity, label
   factory) and one e2e spec placing the device from the Insert dialog while
   the existing rail specs continue to pass.

Also required by the restored authority chain: re-registering the
`vdd-port` fidelity target (pinned `fidelityTargetsSha256`), regenerating
`agent-authoring-catalog.generated.ts` (vdd-port is agent-placeable), and
renormalizing two stale CRLF worktree files
(`inductor/opamp-vector-source.json`) that failed the manifest sha256 gate
locally; their content is byte-identical to `HEAD`.

## Validation

- `pnpm test:local packages/symbols apps/editor/src/features/component-insert apps/editor/src/features/netlist-export`
- `pnpm symbols:razavi:check`
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts`
- Targeted Prettier on changed files; `git diff --check`;
  `git status --short --branch`

Renderer coverage: the device body renders through the generic symbol
pipeline; the power-label typography is shared with the rail label and covered
by `packages/render-svg` current-contract tests.

## Commit Intent

Commit as:

```text
feat(symbols): restore the VDD power-port device alongside the rail
```

## Outcome

Restored the VDD power-port device as catalog symbol `vdd-port` ("VDD Power
Port") alongside the untouched drawn-rail mode. The device uses the final
calibrated marker geometry (stem to `y=1.5` strictly inside the `-0.88..2.36`
bar), sorts before "VDD Rail" in the Insert dialog and Library panel, places
with the ordinary single-click component flow (`VDD1`, `VDD2`, … designators),
establishes/reuses the global VDD Net exactly like Ground (including merging
into the rail's or PMOS bulk's existing supply Net), and emits a shared
power-typography "VDD" power-label object-anchored to the instance
(`power-label-vdd*` ids, so rail `label-VDD*` ids never collide). The rail
protection list stayed byte-identical: `vdd-rail.ts`, `vdd-rail-preview-symbol.ts`,
`placeVddRail`, the `vdd-rail` request branch, the `add_power_rail` executor,
the Agent `"vdd"` rejection, and every "vdd is not a symbol" test assertion.

Two mid-work corrections: the power-label anchor's `localOffset` and
`fallbackPosition` must both sit on the 10-unit page grid (the 410adf5-era
`{14,5}` offset now fails `GRID_ALIGNMENT`; both use `{10,10}` like the rail
label), and the quick-place compact label is "V Port" because "VDD Port"
overflows the Library chip width contract.

Validation passed: 344 editor + symbols unit tests, 138 agent package tests,
render-svg tests, workspace typecheck, `pnpm symbols:razavi:check` (18 assets),
`pnpm agent-kit:catalog:check`, `pnpm agent-api:artifacts:check`, the full
`component-insert.spec.ts` (18/18, including the new device spec) plus the four
VDD rail specs in `manual-editor.spec.ts`, targeted Prettier,
`git diff --check`, and `git status --short --branch`. Ready to deliver through
the protected-main gate.
