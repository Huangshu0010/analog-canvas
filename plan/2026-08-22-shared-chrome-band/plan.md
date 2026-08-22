---
status: completed
experience: none
---

# One chrome band across the editor and the gallery

## Goal

The two headers were different heights, and inside each one the left and right
sides sat in different bands:

| | editor | gallery |
| --- | --- | --- |
| header | 44px | 62.5px |
| brand block | 22px | 22px |
| button block | 28px | 33.5px |

The gallery header also mixed control heights among itself — the owner badge,
the account buttons, and the primary action each carried their own padding.

## State and Ownership

Start state: clean worktree on `main`. Branch `claude/gallery-header-band`.

Owned paths:

- `apps/editor/src/styles.css`
- `plan/2026-08-22-shared-chrome-band/plan.md`, `plan/log.md`

## Work

1. Give the gallery header the editor's `--icm-menubar-h` height and matching
   horizontal padding, so both headers are one band tall.
2. Put every gallery header control on `--icm-control-h` with centred content,
   including the owner badge, the account links and buttons, the sign-in
   summary, and the primary "New Circuit" action.
3. Give the brand block in both views a `--icm-control-h` minimum, so the left
   and right sides of each header span the same band.

## Validation

- repository typecheck, prettier
- full unit suite; full Playwright suite
- header, brand, and button geometry measured in both views

## Gate Review

- Decision: affected — presentation only, no behavior change.
- Early gates: prettier, unit suite.
- Affected gates: the browser specs that measure editor chrome geometry.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: none.

## Test Impact

- Decision: no-test-change
- Reason: no assertion pins the header or control heights; the browser specs
  locate chrome by role and test id, and the narrow-breakpoint spec that does
  measure geometry only asserts the right-hand chrome stays inside the
  viewport, which this change preserves (verified by a full suite run).

## Commit Intent

```text
style(editor): put both headers on one chrome band
```

## Outcome

Both headers are now 44px tall with every group — brand, menubar, and buttons
— spanning the same 28px band. Measured after the change: editor brand,
menubar, and actions all 28px at y 8–36; gallery brand, actions, and primary
button all 28px at y 7.5–35.5.

Validation: typecheck, 182 unit files / 1148 tests, full Playwright suite (186
passed; the recurring `component-insert.spec.ts:376` timing flake passed on
its isolated re-run), prettier, and diff checks.
