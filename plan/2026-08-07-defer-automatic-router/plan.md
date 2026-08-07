# Defer automatic router / obstacle avoidance / auto cleanup

## Goal

Target #6 (final) of the routing-quality sequence. Per the goal directive,
evaluate whether to implement A* path-finding, automatic obstacle avoidance,
and whole-graph auto cleanup. Decision: **do not implement**; record the
evidence so the question is not re-opened without new measured need.

## Evidence against implementing #6 now

1. **thermometer flat layout**: 0 crossings, 0 flightlines, 0 overlap, 0
   diagnostics was achieved by Agent tree choice + diagnostic-driven revision,
   using only `add_junction` + `route_orthogonal` + `set_route_points`. No
   automatic router was involved. The existing closed loop works.
2. **ADR 0008 boundary**: the expander detects conflicts but does not
   auto-reroute. An automatic router is exactly auto-reroute and would
   require superseding ADR 0008 (or a separate ADR scoping it as optional,
   off-by-default, non-authoritative).
3. **Phase 9 external studies**: Tier D (more guidance) scored lowest (2.6 on
   Flash ADC). A router is a recipe executor in effect; the studies measured
   recipe-ization as harmful.
4. **ADR 0007 helper discipline**: every helper must be reviewable evidence and
   the workflow must remain complete with it disabled. A default-on router
   violates this.
5. **#1–#5 closed the loop**: canon exposed, protocol self-consistent,
   route-tree method + expander, quality metrics, move-safe placement. The
   Agent can now reason, decide topology, see consequences, get feedback, and
   revise freely. The problem #6 would solve ("Agent cannot route at all") is
   no longer the situation.

## Decision

Defer #6 indefinitely. It remains a possible future target ONLY if, after
#1–#5 are exercised on real Agent runs, a measured bottleneck appears that
tree choice + diagnostics + expander cannot close. Any future router must:
- be a separate ADR superseding or scoping ADR 0008's no-reroute rule;
- be optional and off by default;
- never replace Agent tree judgment;
- be gated behind measured entry evidence (ADR 0007).

## Owned Files

- `plan/2026-08-07-defer-automatic-router/plan.md` (this note)
- `plan/log.md`

## Validation

- `git diff --check`, `git status --short --branch`.
- Documentation only; no code, no contract, no tests.

## Commit Intent

```text
docs(plan): defer automatic router per ADR 0008 and Phase 9 evidence
```
