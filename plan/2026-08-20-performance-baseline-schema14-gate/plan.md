---
status: completed
experience: none
---

# Repair the Schema-14 Performance Baseline Gate

## Goal

Make the release performance baseline construct its synthetic 500-resistor
project with current schema-14 netlist facts so the required mainline gate can
run without relaxing strict project validation.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/phase1-schematic-foundation-plan...origin/codex/phase1-schematic-foundation-plan
```

The worktree is clean. This target owns:

- `scripts/performance-baseline.mjs`
- `apps/editor/e2e/component-insert.spec.ts`
- `apps/editor/e2e/drafting.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/project-file.spec.ts`
- `plan/2026-08-20-performance-baseline-schema14-gate/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

The schema-14 project contract is read-only. The failing gate proves that the
baseline fixture still contains retired `Instance.properties`; the repair must
use required `Instance.netlist` fields rather than weaken the strict schema or
add a compatibility branch.

## Work

1. Replace each synthetic resistor's retired property payload with its current
   Reference, primitive binding, and `value` parameter facts.
2. Update the stale browser contracts discovered by the first full gate: the
   compact Properties labels, canonical internal-Cell binding, now-exposed
   instance netlist controls, and current schema-13-to-14 migration/save
   boundary.
3. Re-run the affected browser contracts, then the full `pnpm ci:check` gate
   before creating the requested mainline PR.

## Validation

- `node scripts/performance-baseline.mjs`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: synthetic schema-14 fixtures remain strict; browser assertions
  describe the canonical schema-13-to-14 migration and the delivered compact
  netlist authoring surface without reintroducing retired binding fields.
- Primary checks: the four affected Playwright specs, then `pnpm ci:check`.

## Commit Intent

Commit as:

```text
fix(ci): update performance baseline for schema 14
```

## Outcome

Repaired the performance baseline with current Instance netlist facts and
updated seven stale E2E expectations to the delivered schema-14 and compact
authoring contracts. The complete CI gate passed: static checks, 155 unit files
/ 928 tests, production build, release verification, and 158 E2E tests.
