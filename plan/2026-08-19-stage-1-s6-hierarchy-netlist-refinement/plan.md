---
status: completed
experience: none
---

# Refine Stage 1 S6 hierarchy netlist scope

## Goal

Refine roadmap S6 around hierarchy netlist completeness, reuse the delivered
Cell Symbol Layout work, and freeze one internal/external/unresolved subcircuit
protocol without changing current GUI behavior.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The dedicated worktree is clean. This documentation-only target owns:

- `docs/roadmap/stage-1-schematic-foundation.md`
- `plan/2026-08-19-stage-1-s6-hierarchy-netlist-refinement/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only shared evidence includes the existing hierarchy model, planners,
extractor, and the user-owned `codex/cell-symbol-layout` worktree. That
worktree is dirty and remains untouched. Its definition-level body and visual
pin side/offset editing is an integration dependency, not work owned here.

## Work

1. Reframe S6 as completing hierarchy netlist semantics rather than rebuilding
   Cell hierarchy or Cell Symbol Layout.
2. Separate formal netlist terminal order from visual pin side/offset layout.
3. Define one authority for internal Cell interfaces, external black-box
   definitions, unresolved targets, formal parameters/defaults, and Instance
   overrides.
4. Require a shared caller-impact proposal and atomic reconciliation path while
   preserving existing hierarchy GUI behavior.
5. Record and validate the documentation-only outcome.

## Validation

- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: no-test-change
- Reason: this target changes roadmap and factual plan records only; no
  runtime, schema, transaction, or GUI behavior changes.

## Commit Intent

Commit as:

```text
docs(roadmap): refine hierarchy netlist authoring
```

## Outcome

Refined S6 as hierarchy netlist completion on top of the existing typed Cell
and Cell Symbol Layout systems. The roadmap now separates visual pin placement
from formal netlist order; defines shared internal/external interface and
parameter semantics; distinguishes internal, external, and unresolved targets;
requires one caller-impact proposal that composes the existing Property and
Connectivity protocols; and extends the IR/Preflight exit without changing
current hierarchy GUI behavior. Documentation, test-impact, diff, and branch
status checks passed.
