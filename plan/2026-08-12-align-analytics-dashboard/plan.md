---
status: completed
experience: none
---

# Align Analytics Dashboard with Analog Arena

## Goal

Make the Analog Canvas `/analytics` page match the existing Analog Arena analytics page exactly, except for the Analog Canvas document title and the link back to the editor.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. This target owns:

- `apps/editor/src/components/analytics-page.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/index.html`
- `apps/editor/package.json`
- `apps/editor/e2e/manual-editor.spec.ts`
- `pnpm-lock.yaml`
- `plan/2026-08-12-align-analytics-dashboard/plan.md`
- `plan/log.md`

Read-only references and shared dependencies:

- `/Users/tokenzhang/Documents/analog-arena/site/src/components/AnalyticsPage.tsx`
- `/Users/tokenzhang/Documents/analog-arena/site/src/index.css`
- `apps/editor/src/lib/world-map.ts`
- `apps/editor/src/data/land-110m.json`
- `/api/analytics` response contract

## Work

1. Port the Analog Arena analytics component without redesigning it.
2. Port the Analog Arena analytics styles without redesigning them.
3. Adapt only the site title, editor return link, local module names, export shape, and analytics-page body isolation.
4. Update the analytics route regression coverage for the copied controls and behavior.

## Validation

- Focused editor unit/type/build and analytics Playwright checks during development.
- `pnpm install --frozen-lockfile`
- `pnpm ci:check`
- GitHub Actions required checks on the review branch.
- Production verification at `https://analog-canvas.tokenzhang.com/analytics` after merge and deployment.
- `git diff --check`
- `git status --short --branch`

The full mainline gate is required because this is a production UI change delivered to `main`.

## Commit Intent

Commit as:

```text
fix(editor): match analytics dashboard to Analog Arena
```

## Outcome

Ported the Analog Arena analytics dashboard component and styles to Analog
Canvas, with only the document title, return-to-editor link, local module/export
adaptation, and editor body isolation changed. Added the matching theme preload
and mono font, plus browser coverage for date controls, theme switching, and
breakdown expansion.

Post-deployment computed-style comparison found that the editor's global CSS
still overrode Arena's reset for subtitle spacing, zero-width border style, and
native date/button appearance. The target was reopened to isolate those reset
differences inside `.analytics-shell`; the shared geometry now matches Arena's
computed layout exactly in Chromium for the compared page sections and controls.

Focused typecheck, editor build, and analytics Playwright passed. The canonical
install and static/unit/release gates passed locally. Local E2E passed 72/74,
with the two pre-existing drafting rich-text `span` assertions failing; all five
GitHub Actions PR checks, including both browser shards, passed.
