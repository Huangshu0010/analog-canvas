---
status: completed
experience: none
---

# Razavi MOS Arrow Seam and PMOS Parity

## Goal

Remove the raster seam between the Razavi MOS source-arrow support conductor
and its filled triangle, and prove that the PMOS textbook variant receives the
same visual replacement as NMOS.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
M fixtures/agent-api/agent-circuit-response.schema.json
M fixtures/agent-api/agent-circuit.openapi.json
M packages/agent-adapter/src/schema.ts
M packages/agent-adapter/src/snapshot.ts
M packages/model/src/index.ts
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.*
?? packages/model/src/drafting-geometry-schema.ts
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? probe-conflicts.mjs
```

All dirty paths are unrelated user/other-worker work. This target does not
modify them.

## Owned Files

- `scripts/generate-visio-mos-assets.mjs`
- generated MOS assets/catalog/fidelity board
- `packages/symbols/src/razavi-catalog.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts` if browser coverage needs extension
- `plan/2026-08-08-razavi-mos-arrow-seam-and-pmos-parity/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- user-supplied Razavi reference image
- Agent API and model/drafting work owned by others

## Shared Dependencies

- canonical four-terminal MOS and `textbook-3terminal` variant contract
- generated Razavi catalog and editor symbol resolution

## Expected Work

1. Give the source-arrow support conductor a small deterministic overlap under
   the filled triangle, eliminating anti-alias seams without moving pins or
   visible triangle dimensions.
2. Assert both NMOS and PMOS variants hide the four-terminal bulk primitive
   and present the calibrated source arrow.
3. Regenerate assets and run focused catalog/editor validation.

## Validation

- MOS generator and Razavi catalog check commands
- focused symbol Vitest and palette browser E2E
- `git diff --check` and `git status --short --branch`

## Commit Intent

```text
fix(razavi): close MOS arrow seams and verify PMOS variant
```

## Result

Completed. The source-arrow support line now overlaps the filled triangle by
half of that VSS source shape's stroke width; because the triangle renders
after the line, the overlap is invisible and removes raster seams. Both NMOS
and PMOS `textbook-3terminal` variants now have explicit checks for hidden
four-terminal primitives, a visible filled source arrow, and the calibrated
overlapping support endpoints.

Validation passed:

- `corepack pnpm vitest run packages/symbols/src/razavi-catalog.test.ts apps/editor/src/App.test.tsx` (17 tests)
- `corepack pnpm symbols:visio-mos:check`
- `corepack pnpm symbols:razavi:check`
- `corepack pnpm exec playwright test apps/editor/e2e/manual-editor.spec.ts --grep "faithful symbol previews"`
- `git diff --check`
