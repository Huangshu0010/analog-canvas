# Preserve instance-label clearance

## Goal

Preserve the exact authored/default instance-label distance, including the
Razavi `1.5`-unit side gap, across move, rotate, and mirror transforms while
keeping text upright.

## Dirty-State Decision

Unrelated editor/drafting work remains dirty. This target owns only the clean
Edit Engine transaction and routing regression files plus this plan. The dirty
shared log and all other paths remain untouched.

## Owned Files

- `packages/edit-engine/src/transaction.ts`
- `packages/edit-engine/src/routing.test.ts`
- `plan/2026-08-10-preserve-instance-label-clearance/plan.md`

## Expected Work

1. Remove transform-time minimum-clearance expansion.
2. Continue transforming the exact local label anchor to the new side.
3. Keep instance-label text upright and recompute alignment/offset.
4. Protect exact distance preservation with rotate/mirror assertions.

## Validation

- Complete Edit Engine tests and build.
- Editor App unit tests.
- `git diff --check`.

## Commit Intent

```text
fix(edit-engine): preserve transformed label clearance
```

## Outcome

- Removed the transform-time two-grid clearance expansion.
- Instance labels now retain their exact local anchor through move, rotate, and
  mirror; the Razavi side-label gap therefore remains exactly `1.5` units.
- Text remains upright at zero degrees, while world-space alignment and offset
  are updated from the transformed anchor.
- All Edit Engine tests passed (45/45), the Edit Engine build passed, editor App
  tests passed (11/11), and `git diff --check` passed.
- The shared log remains concurrently dirty, so the target result is recorded
  here without staging unrelated work.
