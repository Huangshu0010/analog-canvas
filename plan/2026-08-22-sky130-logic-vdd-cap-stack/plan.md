---
status: completed
experience: none
---

# Stack SKY130, Razavi Logic Gates, VDD, and Capacitor Work

## Goal

Integrate the completed SKY130 external-MOS presentation, Razavi logic-gate
alignment, VDD rail/port presentation, and capacitor terminal work on top of
the latest `origin/main`, preserving each feature's established semantics and
delivering the combined result as one review PR.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/sky130-logic-vdd-cap-stack...origin/main
```

The new integration worktree is clean. The source branches and the root local
`main` are read-only inputs; their worktrees remain untouched.

Owned paths are the union of paths changed by:

- `887c7ccd`, `24b80a49`, and `9a396e6e` from local `main`;
- `a326029b` and `c45b7b1a` from `codex/razavi-logic-gate-alignment`;
- `8d792197` from `codex/sky130-external-mos-presentation`;
- `plan/2026-08-22-sky130-logic-vdd-cap-stack/plan.md` and `plan/log.md`.

Read-only sources:

- `E:/interactive Circuit maker` local `main` worktree;
- `.worktrees/razavi-logic-gates`;
- `.worktrees/sky130-external-mos-presentation`.

Shared contracts requiring explicit review are editor insertion/properties UI,
manual/component-insert E2E coverage, generated MCP resources, SPICE compiler
tests, and the factual plan log. The integration must preserve these boundaries:

- VDD rail/port placement creates or reuses the named VDD power-domain net
  without changing ordinary MOS bulk behavior or silently globalizing local
  nets;
- SKY130 NMOS/PMOS instances remain external `X` subcircuit calls with explicit
  `D/G/S/B` terminals while borrowing canonical MOS artwork only;
- capacitor `P/N` plate semantics remain descriptor-owned metadata surfaced by
  the Properties panel;
- logic-gate changes remain symbol/catalog presentation work, not a new device,
  PDK, or connectivity protocol.

## Work

1. Cherry-pick the three local-main commits in dependency order.
2. Cherry-pick the two logic-gate commits and preserve generated catalog/resource
   consistency.
3. Cherry-pick the SKY130 commit, resolving only real shared-file conflicts
   against the newer editor and SPICE contracts.
4. Review the aggregate diff for accidental protocol coupling or lost feature
   behavior, then make only bounded integration repairs if tests expose them.
5. Record the factual outcome, commit, push, open one PR, and wait for required
   checks. Supersede the older SKY130 PR only after the combined PR exists.

## Validation

- Focused unit tests changed by the six source commits.
- `pnpm test:e2e:local apps/editor/e2e/component-insert.spec.ts apps/editor/e2e/manual-editor.spec.ts`
- Generated-artifact and Razavi fidelity checks selected by the source plans.
- `pnpm gate:plan -- --base origin/main`
- `pnpm gate:preflight -- --base origin/main`
- `pnpm gate:affected -- --base origin/main`
- `pnpm test:impact -- --base origin/main`
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`
- Required GitHub Actions checks on the review branch.

## Gate Review

- Decision: full
- Rationale: the aggregate diff changes the root gate contract and includes
  unclassified visual-reference assets and calibration/extraction tools, so the
  real-diff advisory plan requires the full fallback even though each source
  target had already passed focused validation.
- Early gates: advisory planning selected static contracts, test-impact,
  workspace unit tests, hierarchy browser coverage, and editor browser coverage.
- Affected gates: editor component insertion/properties, symbol catalogs,
  device terminal metadata, SPICE export, hierarchy planning, and generated MCP
  resources.
- Final gates: clean frozen install plus `pnpm ci:check`, followed by required
  remote checks because this is a non-document mainline candidate.
- Platform risks: generated catalog/resource drift, Linux path/case behavior,
  browser interaction composition, and stale golden/reference assets.

## Test Impact

- Decision: tests-updated
- Rationale: the source feature commits carry their unit and browser
  regressions; integration corrected the SKY130 browser route to the current
  `/editor` entry after the combined run exposed the stale root route.
- Contracts: VDD named-net behavior, explicit SKY130 external MOS binding and
  presentation, capacitor plate metadata/properties, and Razavi logic symbol
  catalog/fidelity.
- Primary checks: the affected unit and browser tests carried by the source
  commits plus repository gate selection from the aggregate diff.

## Commit Intent

Retain the six feature commits as reviewable stack entries and commit only
integration bookkeeping or necessary conflict repairs as:

```text
chore(integration): stack schematic presentation work
```

## Outcome

Stacked the three local-main VDD/capacitor commits, the two Razavi logic-gate
commits, and the SKY130 external-MOS commit onto `a33a01e8` without changing
their domain contracts. The only required integration repair updated the
SKY130 browser scenario from the now-gallery root route to `/editor`; all code
conflicts were limited to preserving the union of factual `plan/log.md`
entries.

Validation passed: Razavi generator/catalog drift checks; 16 focused unit
files / 177 tests; affected browser gates (22 component-insert, 11 hierarchy,
1 Agent, and 92 manual-editor tests); branch verification (179 files / 1120
tests, builds, production smoke); frozen install and canonical `pnpm ci:check`
(1120 tests, release/golden/smoke checks, and 185 browser tests). PR #159 was
created and all six GitHub Actions checks passed on integration commit
`86a52d5a`; the narrower SKY130 draft PR #141 was closed as superseded.
