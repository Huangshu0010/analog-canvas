# Boundary ADR for the agent-routing package

## Goal

Establish, before any `packages/agent-routing` code is written, the hard
boundary that keeps a `RouteTreeDecision` and its expander inside the
Snapshot-driven Agent-local reasoning model that ADR 0007 accepted — and
outside the Layout Intent / query-language / persisted-model space that ADR
0007 explicitly vetoed.

This is target #3a of the agreed six-step routing-quality sequence. It is a
prerequisite for #3b (the expander package) and de-risks #2/#4/#5 by giving
them a fixed boundary to implement against. Documentation only; no contract,
schema, or runtime change.

## Dirty-State Note

Owned paths are `docs/adr/0008-agent-local-route-tree-expander.md` (new) and
`docs/adr/README.md` (only if it enumerates the new ADR). Live status confirms
no overlap with the existing dirty set. Unrelated dirty files untouched.

## Owned Files

- `docs/adr/0008-agent-local-route-tree-expander.md` (new)
- `docs/adr/README.md` (only to list the new ADR if it maintains a list)
- `plan/2026-08-07-agent-routing-boundary-adr/plan.md` (this plan)
- `plan/log.md` (log entry)

## Read-Only Files

- `docs/adr/0007-snapshot-driven-agent-workflow.md` — the accepted decision this
  ADR scopes; its "Persist Layout Intent" and "query language" alternatives are
  the vetoed space.
- `docs/agent/rule-guided-layout-architecture.md`,
  `docs/agent/knowledge-and-skill-plan.md` — Agent-local reasoning boundary.
- `docs/specs/agent-api.md` — must remain unchanged (no new endpoint, no
  RouteTreeDecision in request/response schema).
- `docs/specs/connectivity-and-routing.md` — Route/Junction edit contract the
  expander emits.

## Shared Dependencies

- ADR 0007 is the governing accepted decision; this ADR narrows it, does not
  reverse it.
- The ADR README states when an ADR is required: adding a persistent model layer
  or a public Agent API would require one. This ADR explicitly records that
  `agent-routing` adds NEITHER, and uses that to justify its boundary.

## Expected Work

1. Confirm dirty-state non-overlap.
2. Write `docs/adr/0008-agent-local-route-tree-expander.md` from the template:
   - Context: thermometer flat evidence (144 crossing/32 flightline → 0) shows
     the real bottleneck is multi-endpoint Net tree choice, not L-shaped escape.
     To remove Agent waypoint arithmetic without re-introducing a server-side
     router, an expander is needed. ADR 0007 vetoed Layout Intent and query
     languages; this ADR places the expander strictly inside that veto.
   - Decision (the two nails):
     - (1) RouteTreeDecision is Agent-local and transient. Its type lives only
       in `packages/agent-routing` (and a Skill-side caller). It MUST NOT
       appear in `packages/agent-adapter` request/response schemas, MUST NOT
       appear in `packages/model` project schema, MUST NOT be persisted into
       `project.icproj.json`, and MUST NOT survive across sessions. It MUST NOT
       grow `select`/`query`/`region` capabilities; its input is a derived slice
       of the existing Snapshot, never a new read path. Skill contract may carry
       it; Agent Circuit API v2 contract may not.
     - (2) The expander detects conflicts but does not auto-reroute. v1 scope:
       compute geometry under the chosen tree shape using grid/escape/clearance
       canon, detect crossing/overlap/wire-through-symbol against existing
       committed geometry, and return them as `conflict`/`metrics` for the
       Agent to resolve by changing the decision or placement. It MUST NOT
       silently switch tree shapes, MUST NOT pick `auto`/`best`, MUST NOT
       reroute to drive a conflict counter to zero. There is no `auto` or
       `best` shape; the Agent must submit `shape` explicitly.
   - Alternatives: (A) server-side persisted Layout Intent — rejected (ADR 0007
     veto); (B) auto-routing expander that reroutes to zero crossings —
     rejected (contradicts "helper optional, detect-not-reroute" and the
     thermometer evidence that 0 was achieved by tree choice, not rerouting);
     (C) no expander, Agent hand-writes set_route_points — status quo, the
     bottleneck being solved.
   - Consequences, compatibility (no file-format change; existing projects
     unaffected; no new endpoint), validation, related docs.
3. List the ADR in `docs/adr/README.md` if it maintains a list (it currently
   names 0005/0007 as "current Agent integration decisions"; add 0008 there).
4. Link/balance checks.

## Validation

- `git diff --check`
- `git status --short --branch`
- Markdown links from the new ADR resolve (to 0007, agent-api.md,
  rule-guided-layout-architecture.md, the thermometer evidence page if it
  exists as a doc, and the planned package path).
- Fenced blocks balanced.
- Docs-only; no typecheck/test/build run (risk-proportional).

## Commit Intent

```text
docs(adr): bound agent-routing expander to Agent-local, non-rerouting scope
```
