---
status: completed
experience: none
---

# Razavi RV-4 Schematic Typography

## Goal

Implement deterministic `schematic-math` parsing and SVG text-run composition
for the Razavi profile while preserving human-readable persisted strings and
byte-identical legacy output. Centralize typography tokens and keep instance,
pin, and annotation text upright outside component transforms.

## Dirty-State Note

Start state: `main` at pushed RV-3 commit `803031a`; only the five untracked,
user-confirmed parallel OTA `razavi-*` files remain. They are outside this
target and do not overlap renderer typography, tests, specifications, or
goldens.

## Owned Files

- `plan/2026-08-07-razavi-rv4-schematic-typography/plan.md`
- `packages/render-svg/src/schematic-text.ts`
- `packages/render-svg/src/schematic-text.test.ts`
- `packages/render-svg/src/style-profile.ts`
- `packages/render-svg/src/style-profile.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/render.test.ts`
- `packages/render-svg/src/index.ts`
- `docs/specs/visual-language.md`
- `docs/specs/razavi-textbook-style.md`
- `plan/log.md`
- visual/export goldens only if explicitly intended (legacy changes are not
  expected)

## Read-Only Files

- persisted model schemas and Project fixtures
- Symbol catalog and VSS evidence
- editor interaction code
- `netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt/razavi-*`

## Shared Dependencies

- annotation kinds and human-readable `text` persistence
- formal renderer/editor/export scene parity
- instance transform and explicit-label suppression
- existing Phase 1/5/7 byte goldens

## Expected Work

1. Expand profile typography to the agreed font, weight, size, subscript,
   gap, and line-height tokens.
2. Parse explicit underscore, instance designator, and recognized V/I labels
   without mutating persisted text; leave notes/captions implicit-math free.
3. Render deterministic base/subscript `<tspan>` runs for Razavi only, with
   escaping, size scaling, and downward baseline shift.
4. Apply semantic sizes to default/explicit instance, Net, power, current,
   voltage, pin, plain, and caption labels.
5. Keep text outside component rotation/mirror transforms and retain legacy
   output byte-for-byte.
6. Add parser tables, escaping, semantic-kind, upright-text, unknown/edge-case,
   renderer, and export-compatibility tests.

## Validation

- focused schematic-text/style/renderer tests
- `pnpm visual:phase5:check`
- `pnpm export:phase7:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm format:check`
- `git diff --check`
- `git status --short --branch`

The change affects every formal text consumer, so parser-level tests and
legacy byte goldens are both required.

## Experience Signal (for human review)

None identified. This target implements the previously frozen RV-4 contract
without changing the workflow or exposing a repeated failure pattern.

## Outcome

- Added profile-owned typography tokens for both compatibility and Razavi
  rendering.
- Added deterministic schematic-math parsing and escaped SVG base, subscript,
  and upright suffix runs without changing persisted strings.
- Applied semantic text sizes to instance, pin, Net, power, current, voltage,
  plain, and caption text. Instance and pin text remains outside component
  transforms.
- Preserved byte-identical Phase 1/5 and Phase 7 compatibility goldens.
- Validation passed: 23 focused tests, 149 full tests in 36 files,
  `pnpm visual:phase5:check`, `pnpm export:phase7:check`, typecheck, build,
  formatting, and `git diff --check`.
- The concurrent OTA `razavi-*` files remained untracked and untouched.

## Commit Intent

Commit as:

```text
feat(render): add Razavi schematic typography
```
