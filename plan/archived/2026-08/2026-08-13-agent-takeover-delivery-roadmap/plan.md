---
status: completed
experience: none
---

# Agent Takeover Delivery Roadmap

## Goal

Turn the accepted four-operation Circuit API into a complete, browser-hosted
Agent takeover capability: safe project/file lifecycle, human-visible semantic
review, stable session recovery, and complete editable circuit semantics. This
planning target explicitly excludes simulation, PVT/analysis setup, waveform or
measurement data, and SPICE/design-netlist export.

## State and Ownership

Start state:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
 M packages/agent-adapter/src/openapi.ts
 M packages/agent-adapter/src/schema.ts
 M packages/agent-adapter/src/service.ts
 M packages/agent-adapter/src/snapshot.ts
 M packages/edit-engine/src/transaction.ts
 M packages/model/src/index.ts
 M packages/model/src/persistence.ts
 M packages/model/src/schema.ts
 M packages/render-svg/src/render.ts
 M packages/symbols/src/razavi-catalog.ts
?? packages/model/src/migration-v5-to-v6.ts
?? plan/2026-08-13-first-class-port-presentation/
```

The dirty source files belong to the active first-class-Port migration. This
target owns only this plan, the Agent takeover roadmap, and its factual log
entry; it does not edit or stage that source work. The roadmap names it as the
first implementation dependency rather than duplicating its plan.

Shared authorities reviewed read-only:

- `docs/adr/0019-four-operation-agent-golden-contract.md` freezes the four
  Circuit operations and production request boundary.
- `docs/specs/agent-api.md` and `docs/specs/web-agent-session.md` are the
  current contract/specification pair.
- `packages/model`, `packages/edit-engine`, `packages/agent-adapter`,
  `apps/editor/src/agent`, and `worker` are future implementation owners.

## Work

1. Record a scope-correct, dependency-ordered plan for all remaining Agent
   takeover capabilities, distinguishing Circuit operations from separate
   browser-owned file transport.
2. Define the stable session/recovery model, Project lifecycle, file staging
   and user approval boundary, semantic collaboration feedback, and acceptance
   tests without introducing simulation or netlist-export scope.
3. Give every package a single authority, explicit failure behavior, and a
   narrow exit condition so future work cannot merge partial scaffolding as a
   completed feature.

## Validation

- `pnpm docs:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
docs(agent): plan complete browser Agent takeover
```

## Outcome

Expanded the existing four-operation roadmap into a scope-frozen delivery plan:
simulation/PVT/waveforms and SPICE/design-netlist export are explicitly absent;
Project and visual files use a separate scoped File Resource; Project lifecycle,
session continuity, semantic collaboration, history/duplication, and contract
hardening are independent, testable targets. `pnpm docs:check` and
`git diff --check` passed. The active first-class-Port source migration remains
unstaged and untouched by this documentation target.
