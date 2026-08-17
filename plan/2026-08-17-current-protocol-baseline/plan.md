---
status: completed
experience: none
---

# Current Protocol Baseline

## Goal

Make the current repository contract unambiguous for schema 11, ordinary
single-pin Port symbol Instances, the Edit Engine-derived typed edit union, and
the deployed Agent session lifetimes. Remove live obsolete schema/first-class
Port implementation where it still exists, while preserving historical records
and negative compatibility tests. ADR 0014/R10 geometry migration and possible
dead code in that subsystem are explicitly out of scope for later discussion.

## State and Ownership

Start state from `git status --short --branch` before branch creation:

```text
## main...origin/main
?? .worktrees/
```

The pre-existing untracked `.worktrees/` directory is unrelated to this target
and will remain untouched. Work proceeds on
`chore/unify-current-protocol-baseline`.

- `docs/overall-product-plan.md`
- `docs/current/README.md`
- `docs/specs/`
- `docs/adr/0022-current-protocol-baseline.md`
- `docs/adr/README.md`
- `docs/agent/`
- `docs/user/`
- `packages/model/`
- `packages/derived/src/connectivity-index.ts`
- `packages/derived/src/net-highlight.ts`
- `packages/edit-engine/`
- `packages/agent-adapter/`
- `packages/agent-routing/src/types.ts`
- generated public protocol artifacts whose inputs change
- focused tests protecting the current-only contract
- `plan/2026-08-17-current-protocol-baseline/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

The accepted ADR files 0010/0013/0014/0015/0016 are historical read-only
records. Their superseded clauses are identified by ADR 0022 and the ADR index;
their original prose is not rewritten. Read-only unless the audit demonstrates
a live obsolete protocol reference and this plan is updated first:

- `apps/`
- other `packages/`
- `docs/adr/0010-text-annotation-drafting-schema.md`
- `docs/adr/0013-project-connectivity-index.md`
- `docs/adr/0014-resolved-route-geometry.md`
- `docs/adr/0015-object-locator-and-diagnostic-envelope.md`
- `docs/adr/0016-browser-authoritative-agent-session.md`
- historical plans, `plan/log.md` entries predating this target, and archived
  documentation
- the R10 roadmap

Shared dependencies are the persisted Project schema, circuit endpoint model,
Edit Engine transaction schema, generated Agent/OpenAPI contracts, and browser
Agent credential lifecycle.

## Work

1. Inventory every non-historical schema-version and first-class Port reference;
   distinguish live implementation from rejection tests and historical evidence.
2. Align current product/spec/user/Agent documentation with schema 11 and the
   ordinary `port` / `port-filled` Instance contract; remove any executable dead
   first-class Port or alternate current-schema path found by the audit.
3. Replace the stale hand-maintained edit-kind documentation with the current
   Engine/Agent derivation contract and complete semantic coverage.
4. Add a superseding protocol-baseline ADR and update the Agent session spec to
   ratify the deployed 30-minute Claim,
   8-hour bearer, 7-day session/connector, and 5-minute result-cache defaults,
   including rotation, persistence, expiry, and revocation boundaries.
5. Regenerate affected public schemas/artifacts when their source contract
   changes and run focused validation.

## Validation

- `git diff --check`
- `git status --short --branch`
- focused model/edit-engine/agent-adapter unit contracts selected after audit
- generated-artifact drift checks affected by the final change set
- `pnpm verify:branch` because the target crosses model, Edit Engine, Agent, and
  normative documentation boundaries

Negative tests that prove retired schema/Port shapes are rejected are retained;
they are current-contract protection rather than alternate-schema support.

## Commit Intent

Commit as:

```text
docs(protocol): ratify current schema and agent contracts
```

## Outcome

Established accepted ADR 0022 as the current schema/Port/edit/TTL authority
without rewriting historical accepted ADRs. Current product, model,
persistence, editor, visual, Agent, and session documentation now describe
Project schema 11, ordinary `port` / `port-filled` Instances, terminal/Junction
Route endpoints, the Engine-derived edit union, and the deployed credential
lifetimes. Removed the unused `hierarchy-port` virtual-edge kind and stale live
Port terminology, regenerated MCP resources, and added deterministic drift
tests for Project-version docs, edit-kind docs, and TTL docs.

Focused validation passed 82 tests. Agent API, authoring-catalog, MCP-resource,
and Markdown-link checks passed. `pnpm verify:branch` passed static/type checks,
130 test files with 793 tests, the full workspace build, and production editor
smoke. `git diff --check` and final status review passed before commit. ADR
0014/R10 geometry migration and broader dead-code analysis remain deliberately
out of scope for the next discussion.
