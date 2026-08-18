---
status: completed
experience: none
---

# Four-Operation Agent Takeover Roadmap

## Goal

Replace the superseded API-v3 expansion roadmap with a current, detailed
completion plan for browser Agent takeover. It preserves the hosted v2
`capabilities`/`snapshot`/`transact`/`render` contract, excludes simulation,
PVT, waveforms, and SPICE/design-netlist export, and states the remaining
authority migrations before lifecycle, files, history, and collaboration work.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean after commit `231b9d3`. This documentation target owns
only the new current roadmap, its index/reference updates if needed, this plan,
and the factual plan log. It does not change public runtime schemas, generated
OpenAPI, implementation, or the archived v3 planning record.

Shared read-only dependencies:

- ADR 0019 and current Agent/web-session/project/export specifications;
- the superseded AP0--AP9 roadmap, retained as historical evidence;
- future model-authority targets for Port, RichText/VisualAnchor, and typed
  netlist migration.

## Work

1. Record the current API boundary and explicitly distinguish Circuit
   operations from any future browser-owned file resource.
2. Order remaining model-authority migrations before Agent lifecycle expansion.
3. Define bounded work packages, dependencies, scopes, error/revision rules,
   validation, and completion scenarios for project hierarchy, artifacts,
   staged import, history/duplication, and semantic collaboration.
4. Make exclusions and decision gates explicit so this plan does not silently
   reintroduce API v3 or simulation/netlist-export scope.

## Validation

- `pnpm docs:check`
- `pnpm references:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
docs(agent): plan four-operation takeover completion
```

## Outcome

Published the current four-operation takeover roadmap. It keeps Circuit work in
`capabilities`/`snapshot`/`transact`/`render`, sequences power/Port/RichText/
typed-netlist authority migrations before lifecycle work, and makes a scoped
browser File Resource an explicit ADR-gated transport decision rather than a
hidden fifth Circuit operation. It excludes simulation, PVT, waveforms, and
SPICE/design-netlist export.

Validation passed: `pnpm docs:check`, `pnpm references:check`, `git diff
--check`, and final branch status inspection.
