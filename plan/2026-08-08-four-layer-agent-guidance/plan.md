---
status: completed
experience: candidate
---

# Establish four-layer Agent guidance

## Goal

Turn the existing `circuit-layout` Skill into a four-layer, progressively loaded
guidance system covering execution workflow, actual tool behavior, response
interpretation, and circuit/style knowledge. Keep topology judgment with the
Agent and keep the API/Edit Engine/helper boundaries unchanged.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
 M apps/editor/src/App.tsx
 M packages/edit-engine/src/presentation.test.ts
 M packages/edit-engine/src/transaction.ts
 M packages/model/src/factories.ts
 M packages/model/src/schema.test.ts
 M plan/log.md
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-default-and-style-switch/
```

The editor/model/test changes and both existing untracked plans belong to other
targets and remain untouched. The existing `plan/log.md` delta belongs to the
Razavi-default target and is identifiable as one complete entry. This target
will append a separate entry and stage only that appended hunk rather than the
other target's uncommitted log entry.

## Owned Files

- `plan/2026-08-08-four-layer-agent-guidance/plan.md`
- `skills/circuit-layout/SKILL.md`
- `skills/circuit-layout/references/manifest.md`
- `docs/agent/README.md`
- `docs/agent/workflow.md`
- `docs/agent/tool-behavior.md`
- `docs/agent/response-semantics.md`
- `docs/agent/circuit-style-knowledge.md`
- `docs/agent/knowledge/route-tree-shapes.md`
- `fixtures/agent-layout-eval/skill-and-ablation-structure.json`
- `plan/log.md` (append-only target entry; partial staging required)

## Read-Only Files

- `AGENTS.md`
- `README.md`
- `plan/README.md`
- `docs/specs/agent-api.md`
- `docs/specs/edit-engine.md`
- `docs/agent/api-usage.md`
- `docs/agent/knowledge/**` except `route-tree-shapes.md`
- `packages/agent-adapter/**`
- `packages/agent-routing/**`
- `packages/derived/**`
- `tools/agent-layout/**`
- all pre-existing dirty paths listed above

## Shared Dependencies

- Agent API `2.0` and Snapshot `1.0`
- the typed Edit Engine transaction contract
- transient `@icm/agent-routing` RouteGraph semantics
- derived visual diagnostics and formal/diagnostic render behavior
- the existing on-demand circuit-knowledge library

## Expected Work

1. Write four canonical guidance pages grounded in the current implementation,
   and correct the stale shape-compiler description in the route-shape card.
2. Refactor the thin Skill entry and manifest to load the four layers in the
   right order and load detailed knowledge cards only when evidence requires it.
3. Update Agent documentation navigation without duplicating normative schemas.
4. Refresh the deterministic Phase 9 Skill-structure report and validate links,
   Skill structure, and Markdown hygiene.

## Validation

- Skill Creator `quick_validate.py` against `skills/circuit-layout`
- `pnpm phase9:skill:check`
- direct Markdown-link existence check for the Skill manifest and four pages
- `git diff --check`
- `git status --short --branch`

These checks cover discoverability, progressive-loading links, the existing
Phase 9 Skill contract, and patch hygiene. No runtime code or electrical
behavior changes, so TypeScript builds and simulation are outside this target.

## Experience Signal (for human review)

Repeated clean diagnostics with confusing schematics suggest a reusable lesson:
hard validation and visible semantic quality are separate completion gates. A
human may later request an evidence-backed experience note.

## Commit Intent

Commit as:

```text
docs(agent): establish four-layer layout guidance
```
