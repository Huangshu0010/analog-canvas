---
status: completed
experience: none
---

# Complete Top-Cell Port and Net Semantics

## Goal

Make schema-18 Port roles complete across authoring and deterministic netlist
export: allow a Formal Cell Pin in the top Cell, treat a Free Net Port as a
non-emitting electrical Net marker, and avoid generated-name warnings for Nets
whose exported name is already owned by a formal terminal.

## State and Ownership

Start state from `git status --short --branch` in the dedicated worktree:

```text
## codex/top-cell-port-net-semantics
```

The worktree is clean and was created from `main` at `ff89fb95`. Other
worktrees and their in-progress targets are isolated and will remain untouched.
This target owns:

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/hierarchy.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `packages/netlist/src/extract.ts`
- `packages/netlist/src/current-contract.test.ts`
- `docs/adr/0034-top-cell-formal-port-and-free-port-export.md`
- `docs/current/README.md`
- `docs/specs/editor-interaction.md`
- `docs/specs/netlist-export.md`
- `docs/user/schematic-hierarchy.md`
- `plan/2026-08-21-top-cell-port-net-semantics/plan.md`
- `plan/log.md`

- Shared: schema-18 Port role/name contracts from ADR 0033, formal interface
  extraction, and component insertion state.
- Read-only: schema/model and edit-engine Port lifecycle contracts, which
  already support formal terminals in `topDocumentId`.

## Work

1. Supersede the top-only role restriction while retaining explicit Free Net
   Port versus Formal Cell Pin intent in every Cell.
2. Preserve the existing non-emitting formal-Port projection, make Free Net
   Ports non-emitting in netlist extraction, and validate that each Free Net
   Port is attached to its Net.
3. Give formal terminal names priority before anonymous local-Net generation.
4. Add unit and browser contracts for top formal pins, free Net Port export,
   and warning-free formal interfaces; update current specifications and user
   guidance.

## Validation

- `pnpm test:local packages/netlist/src/current-contract.test.ts`
- `pnpm test:e2e:local apps/editor/e2e/hierarchy.spec.ts --grep "top Formal Cell Pin|Free Net Port"`
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep "Port shortcut|hollow and filled Ports"`
- `pnpm typecheck`
- `pnpm docs:check`
- `pnpm test:impact -- --base main`
- `git diff --check`
- `git status --short --branch`

Run `pnpm verify:branch` if focused validation reveals a shared-contract risk
or after the final cross-package diff justifies the broader branch gate.

## Test Impact

- Decision: tests-updated
- Contracts: top-Cell formal interface authoring; non-emitting Free Net Port;
  formal-terminal naming precedence in DesignNetlistIR.
- Primary checks: `packages/netlist/src/current-contract.test.ts` and focused
  Port workflows in `apps/editor/e2e/hierarchy.spec.ts` and
  `apps/editor/e2e/manual-editor.spec.ts`.

## Commit Intent

Commit as:

```text
fix(netlist): complete top cell port semantics
```

## Outcome

Every Document now offers an explicit Formal Cell Pin as the default Port role
while retaining an explicit Free Net Port role. Formal pins contribute ordered
top or child `.subckt` interfaces without anonymous-Net warnings; Free Net
Ports validate their pin-`P` Net membership and are omitted as non-emitting Net
markers instead of failing device lookup. ADR 0034 and current specs supersede
the former top-only restriction.

Validation passed: netlist package (3 files / 19 tests), complete hierarchy E2E
(10 tests), focused manual Port E2E (2 tests), typecheck, format/docs/test-impact,
workspace build, and `pnpm verify:branch` (162 files / 977 tests plus production
preview smoke). Browser tests used isolated worktree ports so another
worktree's development server could not satisfy the readiness probe.
