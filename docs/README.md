# Project Documentation

This directory separates durable product decisions from staged delivery plans,
normative module contracts, concrete execution logs, and reusable experience.

## Documentation Map

| Area | Purpose |
|---|---|
| [`overall-product-plan.md`](overall-product-plan.md) | Current product boundary and system architecture |
| [`roadmap/`](roadmap/README.md) | Phase ordering, work packages, acceptance scenarios, and exit gates |
| [`specs/`](specs/README.md) | Normative data, API, parser, rendering, and persistence contracts |
| [`agent/`](agent/README.md) | Agent API usage and soft layout/routing guidance |
| [`adr/`](adr/README.md) | Significant architectural decisions and their consequences |
| [`experience/`](experience/README.md) | Human-requested, evidence-backed reusable lessons |
| [`../plan/`](../plan/README.md) | Bounded execution plans and factual maintenance history |

## Authority Order

When documents disagree, resolve the conflict explicitly rather than silently
choosing one. The intended authority order is:

```text
accepted ADR or approved normative spec
→ current overall product plan
→ current roadmap phase
→ bounded target plan
→ implementation and tests
```

Implementation and tests are evidence, but they do not silently redefine an
approved contract. Update the relevant spec or ADR when behavior intentionally
changes.

## Status Vocabulary

Roadmaps, specs, and ADRs use the following states:

```text
proposed   drafted but not accepted as an implementation contract
accepted   approved and safe to implement against
active     currently being implemented or validated
complete   exit gate satisfied with recorded evidence
superseded replaced by a linked document
blocked    cannot proceed without a recorded decision or external dependency
```

## Planning Flow

```text
overall architecture
→ roadmap phase
→ normative specs / ADRs
→ plan/YYYY-MM-DD-target/plan.md
→ implementation and focused validation
→ plan/log.md
```

Roadmap files describe product delivery. Files under `plan/` describe one
specific execution target and its owned paths.
