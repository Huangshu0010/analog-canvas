---
status: completed
experience: none
---

# Visual golden refresh and drift gate

## Goal

`node scripts/visual-golden.mjs --check` fails on current `main`:
`fixtures/visual-golden/phase-3-crossing.svg` and
`fixtures/visual-golden/phase-5-dense-analog.svg` no longer match a fresh
render. Verify that every delta traces to an accepted rendering or fixture
change already merged to `main`, regenerate the goldens deliberately, and add
`visual:golden` drift checking to a CI gate so these goldens cannot drift
silently again (today no `ci:*` or release script runs it).

## State and Ownership

Start state from `git status --short --branch`:

```text
## claude/peaceful-poitras-f8ccde
```

Worktree is clean, at `main` (48ed7f88 == origin/main). Owned paths:

- `fixtures/visual-golden/phase-3-crossing.svg`
- `fixtures/visual-golden/phase-5-dense-analog.svg`
- `package.json` (gate wiring for the visual golden check)
- `config/validation-gates.json` (classify `scripts/visual-golden.mjs` in the
  release path group, beside `scripts/export-golden.mjs`)
- `plan/2026-08-21-visual-golden-refresh-gate/plan.md`, `plan/log.md`

Base moved during the target: PR #144 (`claude/junction-dot-collinear-arms`,
`fix(derived): ignore collinear route arms in junction dots`) merged into
`origin/main` mid-work. The branch fast-forwarded 48ed7f88 → d8a813a8,
`@icm/derived` was rebuilt, and the goldens were regenerated from the new
head so they capture the collinear-arm dot rule (the phase-5 contact dot at
230,290 is legitimately gone under that rule).

Read-only: `scripts/visual-golden.mjs`, `packages/render-svg/src`,
`fixtures/projects/phase-3-routing`, `fixtures/projects/phase-5-dense-analog`,
`.github/workflows/*`.
Shared: the visual goldens are golden-state contracts; the in-flight branch
`claude/junction-dot-collinear-arms` (checked out in the primary checkout)
touches `packages/derived/src/contact.ts` and export goldens but not
`fixtures/visual-golden/*` — no path overlap with this target, safe to
proceed. The fresh render must be built from `main` sources only (not the
junction-dot branch), so builds run inside this worktree.

## Work

1. Build `@icm/model → devices → symbols → project-protocol → derived →
   render-svg` in the worktree with `node_modules/.bin/tsc` per package
   (pnpm is not installed on this machine; `node_modules` is borrowed from
   the primary checkout via symlinks, with per-package `node_modules`
   entries pointing workspace deps at this worktree's packages so the
   junction-dot branch cannot contaminate the render).
2. Run `node scripts/visual-golden.mjs --check` to reproduce the failure,
   then regenerate and diff each golden against the committed version.
3. Trace every delta to an accepted `main` change (expected: the port
   first-class-endpoint revert 645c0483 left a stale empty
   `data-layer="ports"` group and stale port label/symbol output; later
   port-lifecycle work — 92bb97e7, 65580820, dff2568c, 85cf56ec, 3c76aabe —
   changed rendering and the phase-3/phase-5 input fixtures without
   regenerating goldens). Any delta not traceable to an accepted change
   blocks regeneration.
4. Commit the regenerated goldens only after step 3 passes.
5. Gate decision: wire `node scripts/visual-golden.mjs --check` into
   `release:verify:built` (runs post-build inside both `pnpm ci:check` and
   `ci:release`), after reviewing `docs/testing/README.md` and the release
   checklist. `ci:static` is deliberately build-free, so it is the wrong
   host for a check that needs built `dist/`.

## Validation

- `git diff --check`
- `git status --short --branch`
- `node scripts/visual-golden.mjs --check` (after regeneration, from built
  worktree dists)
- `node_modules/.bin/prettier --check package.json` plus the repo
  `format:check` glob for touched files
- `node scripts/check-markdown-links.mjs` if docs change
- `node scripts/check-test-impact.mjs -- --base origin/main` equivalent
  (`node scripts/check-test-impact.mjs --base origin/main`)

## Gate Review

- Decision: affected, with the mainline gate delegated to remote CI.
- Early gates: prettier on touched files, visual golden `--check`.
- Affected gates: `visual:golden:check` (the contract this target changes),
  markdown-link check for doc touches.
- Final gates: `pnpm install --frozen-lockfile && pnpm ci:check` cannot run
  locally — pnpm is not installed on this machine. Limitation recorded per
  AGENTS.md; delivery relies on the remote GitHub Actions required checks
  being green on the PR before merge.
- Platform risks: goldens are byte-exact SVG text; rendering is pure
  string-building (no font rasterization), so no platform variance is
  expected. Gate wiring in `package.json` changes `release:verify:built`
  behavior for CI release verification.

## Test Impact

- Decision: tests-updated
- Contracts: visual golden byte-exactness for phase-3 crossing and phase-5
  dense analog renders (`scripts/visual-golden.mjs --check`), newly enforced
  in `release:verify:built`.
- Primary checks: `node scripts/visual-golden.mjs --check`

## Commit Intent

Commit as:

```text
test(render): refresh stale visual goldens and gate drift

fixtures/visual-golden/{phase-3-crossing,phase-5-dense-analog}.svg had
drifted from the renderer since the port-endpoint revert (645c0483) and
later port-lifecycle work; every delta traces to accepted main changes.
Add visual-golden --check to release:verify:built so ci:check and
ci:release fail on future drift.
```

## Outcome

Both stale goldens verified delta-by-delta against a fresh render built from
`main` sources inside this worktree (per-package `tsc` builds; workspace deps
symlinked to worktree packages so the primary checkout's branch could not
contaminate the render):

- phase-3 (last written by revert 645c0483): the two deltas — the stale empty
  `<g data-layer="ports">` group and the five in-symbol-group port name
  `<text>` elements (A–E) — both trace to 9a552d32
  `refactor(circuit): remove legacy contract routing`, which removed legacy
  `document.ports` origin rendering and derived label-placement instance-id
  text.
- phase-5 (last written at 31339f29): 9a552d32 also replaced the input
  project wholesale (Original → Current Differential Stage,
  textbook-monochrome-v1 → razavi-textbook-v1); remaining markup deltas trace
  to the bound-display/rich-text unification stack (a923af21, db43457b,
  92bb97e7), canonical route geometry and contact presentation (0b425c8a and
  related), and the collinear-arm junction dot rule (7c42a1a7, PR #144).

No unexplained delta remained; goldens regenerated deliberately from
d8a813a8 and `node scripts/visual-golden.mjs --check` passes. Gate decision:
`node scripts/visual-golden.mjs --check` added to `release:verify:built`
(post-build, beside the export golden check), which enforces it in
`pnpm ci:check`, `pnpm ci:release`, and the CI Release contracts job;
`scripts/visual-golden.mjs` classified in the gate catalog's release group.
`ci:static` was rejected as host because it is deliberately build-free.
Local limitation: pnpm unavailable on this machine, so the canonical
`pnpm install --frozen-lockfile && pnpm ci:check` is delegated to the remote
required checks on the PR.
