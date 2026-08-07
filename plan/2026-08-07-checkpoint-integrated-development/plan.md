# Checkpoint Integrated Development

## Goal

Turn the intentionally retained editor, symbol, hierarchy, visual-prototype,
and Phase 9 Agent changes into a verified repository baseline so the Razavi
visual-convergence implementation can begin from a clean, attributable state.

## Dirty-State Note

Start state: `main` at `c035d7b`, aligned with `origin/main`, with 52 modified
tracked paths and the documented untracked outputs/plans for the retained
targets. `lib/circuit.vss` is unchanged.

The dirty paths have been audited against their target plans and `plan/log.md`.
They belong to the following named, already integrated work: manual wire and
junction editing, hierarchy-port rendering, MOS variant corrections, CDAC/RLC
visual prototypes, rule-guided layout documentation, and the Phase 9
Snapshot-driven Agent workflow. Their changes are no longer safely separable
by path because shared files such as `App.tsx`, the Symbol Resolver, SPICE
importer, Edit Engine, and SVG renderer contain dependent changes from several
targets. This one-time integration checkpoint records that coupling explicitly
instead of reconstructing risky partial historical commits.

The new Razavi style specification and its execution plan remain outside this
checkpoint and will be committed separately after the baseline is clean.

## Owned Files

- all currently modified and untracked repository paths listed by the opening
  status, except the Razavi files listed under Read-Only Files
- `plan/2026-08-07-checkpoint-integrated-development/plan.md`
- `plan/log.md`

## Read-Only Files

- `lib/circuit.vss`
- `docs/specs/razavi-textbook-style.md`
- `plan/2026-08-07-razavi-visual-convergence/plan.md`
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`
  (the layout recipe and four exports appeared during validation; ownership is
  concurrent/unknown)
- `.git/` contents except intentional staging and commit metadata

## Shared Dependencies

- Project/Document persistence and hierarchy contracts
- Symbol DSL, built-in catalog, and resolver
- SPICE import and corpus fixtures
- Edit Engine transaction semantics
- editor and formal SVG scene parity
- Agent API schemas, generated OpenAPI artifacts, Skill package, and Phase 9
  evaluation fixtures
- generated PNG/PDF/SVG/project artifacts

## Expected Work

1. Inventory dirty and untracked paths, file sizes, generated assets, and
   likely credential material; reject anything outside the named targets.
2. Run formatting, references, typecheck, unit, build, symbol/golden/API,
   Phase 9, performance/release, and editor end-to-end gates appropriate to
   this cross-subsystem baseline.
3. Record the factual result in `plan/log.md`.
4. Stage every intended integrated path while excluding the two Razavi target
   files, review the staged diff, commit the checkpoint, and push it.
5. Re-audit the remaining worktree; only the Razavi specification target
   should remain before its separate documentation commit.

## Validation

- `pnpm format:check`
- `pnpm references:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm symbols:review:check`
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm agent-api:artifacts:check`
- `pnpm phase9:generalization:check`
- `pnpm phase9:skill:check`
- `pnpm phase9:external-eval:self-test`
- `pnpm phase9:heldout:check`
- `pnpm phase9:heldout:chopper:check`
- `pnpm phase9:heldout:ring:check`
- `pnpm performance:check`
- `pnpm release:verify`
- `pnpm test:e2e`
- `git diff --check`
- staged-path and final-status review

The full gate is justified because the checkpoint crosses all shared runtime,
file-format, generated-artifact, and editor interaction boundaries.

## Experience Signal (for human review)

Several individually planned targets accumulated into one coupled worktree
because they were repeatedly retained without commits. After this checkpoint,
future targets should checkpoint shared-contract work before a dependent
target begins. The human may later decide whether this warrants a reusable
experience note.

## Outcome

- Audited 52 modified tracked paths and 95 untracked paths (about 2.2 MB).
  Every path maps to a named retained target; no unexpected large file,
  credential signature, or `lib/circuit.vss` modification was found.
- Formatting, references, typecheck, 127 unit tests in 33 files, workspace
  build, symbol/visual/export/API generated-artifact checks, all Phase 9
  generalization/Skill/external-self-test/held-out gates, performance, release
  package/smoke, and 14 Playwright editor flows passed.
- The integrated paths are ready for an intentional baseline commit. The
  Razavi specification and execution plan remain excluded for a separate
  commit.
- A new OTA `razavi-layout.mjs` appeared during validation and was updated
  again before staging review; four matching export artifacts then appeared.
  The complete OTA `razavi-*` set was removed from checkpoint scope and left
  untouched for its owner.

## Commit Intent

Commit the integrated baseline as:

```text
Checkpoint integrated editor and Agent workflow
```

Commit the Razavi specification separately after this checkpoint.
