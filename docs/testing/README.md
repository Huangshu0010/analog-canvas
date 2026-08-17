# Test System

Tests protect current behavior, explicit rejection boundaries, and safety
invariants. They are not a line-coverage contest and must not silently turn an
implementation detail into a public contract.

The [contract matrix](contract-matrix.md) identifies the primary owner for each
cross-cutting behavior. Co-locate a low-cost unit or module-contract test with
its implementation; keep browser workflows under `apps/editor/e2e/`; keep
release, generated-artifact, and visual checks in their existing scripts.

## Layers

| Layer | Purpose | Typical location |
| --- | --- | --- |
| Static and generated | types, formatting, documentation links, generated-output drift | root scripts and `ci:static` |
| Unit | pure algorithms, value boundaries, deterministic transformations | adjacent `*.test.ts` |
| Module contract | one package's public input/output, including rejection cases | package test beside the public boundary |
| Cross-module contract | one fact interpreted consistently across package boundaries | owning boundary package, named for the fact |
| Browser workflow | a user-visible flow that cannot be proved below the browser | `apps/editor/e2e/` |
| Release and golden | built product, artifacts, visual reference, packaging | root scripts and release checks |

Use the cheapest layer that can prove the behavior. Keep one primary contract
test per behavior; add a higher-layer test only when it proves wiring or a real
user path that the lower layer cannot prove.

## Change discipline

Every target that changes implementation code must add `## Test Impact` to its
target plan before the implementation is completed:

```md
## Test Impact

- Decision: tests-updated
- Contracts: persisted grid normalization; project import
- Primary checks: packages/model/src/coordinate-domain.test.ts
```

For behavior-neutral work, use `no-test-change` and state the evidence:

```md
## Test Impact

- Decision: no-test-change
- Reason: formatting-only change; no emitted code or behavior changed
```

`pnpm test:impact -- --base <base-ref>` checks the changed range. It accepts a
test update with `tests-updated`, or a testless implementation change with an
explicit evidence-based `no-test-change` decision. It deliberately does not
force meaningless test-file edits.

## Removing or simplifying a test

A test is not dead merely because it mentions a retired shape. Keep rejection,
migration, authorization, and input-hardening tests while their boundary is
reachable. Remove or merge a test only when all are true:

1. Its protected production surface is unreachable or is covered by a named
   primary contract at the same or stronger boundary.
2. Deletion does not remove the only rejection, compatibility, history, or
   safety assertion for the behavior.
3. The target plan records the replacement protection or why none is needed.

Split an oversized suite by protected behavior, not by arbitrary line count.
Prefer small shared fixture builders over copying an entire Project when only a
few facts are relevant.

## Coverage

Coverage is diagnostic evidence, not a merge threshold. Use it to find an
unexercised critical boundary, then add a behavior-level test. Do not retain
large, brittle tests solely to preserve a percentage.
