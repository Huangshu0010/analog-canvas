---
status: completed
experience: none
---

# Phase 2 Structural Netlist Closure

## Goal

Deliver the structural netlist loop for the schematic editor: deterministic
SPICE/Spectre design-netlist export from the current Project, file/preview UI,
structural SPICE import, and automated round-trip evidence. Preserve typed
primitive, model, internal-cell and external-subcircuit bindings without adding
simulation decks, foundry model resolution, PDK installation, layout, LVS or
PEX.

## State and ownership

Start state from `git status --short --branch` in the target worktree:

```text
## codex/phase2-netlist-closure
```

The target worktree is clean. The root worktree has untracked `.pnpm-store/`
and `.worktrees/` infrastructure only; they are not target-owned and do not
overlap this worktree. This target owns the netlist export/import closure,
editor entry points, structural fixture corpus, documentation and tests.

Expected work includes `packages/netlist`, `packages/spice`, `apps/editor`
netlist/export and file workflows, current contracts/fixtures, `docs/specs`,
an ADR if a persistent contract needs one, this plan and `plan/log.md`.
Shared dependencies are Project schema 15, external-subcircuit definitions,
the typed edit engine, device descriptors and the existing project load/save
boundary. PDK models, simulator profiles and layout artifacts are read-only
out of scope.

## Work

1. Audit and complete DesignNetlistIR/preflight coverage for primitive, model,
   internal and external calls, formal parameters, ordered terminals, globals
   and actionable diagnostic locators.
2. Complete deterministic SPICE and Spectre printer behavior and expose export
   preview/download from the editor.
3. Complete structural import handling and define explicit replace/import
   outcomes without pretending to retain source-text formatting.
4. Add round-trip fixtures and normalized semantic comparisons, including
   external SKY130-style calls and hierarchy.
5. Document the Stage-2 boundary, product workflow and intentionally excluded
   PDK/simulation responsibilities.

## Validation

- focused netlist, spice, editor and browser contracts
- round-trip fixture tests
- `pnpm typecheck`, `pnpm build`, `pnpm format:check`, `pnpm docs:check`
- `pnpm test:impact -- --base origin/main`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: typed binding to emitted call syntax; ordered nodes and raw
  parameters; imported external calls; deterministic exported files; structural
  Project → netlist → Project semantic equivalence.
- Primary checks: DesignNetlistIR, printers, SPICE compiler/importer, editor
  preview/download, and Playwright file/export workflow.

## Commit intent

```text
feat(netlist): complete structural import-export closure
```

## Outcome

The pre-existing deterministic printers and structural SPICE importer already
provided the back-end loop. This target completed its delivery boundary:

- File menu and preflight dialog now preview and download structural SPICE or
  Spectre netlists from the validated Project.
- External-master terminal identities/directions remain authoritative in the
  export IR, and their parameter policy is open so raw PDK/library keys such
  as `l`, `w`, and `nf` survive export without model resolution.
- The structural SPICE round-trip contract proves hierarchy, external `X` call
  target and node ordering, and raw external parameters survive
  Project -> SPICE -> Project semantic normalization.
- Product and specification documentation now distinguish structural export
  from PDK/model selection and simulation-deck authoring.

Validation passed: focused unit contracts (4 files / 28 tests), workspace
typecheck, workspace build, focused Playwright preflight/preview/download flow
(3 tests), formatting, Markdown links (117 documents), test impact against
`origin/main`, and `git diff --check`. No simulation, PDK, layout, LVS or PEX
behavior was added.
