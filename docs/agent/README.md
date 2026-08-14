# Agent Integration Guide

The Agent Circuit API is a regular JSON/TypeScript API. It exposes a complete
Snapshot and typed edits through the same Schematic Edit Engine used by humans;
it does not bundle an LLM provider, browser automation, or a second command
engine.

## External Agent bootstrap

An Agent without this repository receives a connection setup from the editor.
It first fetches the public `GET /api/agent/kit` JSON, writes its listed files
to a private scratch directory, and reads `README.md` followed by the session
`SKILL.md`. The Kit contains a small static projection of reviewed built-in
Razavi authoring facts, but neither a Project, token, nor alternate API. The
Agent then redeems the claim and uses the published OpenAPI as the
wire-contract authority.

## Read in this order

1. Kit `README.md`, `skills/icm-circuit-session/SKILL.md`, and
   `references/authoring-contract.md` for an external session; repository
   contributors begin with the next document instead.
2. [`../specs/agent-api.md`](../specs/agent-api.md) — normative domain contract.
3. [`workflow.md`](workflow.md) — required read, edit, refresh, render, and
   review loop.
4. [`tool-behavior.md`](tool-behavior.md) — runtime behavior and transaction
   boundaries.
5. [`response-semantics.md`](response-semantics.md) — conflicts, diagnostics,
   generated artifacts, and completion decisions.
6. [`api-usage.md`](api-usage.md) — loopback and browser-session requests.
7. [`circuit-style-knowledge.md`](circuit-style-knowledge.md) and
   [`knowledge/`](knowledge/README.md) — evidence-first circuit reading and
   on-demand style/pattern guidance.
8. [`examples.md`](examples.md) — checked, reproducible workflows.

The browser-authorized relay adds transport, session, and permission rules in
[`../specs/web-agent-session.md`](../specs/web-agent-session.md). It carries the
same Agent Circuit domain requests and does not redefine circuit semantics.

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

When guidance and schemas differ, the schemas and Edit Engine validation win.
Explicit Junction semantics, Net consistency, and locked-object protection
never depend on an Agent following prose.
