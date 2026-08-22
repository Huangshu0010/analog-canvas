---
status: completed
experience: none
---

# Named + / − input swap and one brand across both views

## Goal

1. The op amp and comparator need an explicit way to reverse their `+` and `−`
   inputs. The capability already exists (a top/bottom reflection moves the
   marks and their terminals together) but nothing names it, so it is not
   discoverable.
2. The editor and the gallery drew the same brand two different ways — a
   different heading size, a different subtitle treatment, and a click target
   that existed on one side only. They should read as one product in two
   views.

## State and Ownership

Start state: clean worktree on `main`. Branch
`claude/differential-input-swap`.

Owned paths:

- `packages/derived/src/instance-label-placement.ts` and its test
- `apps/editor/src/app/App.tsx`
- `apps/editor/src/components/gallery-feed.tsx`
- `apps/editor/src/styles.css`
- `plan/2026-08-22-differential-input-swap/plan.md`, `plan/log.md`

## Work

1. Add `hasDifferentialInputs(resolved)` to the derived projections: true when
   a Symbol carries both a `non-inverting-input` and an `inverting-input` pin.
   It is role-driven, so any future differential Symbol gets the action for
   free.
2. Offer "Swap + / − inputs" in the instance properties for those Symbols. It
   issues the same top/bottom reflection as `Ctrl+R`, so the marks and the
   terminals stay in agreement — no presentation-only polarity lie.
3. Give the gallery the editor's brand markup and classes, so one rule set
   styles both: mark plus "Analog Canvas" wordmark as the link to the other
   view, subtitle underneath (project/document in the editor, "Community
   gallery" in the gallery). Scope the editor's truncation to the editor
   chrome, which is the only place the brand competes for width.

## Validation

- repository typecheck, prettier
- `packages/derived/src/instance-label-placement.test.ts`
- full unit suite; full Playwright suite
- the swap exercised on a placed op amp in a running editor, and both brands
  compared side by side

## Gate Review

- Decision: affected — one derived projection plus editor presentation.
- Early gates: prettier, the derived unit test.
- Affected gates: full unit suite, gallery and editor browser specs.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: none; no generated artifact or persisted contract changes.

## Test Impact

- Decision: tests-updated
- Contracts: differential-input detection by pin role; brand presentation
  shared by both views.
- Primary checks: `packages/derived/src/instance-label-placement.test.ts`

## Commit Intent

```text
feat(editor): name the + / - input swap and unify the brand
```

## Outcome

The op amp and comparator now carry a "Swap + / − inputs" action in their
properties; pressing it reflects the instance top-to-bottom, which moves the
polarity marks and their terminals together (verified live: the `+` mark
crossed to the top while the triangle kept pointing right). The gallery brand
now uses the editor's markup, typography, and hover treatment, links to the
editor, and shows "Community gallery" as its subtitle; the editor's brand
links to the gallery and shows the project and document.

Validation: typecheck, 180 unit files / 1133 tests, 187 Playwright tests,
prettier, and diff checks.
