---
status: completed
experience: none
---

# Show origins map above daily traffic

## Goal

Put the analytics Origins map above the Daily traffic chart so the dashboard
matches the sibling Analog Arena / tokenzhang.com layout. The countries heading
is already `ISO 3166 Code` and stays unchanged.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This target owns:

- `apps/editor/src/components/analytics-page.tsx`
- `plan/2026-08-13-analytics-map-above-traffic/plan.md`
- `plan/log.md`

- Read-only: `apps/editor/e2e/manual-editor.spec.ts` (heading presence already
  asserted; no order contract exists)
- Shared: none. Markup order only; analytics API and breakdown tables are
  untouched.

## Work

1. Move the Origins / world-heatmap section above the Daily traffic section.
2. Leave the `ISO 3166 Code` heading and all other dashboard sections in place.
3. Record the factual log and close the plan.

## Validation

- `git diff --check`
- `git status --short --branch`
- Confirm the JSX source order is map, then daily traffic, then breakdowns.

No new test: the existing analytics e2e still covers heading presence and
behavior. A full suite is not justified for a section reorder.

## Commit Intent

Commit as:

```text
feat(analytics): show origins map above daily traffic
```

## Outcome

Moved the Origins heatmap above Daily traffic in `analytics-page.tsx`. The
countries heading was already `ISO 3166 Code` and was left unchanged.
`git diff --check` is clean. Existing analytics e2e heading checks remain
valid; no new test was added for markup order.
