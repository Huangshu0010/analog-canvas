# Agent Integration Guide

Agent Circuit API v2 exposes a complete Snapshot plus typed edits and render
through an in-process service and optional authenticated loopback adapter. It is
a regular JSON/TypeScript API, not MCP, and it does not bundle an LLM provider.

Start with:

- [`api-usage.md`](api-usage.md) for the request lifecycle and permissions;
- [`layout-guidance.md`](layout-guidance.md) for judgment that remains outside
  hard validators;
- [`knowledge-and-skill-plan.md`](knowledge-and-skill-plan.md) for the
  two-part governing Skill and on-demand circuit-knowledge construction plan;
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

Explicit Junction semantics, Net consistency, and locked-object protection
never depend on an Agent following prose instructions.
