# Fix integration test zero-length trunk fixture

## Goal

Repair the single failing `integration.test.ts` case so CI turns green. The
`2bb4c2b` flat-CDAC commit added a correct `ZERO_LENGTH_SEGMENT` conflict to
`expandRouteGraph` but did not update the pre-existing
"no edit in the output is ever route_orthogonal" test case, whose fixture
constructs two coincident tap nodes when the terminal's outward direction is
purely horizontal.

## Root Cause

In `packages/agent-routing/test/integration.test.ts` lines 296-311, the test
builds:

- `tap0` at `{ x: pointA.x + outward.x*80, y: pointA.y + outward.y*80 }`
- `tap1` at `{ x: pointA.x + outward.x*80, y: pointA.y + outward.y*200 }`

For endpoint A (pin P1) in the phase-3-routing fixture, `outward` is purely
horizontal (`y === 0`), so both taps collapse to the same point (confirmed:
`(20, 300)`). The trunk edge `tap0 -> tap1` is therefore zero-length, and the
correct `samePoint` guard added in `36279ed` now reports `ZERO_LENGTH_SEGMENT`,
failing the `expect(expansion.conflicts).toEqual([])` assertion.

The detection is correct; the fixture is the defect.

## Owned Files

- `plan/2026-08-08-fix-integration-zero-length-fixture/plan.md`
- `packages/agent-routing/test/integration.test.ts` (the tap1 y-coordinate)

## Expected Work

Give `tap1` a y-coordinate that does not collapse when `outward.y === 0`, so
the trunk edge has real length and the test exercises its intended
escape + trunk graph.

## Validation

- `pnpm vitest run packages/agent-routing/test/integration.test.ts` passes.
- `git diff --check`.

## Commit Intent

Commit standalone as a test fix, then push so remote CI turns green (modulo
the separately-deferred E2E failures).
