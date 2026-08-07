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
and [`0008-agent-local-route-tree-expander.md`](0008-agent-local-route-tree-expander.md).

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
