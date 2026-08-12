# Agent Integration Guide

Agent Circuit API v2 exposes a complete Snapshot plus typed edits and render
through an in-process service and optional authenticated loopback adapter. It is
a regular JSON/TypeScript API, not MCP, and it does not bundle an LLM provider.

Start with:

- [`workflow.md`](workflow.md) for the required end-to-end execution and visual
  review loop;
- [`tool-behavior.md`](tool-behavior.md) for the actual API, Edit Engine,
  RouteGraph helper, movement, renderer, and generator behavior;
- [`response-semantics.md`](response-semantics.md) for interpreting conflicts,
  errors, diagnostics, resolved Routes, crossings, flightlines, and artifacts;
- [`circuit-style-knowledge.md`](circuit-style-knowledge.md) for evidence-first
  circuit understanding and textbook/Razavi-style expression;
- [`api-usage.md`](api-usage.md) for request payload examples and permissions,
  including the browser-authorized **web session** flow for an external Agent
  (ADR 0016);
- [`layout-guidance.md`](layout-guidance.md) for the earlier compact layout
  heuristics retained for compatibility;
- [`knowledge-and-skill-plan.md`](knowledge-and-skill-plan.md) for the earlier
  rationale behind Agent reasoning and on-demand knowledge construction;
- [`knowledge/`](knowledge/) for canonical on-demand circuit-reading,
  expression, routing, pattern, and fixed-style canon knowledge used by
  `circuit-layout`;
- [`rule-guided-layout-architecture.md`](rule-guided-layout-architecture.md)
  for the complete-Snapshot workflow, typed-edit boundary, PDK
  mapping, optional helpers, hierarchy, and diagnostic feedback;
- [`examples.md`](examples.md) for reproducible workflows backed by checked
  fixtures and tests.

The normative contract is [`../specs/agent-api.md`](../specs/agent-api.md).
When guidance and schemas differ, schemas and Edit Engine validation win.

## Enforcement boundary

```text
API schemas and permissions
  define what an Agent may request

Schematic Edit Engine and model validators
  enforce hard electrical, revision, lock, and atomicity rules

derived diagnostics
  report measurable visual problems without moving objects

Agent guides
  describe preferred but non-mandatory layout judgment
```

The four primary Agent layers deliberately separate process, runtime facts,
result interpretation, and visual/electrical reasoning. Normative schemas remain
in `docs/specs/`; detailed pattern cards remain under `knowledge/` and load only
when Snapshot evidence makes them relevant.

Explicit Junction semantics, Net consistency, and locked-object protection
never depend on an Agent following prose instructions.
