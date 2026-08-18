---
status: completed
experience: none
---

# Plan Agent Project Lifecycle and Artifact Completion

## Goal

Produce a detailed, executable cross-module roadmap that closes the remaining
browser Agent takeover gaps except simulation/PVT/waveforms and design-netlist
export. The roadmap must preserve the browser-authoritative security boundary,
keep Agent API v2 compatible, and separate persisted Project mutations, file
artifacts, and transient editor collaboration state.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/docs-information-architecture...origin/codex/docs-information-architecture
```

The worktree is clean. This target is documentation-only and does not alter
the current product implementation or generated API artifacts. The current
branch changes documentation architecture relative to `main`; this target
extends that same documentation surface and does not overlap another dirty
worker.

- `plan/2026-08-13-agent-project-lifecycle-artifacts/plan.md`
- `docs/roadmap/agent-project-lifecycle-and-artifacts-plan.md`
- `docs/roadmap/README.md`
- `plan/log.md`

Read-only shared dependencies:

- `docs/specs/agent-api.md`
- `docs/specs/web-agent-session.md`
- `docs/specs/project-file-format.md`
- `docs/specs/persistence-and-recovery.md`
- `docs/specs/export.md`
- `docs/adr/0016-browser-authoritative-agent-session.md`
- current Agent adapter, editor project lifecycle, importer, exporter, and
  Edit Engine implementation

## Work

1. Record the current capability baseline and explicitly freeze the excluded
   simulation, PVT, waveform, and design-netlist export scope.
2. Define the target authority split between Project/Document transactions,
   bounded import/export artifacts, and transient editor collaboration state.
3. Break delivery into independently reviewable work packages with ownership,
   dependencies, validation, compatibility, and exit gates.
4. Define end-to-end acceptance scenarios for exact Snapshot round-trip,
   Project lifecycle, staged Project/SPICE import, Project/visual export,
   history, UI collaboration, authorization, recovery, and session handoff.
5. Add the roadmap to the current roadmap index.

## Validation

- `pnpm references:check`
- `git diff --check`
- `git status --short --branch`

No runtime test is justified because this target changes planning documents
only. Each implementation work package in the roadmap defines its own focused
and delivery validation.

## Commit Intent

Commit as:

```text
docs: plan complete Agent project lifecycle interfaces
```

## Outcome

Added the current cross-module roadmap for completing Agent Project lifecycle,
file artifact, exact-read, history, and editor-collaboration interfaces. The
roadmap freezes the requested exclusions, separates three authority domains,
defines the recommended v3 compatibility boundary, and provides AP0--AP9 work
packages with deterministic exit gates and end-to-end acceptance scenarios.

Validation completed: `pnpm references:check` and `git diff --check` passed;
final status review shows only the intended documentation files.
