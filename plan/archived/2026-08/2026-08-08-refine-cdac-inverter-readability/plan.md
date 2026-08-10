# Refine flat-CDAC inverter readability

## Goal

Make each repeated CDAC unit read as a conventional CMOS inverter driving a
complementary switch: one DP/DN drain junction, one NB horizontal handoff, one
switch-gate fanout, and labels outside the wiring corridor.

## Dirty-State Note

Start state:

```text
## main...origin/main
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
```

The untracked audit plan belongs to an earlier target and remains read-only.
No dirty path overlaps this target.

## Owned Files

- `netlists/sky130-switched-capacitor-dac-6bit-pvt/agent-cdac-flat.mjs`
- `netlists/sky130-switched-capacitor-dac-6bit-pvt/agent-scdac-newarch.*`
- `plan/2026-08-08-refine-cdac-inverter-readability/plan.md`
- `plan/log.md`

## Read-Only Files

- `plan/2026-08-08-flat-cdac-new-architecture-audit/**`
- all packages and unrelated project assets

## Shared Dependencies

- Existing atomic Route-graph helper and completeness gate
- Razavi MOS symbol pin orientation and formal renderer

## Expected Work

1. Align DP/DN drain escapes to one shared inverter-output branch.
2. Route NB as a horizontal handoff to one vertical switch-gate fanout.
3. Align SP/SN drains to one BOT branch.
4. Move DP/DN/SP/SN and NB labels out of active wire corridors.
5. Regenerate and visually inspect all formal artifacts.

## Validation

- CDAC completeness gate: zero errors, warnings, crossings and flightlines
- all visible Nets remain single connected components
- deterministic regeneration
- original-resolution PNG inspection
- `git diff --check`
- `git status --short --branch`

No simulation claim is made; this target changes presentation geometry only.

## Commit Intent

```text
fix(cdac): clarify inverter wiring and labels
```

## Outcome

- Shifted the PMOS row by one grid step so DP/DN and SP/SN drain escapes meet
  cleanly at the shared logic row.
- Each inverter now has one DP/DN output junction and one horizontal NB handoff
  to a single SP/SN gate-fanout junction.
- Each switch pair now has one BOT junction shared by SP, SN and the capacitor
  bottom plate.
- DP/SP labels sit above their devices; DN/SN labels sit below; NB labels sit
  above the horizontal handoff and outside transistor silhouettes.
- Final flat target remains 32 placed instances, 103 Routes and 40 semantic
  junctions with zero errors, warnings, crossings or flightlines.

## Validation Record

- Completeness gate: passed.
- Workspace typecheck: passed.
- Deterministic second generation: Project/SVG/PNG/PDF hashes unchanged.
- Original-resolution PNG inspected: repeated-unit wiring and labels are
  visually consistent.
- No simulation was run; presentation geometry only.
