# Delivery Roadmap

This directory contains only current cross-module work. Completed delivery
phases are preserved as historical evidence under
[`../archive/roadmap/`](../archive/roadmap/README.md); they are not default
implementation context.

## Delivery status

| Area                                                                      | Status                                                        | Current authority                                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Phases 0--8: contracts, editor, import, routing, export, manual authoring | complete                                                      | [archived phase records](../archive/roadmap/README.md) and current specs/ADRs                                           |
| Phase 9: Snapshot-driven Agent workflow                                   | review                                                        | [Phase 9 record](phase-9-agent-reasoning-and-observability.md)                                                          |
| Connectivity, routing, and electrical debugging                           | proposed                                                      | [unification plan](connectivity-routing-debugging-plan.md)                                                              |
| Browser-authorized Agent sessions                                         | implementation validation complete; deployment review pending | [session integration plan](web-agent-session-integration-plan.md) and [web-session spec](../specs/web-agent-session.md) |

## Active planning rules

- A roadmap frames a cross-module outcome and its acceptance boundary; it does
  not own a working-tree change.
- A target under `plan/` owns implementation, dirty-state handling, validation,
  and delivery evidence.
- An accepted spec or ADR overrides stale roadmap wording.
- Completed work moves to archive rather than remaining alongside open work.

Use [`phase.template.md`](phase.template.md) only for a new, genuinely staged
delivery phase.
