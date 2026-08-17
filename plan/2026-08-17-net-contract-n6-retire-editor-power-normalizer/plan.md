---
status: completed
experience: none
---

# Net Contract N6 — Retire Editor Power Normalization

## Goal

Remove the editor's automatic `normalize_power_nets` startup effect, so normal
power identity is produced only by explicit name-first authoring planners and
the documented Project-entry legacy repair rather than a hidden UI mutation.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/net-contract-unification-plan...origin/codex/net-contract-unification-plan
?? .worktrees/
```

The untracked `.worktrees/` directory is unrelated shared worker
infrastructure and remains untouched.

- `apps/editor/src/app/App.tsx`
- `apps/editor/e2e/manual-editor.spec.ts` only if an existing expectation
  covers automatic power normalization
- `docs/specs/edit-engine.md`
- `docs/specs/schematic-model.md`
- `docs/roadmap/net-contract-unification-plan.md`
- `plan/2026-08-17-net-contract-n6-retire-editor-power-normalizer/plan.md`
- `plan/log.md`
- `plan/root-audit.md`

Read-only dependencies:

- `packages/model/src/power-domain.ts`
- `packages/edit-engine/src/transaction-routing.ts`
- `packages/edit-engine/src/edit-schema.ts`
- `packages/agent-adapter/src/service.ts`

## Work

1. Remove the editor-only automatic normalizer and its no-longer-needed import.
2. Preserve `normalize_power_nets` as a supported low-level compatibility edit:
   Agent/API behavior and transaction semantics do not change in this target.
3. State that normal production authoring uses `planEnsurePowerNet` or
   `planEnsureNamedNet`; project-entry repair handles the supported legacy
   duplicate case.
4. Prove no other production editor consumer retains the hidden normalizer.

## Validation

- targeted editor/model/edit-engine tests and production build
- repository search for production `powerNetNormalizations` callers
- test-impact, `git diff --check`, and branch verification

## Test Impact

- Decision: no-test-change
- Reason: this removes a UI effect; `powerNetNormalizations` and its typed
  transaction contracts retain focused model/edit-engine regressions, while the
  production-call-site search proves normal authoring no longer invokes it.

## Commit Intent

```text
refactor(net): retire editor power normalization
```

## Outcome

Removed the sole editor production caller of `powerNetNormalizations`; only its
model contract and explicit Edit Engine compatibility edit remain. Documented
the normal-authoring and Project-entry-repair boundaries.

Validation passed: focused 3-file Vitest run (32 tests), editor build,
typecheck, docs check, test-impact, production-call-site search,
`git diff --check`, and `pnpm verify:branch` (144 files / 862 tests, workspace
build, production smoke).
