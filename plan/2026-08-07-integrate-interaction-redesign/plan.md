# Integrate Interaction Redesign

## Goal

Consolidate the reviewed editor changes into a bounded Phase 8 plan and a
proposed interaction contract covering direct manipulation, manual authoring,
automatic junction semantics, toolbar reduction, keyboard and viewport
gestures, Agent parity, and higher-fidelity VSS-derived symbols.

This target changes planning and specification documents only. It does not
claim that the Phase 7 editor already implements the proposed behavior.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean, so all changes made by this target are owned here.

## Owned Files

- `plan/2026-08-07-integrate-interaction-redesign/plan.md`
- `docs/specs/editor-interaction.md`
- `docs/specs/README.md`
- `docs/roadmap/phase-8-direct-manipulation-and-manual-authoring.md`
- `docs/roadmap/README.md`
- `plan/log.md`

## Read-Only Files

- `README.md`
- `docs/overall-product-plan.md`
- `docs/specs/edit-engine.md`
- `docs/specs/connectivity-and-routing.md`
- `docs/specs/symbol-dsl.md`
- `docs/specs/vss-development-import.md`
- `docs/specs/agent-api.md`
- `docs/roadmap/phase-0-contracts-and-scaffold.md`
- `docs/roadmap/phase-1-core-editor-slice.md`
- `docs/roadmap/phase-2-spice-import.md`
- `docs/roadmap/phase-3-connectivity-and-routing.md`
- `docs/roadmap/phase-4-full-spice-baseline.md`
- `docs/roadmap/phase-5-symbols-and-visual-quality.md`
- `docs/roadmap/phase-6-agent-api.md`
- `docs/roadmap/phase-7-export-and-hardening.md`
- `apps/**`
- `packages/**`
- `lib/**`
- `netlists/**`

## Shared Dependencies

- The accepted Document, Edit Engine, routing, Symbol DSL, VSS import, and
  Agent API contracts remain the implemented Phase 7 baseline.
- Phase 8 must extend those contracts compatibly before UI work relies on new
  topology-authoring operations.
- `lib/circuit.vss` remains immutable build-time evidence and is never a
  runtime dependency.

## Expected Work

1. Define one proposed interaction contract with explicit pointer, keyboard,
   viewport, wiring, selection, and destructive-action semantics.
2. Introduce Phase 8 with dependency-ordered work packages and demonstrable
   acceptance scenarios.
3. Update the specification and roadmap indexes without rewriting completed
   Phase 0-7 history.
4. Record the factual documentation target in `plan/log.md`.

## Validation

- Run Prettier in check mode for the changed Markdown files.
- Check local Markdown links and balanced fenced code blocks for changed docs.
- Run `git diff --check`.
- Run `git status --short --branch`.

These checks cover the only changed surface: Markdown structure, internal
navigation, and repository hygiene. Runtime tests are not warranted because
this target changes no product code or accepted implemented contract.

## Experience Signal (for human review)

The prior roadmap mixed demonstrator controls with the intended production
interaction model. The Phase 8 split preserves completed implementation
history while making the new UX contract explicit; the human may later decide
whether this is a reusable planning lesson.

## Commit Intent

Commit as:

```text
Plan Phase 8 interaction redesign
```
