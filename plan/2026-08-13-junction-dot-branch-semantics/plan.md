---
status: completed
experience: none
---

# Junction Dot Branch Semantics

## Goal

Render a junction dot only when a confirmed same-Net electrical contact has
three or more visible incident branches, while correctly recognizing a device
pin that lands on the middle or bend of a routed conductor.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-electrical-contact...origin/codex/unified-electrical-contact
```

The worktree is clean. This target owns the shared contact-evidence contract,
its SVG junction presentation consumer, and focused regression tests:

- `packages/derived/src/contact.ts`
- `packages/derived/src/contact.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `fixtures/visual-golden/phase-5-dense-analog.svg`
- `plan/2026-08-13-junction-dot-branch-semantics/plan.md`
- `plan/log.md`

Shared dependencies are resolved route centerlines, endpoint visibility, Net
membership, and symbol pin outward directions. No persisted schema or editing
transaction is changed.

## Work

1. Express junction-dot eligibility from confirmed contact evidence: three
   distinct visible conductor directions, or three coincident terminals.
2. Let a same-Net route segment contribute its one or two incident directions
   when it passes through an explicit terminal/Junction contact point, without
   turning free geometric crossings into contacts.
3. Add the full truth table for pin-to-pin, pin-to-route endpoint, pin-to-route
   bend/midpoint, and three-way branch cases, including resistor/capacitor pins.
4. Keep power-port and hollow-port presentation exclusions unchanged.

## Validation

- `pnpm test:local packages/derived/src/contact.test.ts packages/render-svg/src/render.test.ts`
- `pnpm --filter @icm/derived typecheck`
- `pnpm --filter @icm/render-svg typecheck`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix: derive junction dots from electrical branch geometry
```

## Outcome

Junction dots now represent real three-way-or-greater electrical branches.
Two-pin joins, route endpoints, and pin corners remain dotless; a same-Net
Route middle or bend contributes both visible Route arms, so resistor,
capacitor, and transistor pins show a dot exactly when a third branch exists.
Focused derived/render tests passed (34 tests), both affected packages built
and typechecked, and the intentional dense-fixture golden was regenerated.
