---
status: completed
experience: none
---

# Phase 2 Netlist Closure Hardening

## Goal

Close the semantic gaps found in the Phase-2 review: preserve internal Cell
formal parameters through SPICE import/export, give explicit NoConnect pins a
deterministic export representation, retain formal Cell port names, strengthen
the round-trip proof from a real Project, and cover a successful browser
import-to-export workflow. Keep Spectre import, PDK/model resolution, and
simulation decks outside this target.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase2-netlist-hardening
```

The worktree is clean. The root worktree's `.pnpm-store/` and `.worktrees/`
entries are infrastructure only and do not overlap this target. This target
owns:

- `packages/netlist/src/`
- `packages/spice/src/importer.ts`, DC-source syntax normalization, and focused
  SPICE tests
- `apps/editor/src/app/App.tsx` and focused browser coverage
- `docs/specs/netlist-export.md`, user netlist documentation, this plan, and
  `plan/log.md`

Shared contracts are schema-15 Cell interfaces, NoConnect electrical intent,
the SPICE parser's parameter representation, and deterministic dialect
printers. Project schema and device definitions are read-only unless a proven
contract defect requires scope expansion.

## Work

1. Define and implement SPICE/Spectre Cell formal-parameter declarations and
   import them into `Document.netlist.formalParameters`.
2. Represent every explicit NoConnect terminal with a stable, collision-free
   local floating node while preserving positional arity; undeclared opens
   remain blocking errors.
3. Make formal Cell terminal names the exported public port tokens and map the
   connected internal Net consistently to those tokens.
4. Replace the hand-authored IR round trip with a real Project semantic loop
   that compares top Cell, globals, interfaces, hierarchy, external calls, and
   parameters.
5. Add a browser success path for SPICE import, preflight, and re-export; make
   direct export surface warnings before download.
6. Normalize emitted SPICE `V`/`I` DC source syntax back to the Project's
   canonical `dc` parameter so supported sources survive the same loop.

## Validation

- focused netlist, SPICE importer, editor and browser contracts
- `pnpm typecheck`, `pnpm build`, `pnpm format:check`, `pnpm docs:check`
- `pnpm test:impact -- --base codex/phase2-netlist-closure`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: parameterized Cell import/export, explicit open-pin emission,
  formal port naming, warning acknowledgement, and full Project structural
  semantic round trip.
- Primary checks: `packages/netlist/src/printers.test.ts`,
  `packages/netlist/src/roundtrip.test.ts`, `packages/spice/src/compiler.test.ts`,
  and `apps/editor/e2e/manual-editor.spec.ts`.

## Commit Intent

Commit as:

```text
fix(netlist): close parameterized structural round trips
```

## Outcome

The structural loop now preserves defaulted internal Cell formals through
SPICE import and both printers, uses formal terminal names as the public Cell
ports, and blocks required-only formals that neither released dialect can
declare without inventing a value. Explicit NoConnects receive deterministic,
collision-free `NC####` floating nodes and a navigable warning; direct File
export requires that warning to be reviewed before download.

The former hand-authored-IR check is now a real Project -> preflight/IR ->
SPICE -> Project -> preflight/IR semantic comparison covering top Cell,
globals, formal interfaces/defaults, internal hierarchy, external calls/raw
parameters, primitives, and explicit opens. That test exposed and this target
fixed canonical `dc` normalization for imported `V`/`I` source syntax. Browser
coverage now proves successful parameterized hierarchy import and re-export as
well as NoConnect warning acknowledgement.

Validation passed: focused changed contracts (6 files / 40 tests), complete
`packages/spice` + `packages/netlist` suites (10 files / 42 tests), workspace
typecheck/build, focused Playwright flow (5 tests), format, Markdown links (117
documents), test-impact against `codex/phase2-netlist-closure`, and diff checks.
`pnpm verify:branch` passed static checks and reached 157/159 unit files (954/956
tests), but stopped on two pre-existing schema-15 baseline failures; both were
reproduced unchanged on `codex/external-subcircuit-definition`: the ADR 0026
current-version note still says schema 14, and one browser-recovery test still
expects schema-13-to-14 behavior. They are outside this target and no target
files overlap them.
