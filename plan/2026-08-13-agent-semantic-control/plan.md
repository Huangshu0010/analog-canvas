---
status: completed
experience: none
---

# Shared Agent Semantic Editor Control

## Goal

Let a scoped external Agent make its review visible in the existing browser
editor without adding a Circuit operation or persisting any canvas state. The
Agent will submit typed `transact` semantic intents for active existing Cell,
canonical locator selection, Net highlight, fit, and clear focus. These intents
must consume the GUI's existing locator/connectivity/highlight/viewport owners,
not rebuild geometry from Agent coordinates. Project-level Cell creation,
rename, deletion, hierarchy transactions, Project revision/history, files,
simulation/PVT/waveforms, and design-netlist export remain out of scope.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The worktree is clean after the pushed same-Project session-recovery target.
This target owns the additive production `transact` semantic-intent schema,
browser host callback, App semantic controller adapter, scope/capability
advertising, OpenAPI artifacts, and focused Agent/editor tests/docs. It does
not replace the existing document controller or create another mutation path.

- `packages/agent-adapter/src/{schema,host,service,envelope,openapi}.ts`
- `packages/derived/src/object-locator.ts` and its package dependency manifest:
  expose the already-canonical Locator as one runtime schema for public request
  validation; Agent code must not mirror its fields locally
- `apps/editor/src/agent/{browser-agent-host,use-agent-session}.ts` and
  `apps/editor/src/app/App.tsx`
- focused Agent adapter, browser host/editor tests, generated artifacts, and
  current Agent/session/editor specifications
- this plan and `plan/log.md`

Read-only authorities:

- project connectivity index and Net trace/highlight service
- existing App `navigateToLocator`, `highlightNet`, selection controller, and
  view-box handling
- `EditorDocumentController` and `DocumentHistory`: semantic intents must not
  enter them, change revision, history, recovery, topology hash, or formal SVG

## Work

1. Add a production-typed, mutually exclusive `semanticIntent` transaction
   form and the `editor.semantic-control` scope. Keep it inside `transact`; do
   not add a fifth Circuit operation or private Agent route.
2. Define host input/output with canonical `ObjectLocator` and resolved
   evidence. Service checks scope and returns a normal transaction result with
   `applied: false` and unchanged revision for a successful non-persisting
   intent.
3. Route browser semantic requests into one App adapter that uses existing
   selection, navigation, Net highlighting, and view controls. Reject stale,
   missing, inaccessible, or cross-Project locators with typed diagnostics.
4. Verify Agent semantic control produces no Project/Document/history/recovery
   mutation and GUI/Agent Net highlight share the same derived trace.
5. Update public examples/OpenAPI/docs and explicit current roadmap state.

## Validation

- focused Agent schema/service/host and App semantic-control tests
- generated Agent artifacts check, docs/type/diff checks
- browser Agent E2E plus `pnpm verify:branch`
- `git status --short --branch`

## Commit Intent

```text
feat(agent): add shared semantic editor control
```

## Outcome

Added the `editor.semantic-control` scope and a mutually exclusive
`transact.semanticIntent` form for activating an existing Cell, selecting a
canonical derived locator, highlighting a Net, fitting its Document, and
clearing focus. The public request reuses the runtime `ObjectLocatorSchema`
from `@icm/derived`; no Agent-specific locator mirror or coordinate-derived
control path remains. The browser Host delegates through one App UI adapter,
while the service returns `applied: false` with an unchanged revision and never
touches Edit Engine, history, recovery, topology, or formal output.

Capabilities advertise semantic control only when the live browser adapter is
present. Focused schema/host/Worker tests and the browser Agent E2E cover
scope denial, forwarded control, and no-history behavior. Generated OpenAPI,
current specs, user-facing usage guidance, and the roadmap now record the
implemented bounded surface.

Validation: focused unit suites (32 tests), `web-agent-session` browser E2E,
typecheck, generated Agent artifact write/check, docs/diff checks, and
`pnpm verify:branch` passed (119 files, 719 tests; all workspace builds and
production smoke).
