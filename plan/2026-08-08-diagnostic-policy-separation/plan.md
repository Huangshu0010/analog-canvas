# Diagnostic Policy Separation

## Goal

Stop visual heuristics from acting as automatic-layout truth. Separate
structural diagnostics from visual observations, attach confidence and gate
eligibility, improve the largest false-positive sources, and make UI/Agent/
repository gates consume that distinction consistently.

## Dirty-State Note

The worktree contains only unrelated untracked RLC artifacts, older plans, and
`probe-conflicts.mjs`. They do not overlap this target and remain untouched.

## Owned Files

- `packages/derived/src/visual.ts`
- `packages/derived/src/visual.test.ts`
- `packages/agent-adapter/src/schema.ts`
- `packages/agent-adapter/src/service.ts`
- `packages/agent-adapter/src/snapshot.ts`
- `apps/editor/src/App.tsx`
- `tools/agent-layout/generate.mjs`
- `fixtures/agent-api/agent-circuit-response.schema.json`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `docs/specs/agent-api.md`
- `docs/agent/response-semantics.md`
- `docs/agent/workflow.md`
- `docs/agent/tool-behavior.md`
- `docs/specs/visual-language.md`
- this plan and `plan/log.md`

## Shared Dependencies

- Diagnostic codes remain stable for compatibility.
- Electrical topology, Edit Engine behavior, and Project persistence are
  unchanged.
- Existing recipe warning lists remain readable but cannot promote an
  ineligible low-confidence observation into a blocking failure.

## Expected Work

1. Add `category`, `confidence`, and `gateEligible` to every visual finding.
2. Use visible variant primitives instead of the canonical viewBox where
   deterministic primitive bounds are available.
3. Use shared rich-text measurement for annotation bounds and cluster repeated
   overlap findings.
4. Split structural issues and visual observations in the editor and Agent
   contract.
5. Enforce gate eligibility in the repository runner and document the policy.

## Validation

- focused derived and Agent-adapter tests
- editor and affected package builds
- generator gate behavior test or focused deterministic exercise
- `git diff --check`
- final status inspection

## Result

Completed.

- Every visual finding now carries a category, confidence, and explicit gate
  eligibility. Only gate-eligible structural findings can fail completeness.
- Variant-visible symbol geometry and shared rich-text metrics replace the
  largest canonical-box and approximate-text false-positive sources.
- Repeated overlap pairs are reported as object clusters, while routing and
  spacing heuristics remain non-blocking observations.
- The editor, Agent response contract, repository runner, generated schemas,
  and documentation all expose the same policy.
- Validation passed: derived/Agent focused tests (29/29), editor interaction
  tests (16/16), affected package builds, Agent API artifact check, and
  `git diff --check`.

## Commit Intent

```text
refactor(diagnostics): separate structural gates from visual observations
```
