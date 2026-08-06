# Agent Documentation

Agent documentation is split between a small executable API contract and soft
guidance for producing high-quality layouts. The application does not require
MCP; any Agent adapter calls the same transport-independent Agent Circuit API.

## Planned Documents

| Document | Phase | Purpose |
|---|---:|---|
| `api-usage.md` | 6 | Session lifecycle and `capabilities/query/transact/render` examples |
| `operations.md` | 6 | Supported typed edits, permissions, dry run, and diagnostics |
| `layout-guide.md` | 5/6 | General signal-flow, grouping, spacing, and locking guidance |
| `analog-layout-guide.md` | 5/6 | Differential pair, mirror, cascode, bias, supply, and symmetry guidance |
| `routing-guide.md` | 3/6 | Orthogonal routing, trunks, crossing, junction, and label clearance |
| `examples/` | 6 | End-to-end query, plan, dry-run, transact, diff, and render examples |

These documents are created when their owning phase begins. Normative API
schemas belong in `docs/specs/agent-api.md`; this directory explains how an
Agent should use that contract effectively.

## Enforcement Boundary

```text
API schema
  defines what an Agent may request

Schematic Edit Engine + validators
  enforce hard electrical and document invariants

diagnostics
  identify measurable layout-quality problems

Agent guides
  describe preferred but non-mandatory layout judgment
```

Hard rules such as revision matching, atomic transactions, net consistency,
locked-object protection, and explicit junction semantics must never depend on
an Agent following prose instructions.
