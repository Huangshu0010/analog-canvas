---
status: completed
experience: none
---

# Differential-output op amp with an independent output swap

## Goal

Give the op amp an output `+`/`−` pair that can be reversed independently of
its inputs. The single-ended op amp has one unmarked output, so there was
nothing to reverse; a Symbol variant cannot express it either, because a
variant may hide or add artwork but may not rename or move a pin, and pin
identity is the electrical fact.

## State and Ownership

Start state: clean worktree on `main`. Branch
`claude/differential-output-opamp`.

Owned paths:

- `scripts/generate-razavi-opamp-asset.mjs`
- `packages/symbols/assets/razavi-v1/**` and the generated catalog
- `apps/editor/src/features/editor-shell/**`,
  `apps/editor/src/features/component-insert/symbol-catalog.ts`,
  `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-22-differential-output-opamp/plan.md`, `plan/log.md`

Read-only: `fixtures/visual-reference/razavi-reference-v1/**`. No evidence
file, measurement, or manifest hash is modified.

## Work

1. Extend the op-amp generator to emit two more assets from the same pinned
   PDF vector evidence:
   - `opamp-differential` — the reviewed body with its apex truncated where
     the reviewed triangle edges reach the ±10 output height, two output leads,
     and output polarity marks that are the reviewed input marks reflected
     about the body's own vertical centerline.
   - `opamp-differential-crossed` — identical geometry with `OUT+` and `OUT-`
     exchanged.
   Every coordinate is derived from the evidence; the generator fails if the
   reviewed triangle is not symmetric about its output axis.
2. Catalog both as reviewed palette entries sharing the op amp's visual
   authority. Both must be palette entries because the product Symbol library
   (and therefore the runtime resolver) is exactly the reviewed palette set.
3. Add a "Swap + / − outputs" properties action that exchanges the two
   Symbols through the existing `set_instance_symbol` edit. The pin names are
   identical in both, so attached Nets survive and only the anchors move.

## Validation

- repository typecheck, prettier
- generator `--check`, symbol catalog, agent-kit catalog, MCP resources,
  visual-golden, references drift checks
- full unit suite; full Playwright suite
- both Symbols rendered and the swap exercised in a running editor

## Gate Review

- Decision: affected — generated symbol assets, catalogs, and editor UI.
- Early gates: generator `--check`, prettier, focused unit tests.
- Affected gates: symbols/editor unit tests, component-insert browser spec.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: generated catalogs must be regenerated in the documented
  order or their drift gates fail.

## Test Impact

- Decision: tests-updated
- Contracts: reviewed product-symbol list and counts; palette composition;
  the Symbol pairing behind the output swap.
- Primary checks:
  `apps/editor/src/features/editor-shell/differential-output-swap.test.ts`,
  `packages/symbols/src/{builtins,razavi-catalog}.test.ts`,
  `apps/editor/e2e/component-insert.spec.ts`

## Commit Intent

```text
feat(symbols): add a differential-output op amp with an output swap
```

## Outcome

`opamp-differential` and `opamp-differential-crossed` ship as reviewed palette
entries ("FD Amp" / "FD Amp X") derived from the same evidence as the op amp,
with the body cut at x=3.2014. Instance properties now carry both "Swap + / −
inputs" (a reflection) and "Swap + / − outputs" (a Symbol exchange), so the
two polarities are adjustable independently. Verified live: placing the FD amp
and pressing the output swap exchanged the Symbol while the instance kept its
identity.

Validation: typecheck, 181 unit files / 1135 tests, 187 Playwright tests, all
generated-artifact drift checks, prettier, and diff checks.
