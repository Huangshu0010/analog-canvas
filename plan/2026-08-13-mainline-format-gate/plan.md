---
status: completed
experience: none
---

# Mainline formatting gate

## Goal

Restore the formatting gate for the already validated electrical-contact branch so it can complete the required mainline delivery checks.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/unified-electrical-contact...origin/codex/unified-electrical-contact
```

The worktree is clean. The CI failure identifies one formatting-only change; this target owns:

- `packages/derived/src/contact.ts`
- `packages/edit-engine/src/routing-planner.ts`
- `packages/edit-engine/src/wire-editing.test.ts`
- `apps/editor/e2e/manual-editor.spec.ts`
- `fixtures/exports/phase-7-dense-analog/*`
- `plan/2026-08-13-mainline-format-gate/plan.md`
- `plan/log.md`

The complete gate exposed one routing regression within the branch's owned contact-authoring contract: pass-through discovery can capture another pin on a wire endpoint's own device. This target now owns the narrow planner correction and its regression tests. The export golden may be regenerated only if an exact diff proves that it records the accepted junction-rendering behavior already implemented on this branch.

## Work

1. Apply the repository formatter to the single reported source file.
2. Diagnose the export-golden mismatch and update the fixture only when the difference is the intended junction rendering.
3. Exclude non-selected pins of the source and destination devices from automatic pass-through contacts, while preserving third-party pin capture.
4. Align the obsolete Gate-to-Drain dot assertion with the accepted two-pin/simple-corner visual rule.
5. Re-run the complete mainline gate from frozen dependencies.
6. Record and commit the gate repair before publishing the branch.

## Validation

- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

The complete gate is justified because this is the final non-document delivery to `main`.

## Commit Intent

Commit as:

```text
chore: satisfy contact formatting gate
```

## Outcome

The branch now satisfies formatting, records the accepted dotless simple-corner export in all formal goldens, and prevents pass-through discovery from shorting another pin on either explicitly selected endpoint device. Third-party pins crossed by a wire remain electrically captured. Two obsolete browser expectations were aligned with the accepted contact contract. Frozen install and the complete `pnpm ci:check` passed: 683 unit tests, all workspace builds, export/PWA/production/release checks, and 99 browser tests.
