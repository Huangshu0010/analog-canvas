---
status: completed
experience: none
---

# Power-domain Net normalization

## Goal

Make VDD/GND symbol terminals the authoritative source of manual power-Net
semantics. A Net containing one compatible power symbol is global (and receives
a default name only when unnamed); legacy documents are normalized on open so
safe Razavi bulk completion is available. Suppress only the resulting exact,
same-Net power-pin visual-contact false positive.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/construction-line-k-shortcut...origin/codex/construction-line-k-shortcut
```

The worktree is clean. This target owns:

- `packages/model/src/` power-domain facts and exports
- `packages/edit-engine/src/` normalization edit/transaction semantics
- `packages/derived/src/` ERC and visual-contact diagnostic behavior
- `apps/editor/src/` legacy-document normalization and Razavi bulk policy
- generated Agent API artifacts, focused tests, target plan, and `plan/log.md`

Shared dependencies: persisted Net schema, Agent edit schema/OpenAPI, Razavi
symbol IDs/pin definitions, and visual diagnostics. The supplied
`E:/Downloads/new-circuit.icproj (2).json` is read-only diagnostic evidence.

## Work

1. Introduce a model-level power-domain classifier based on actual `vdd.P` and
   `ground.0` Net membership, including a conflict result for mixed domains.
2. Normalize compatible power Nets centrally after transactional topology
   changes and expose an explicit normalization edit for legacy projects.
3. Run that legacy normalization before manual Razavi bulk completion; preserve
   imported/source-bound devices and never infer B=S.
4. Make ERC identify a mixed power-domain Net explicitly, and exempt only
   exact visible same-Net power-terminal contact from symbol-bound overlap.
5. Add fixture-derived regressions, regenerate Agent API artifacts, and run
   focused and full validation.

## Validation

- focused model/edit-engine/derived/editor unit tests
- focused manual-editor browser test for the supplied legacy topology
- `corepack pnpm agent-api:artifacts:check`
- `corepack pnpm typecheck`
- `corepack pnpm format:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(connectivity): normalize symbol-defined power Nets
```

## Outcome

Completed the power-domain contract without rewriting source-bound device
connectivity: `vdd.P` and `ground.0` membership now classify a Net, promote a
compatible Net to global scope, and add `VDD`/`0` only if its canonical name is
available. The editor applies that idempotent normalization to legacy projects
before safe three-terminal MOS bulk completion. PMOS bulk therefore attaches to
the exact VDD-symbol Net in the supplied legacy topology; `B` is never merged
with `S`.

ERC now reports a mixed VDD/GND Net explicitly and accepts a matching power
symbol only for the compatible MOS bulk domain. Visual diagnostics suppress
only an exact, same-Net, visible terminal contact between a power marker and a
symbol; ordinary symbol overlap remains reportable. The Agent edit schema has
the explicit `normalize_power_nets` operation and regenerated artifacts.

Validation passed: focused model/edit-engine/derived/editor tests (51 tests),
the legacy VDD browser regression, typecheck, formatting, Agent artifact check,
diff check, frozen install, and all static/unit/release stages of
`pnpm ci:check` (589 unit tests). The full 16-worker E2E run was attempted
twice; each run had only unrelated, non-repeatable 30-second interaction
timeouts in different existing tests. Each failing test passed immediately in
an isolated single-worker rerun, as did the new regression. This is recorded
as local parallel-browser capacity noise, not suppressed or changed by this
target.
