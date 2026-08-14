# Architecture Decision Records

ADRs record decisions that materially affect multiple modules, file formats,
public APIs, compatibility, security, or long-term maintenance.

## Naming

```text
NNNN-short-decision-title.md
```

Examples:

```text
0001-project-document-without-page.md
0002-lossless-spice-tree.md
0003-agent-api-without-mcp.md
```

Current Agent integration decisions include
[`0005-agent-api-without-mcp.md`](0005-agent-api-without-mcp.md),
[`0007-snapshot-driven-agent-workflow.md`](0007-snapshot-driven-agent-workflow.md),
[`0008-agent-local-route-tree-expander.md`](0008-agent-local-route-tree-expander.md),
[`0009-move-stretches-connected-routes.md`](0009-move-stretches-connected-routes.md),
and [`0010-text-annotation-drafting-schema.md`](0010-text-annotation-drafting-schema.md).
The active visual-authority decision is
[`0011-retire-visio-vss-as-visual-authority.md`](0011-retire-visio-vss-as-visual-authority.md).
The browser-authoritative web session decision is
[`0016-browser-authoritative-agent-session.md`](0016-browser-authoritative-agent-session.md).
The deterministic structural netlist decision is
[`0017-deterministic-design-netlist-boundary.md`](0017-deterministic-design-netlist-boundary.md).
The current Agent API reliability decision is
[`0019-four-operation-agent-golden-contract.md`](0019-four-operation-agent-golden-contract.md).
The Agent-side local MCP adapter decision (ADR 0005/0016 keep their
domain-independence judgments) is
[`0020-agent-side-mcp-adapter.md`](0020-agent-side-mcp-adapter.md).
The coordinate-domain and current-only grid-normalization decision is
[`0021-coordinate-domains-and-grid-normalization.md`](0021-coordinate-domains-and-grid-normalization.md).

Use [`adr.template.md`](adr.template.md) for new decisions.

## When an ADR is required

- Adding or removing a persistent model layer;
- changing the Project file format or compatibility policy;
- introducing a public Agent or automation API;
- selecting the authoritative SPICE dialect baseline;
- changing junction, crossing, or connectivity semantics;
- introducing a dependency that constrains licensing or deployment;
- reversing an accepted architectural decision.

Routine implementation choices contained inside one module do not require an
ADR unless they alter a shared contract.

## Lifecycle

```text
proposed → accepted → superseded
                 ↘ rejected
```

Accepted ADRs are immutable historical records. A later decision supersedes
an earlier ADR by linking both documents rather than rewriting history.
