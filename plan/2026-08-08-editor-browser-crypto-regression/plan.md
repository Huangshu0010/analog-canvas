---
status: completed
experience: candidate
---

# Restore Browser-Compatible Editor Startup

## Goal

Restore the editor GUI at `http://localhost:5173/` by removing the Node-only
`node:crypto` dependency from the browser-reachable electrical topology hash,
while preserving the documented synchronous lowercase SHA-256 contract.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.icproj.json
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.mjs
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.pdf
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.png
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.svg
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? probe-conflicts.mjs
```

These paths predate this target and do not overlap the owned files below.
They will remain untouched and unstaged.

## Owned Files

- `packages/derived/src/topology-hash.ts`
- `packages/derived/src/topology-hash.test.ts`
- `plan/2026-08-08-editor-browser-crypto-regression/plan.md`
- `plan/log.md`

## Read-Only Files

- `apps/editor/**`
- `packages/agent-adapter/**`
- `docs/specs/agent-api.md`
- unrelated dirty and untracked paths

## Shared Dependencies

- `electricalTopologyHash` is consumed by the Agent Snapshot and imported into
  the editor's browser bundle through shared packages.
- The output remains exact SHA-256 because it is a documented API contract and
  existing artifact identity must not change.

## Expected Work

1. Replace the Node-only hashing call with a deterministic synchronous
   browser-compatible SHA-256 implementation.
2. Add an exact digest regression assertion, not only a format assertion.
3. Verify the derived package, editor production build, and live Vite page.

## Validation

- `pnpm exec vitest run packages/derived/src/topology-hash.test.ts`
- `pnpm --filter @icm/editor build`
- live browser load at `http://localhost:5173/` with no console errors
- `pnpm typecheck`
- `git diff --check`
- `git status --short --branch`

The focused hash test protects identity compatibility; the editor build and
live load cover the browser-boundary regression; typecheck covers the shared
package dependency surface.

## Experience Signal (for human review)

Shared packages imported by the browser need an explicit browser-runtime gate;
Node-based unit tests and TypeScript checks did not catch this dependency leak.

## Commit Intent

Commit as:

```text
fix(editor): keep topology hashing browser compatible
```

## Result

- Root cause confirmed in the live browser console: the editor imported
  `node:crypto.createHash` through `@icm/derived`, which Vite externalized and
  then rejected at runtime.
- Replaced that dependency with a synchronous runtime-neutral SHA-256
  implementation while preserving the exact digest.
- Added an exact known digest assertion for the canonical empty test project.
- Focused tests passed (3/3), workspace typecheck passed, the editor production
  build passed without the browser-external warning after rebuilding derived,
  and a fresh browser tab loaded the complete editor with no warnings/errors.
