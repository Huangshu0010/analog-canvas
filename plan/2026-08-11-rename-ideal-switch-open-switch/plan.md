---
status: completed
experience: none
---

# Rename ideal switch palette label

## Goal

Present the existing `ideal-switch` symbol as **Open Switch** in the catalog
and component palette without changing its stable ID, aliases, geometry, or
electrical pins.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

The worktree is clean. This target owns the common source definition,
regenerated ideal-switch evidence/catalog artefacts, focused catalog test, and
plan/log entries.

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{ideal-switch-vector-source.json,manifest.json}`
- `packages/symbols/assets/razavi-v1/{catalog.json,ideal-switch.symbol.json}`
- `packages/symbols/src/{razavi-catalog.generated.ts,razavi-catalog.test.ts}`
- `plan/2026-08-11-rename-ideal-switch-open-switch/plan.md`
- `plan/log.md`

Read-only: `ideal-switch` persistence ID, aliases, pin contract, source PDF,
and editor grouping rule.

## Work

1. Change the user-facing name to `Open Switch` at the common source.
2. Regenerate hash-pinned evidence and catalog artefacts.
3. Assert the stable ID and new displayed name together.

## Validation

- Python compile, common/catalog stale checks, symbols build, focused tests
- `git diff --check` and status check

## Commit Intent

```text
fix(symbols): rename ideal switch as open switch
```

## Outcome

- Changed the source-owned display name from `Ideal Switch` to `Open Switch`.
  The stable symbol ID remains `ideal-switch`, so persisted Projects, aliases,
  pin contracts, and the existing Switches palette group remain compatible.
- Regenerated the pinned evidence/catalog output and added a catalog assertion
  pairing the stable ID with the displayed name.
- Python compile, common/catalog stale checks, symbols build, 23 focused tests,
  and `git diff --check` pass.
