---
status: completed
experience: none
---

# Correct Razavi switch lead and contact geometry

## Goal

Align closed-switch external leads with their two on-grid pin/wire axes, and
clip the ideal-switch blade at the exterior of its hollow pivot contact.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/contextual-properties-net-labels...origin/codex/contextual-properties-net-labels
```

At target start the worktree was clean. Concurrent work has since created
unrelated changes in `apps/editor/src/app/App.tsx`, `apps/editor/src/styles.css`,
and `plan/2026-08-11-compact-properties-mirror-actions/`; they do not overlap
the owned switch assets or their generator. This target will neither stage nor
modify those paths. This target owns only the common switch generation, derived
evidence/assets/catalog, focused assertions, and plan/log entries.

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{closed-switch,ideal-switch}-*`
- `fixtures/visual-reference/razavi-reference-v1/{common-symbol-geometry.json,manifest.json}`
- `packages/symbols/assets/razavi-v1/{catalog.json,closed-switch.symbol.json,ideal-switch.symbol.json}`
- `packages/symbols/src/{razavi-catalog.generated.ts,razavi-catalog.test.ts}`
- `plan/2026-08-11-correct-switch-lead-contact-geometry/plan.md`
- `plan/log.md`

Read-only: the approved Razavi PDF and Symbol DSL pin contract. Pins remain at
`(-30, 0)` and `(30, 0)` for both switches.

## Work

1. Replace closed-switch source-lead micro-offsets with axis-aligned pin to
   contact-boundary segments.
2. Calculate the ideal-switch blade/contact-circle intersection and place the
   blade start outside the hollow contact ink boundary.
3. Regenerate pinned evidence/catalog assets and add regression assertions.

## Validation

- Python compilation, common/catalog stale checks, and symbols build
- focused catalog/authority tests and switch fidelity reports
- `git diff --check` and `git status --short --branch`

## Commit Intent

```text
fix(symbols): align Razavi switch leads and contacts
```

## Outcome

- Normalized both closed-switch external lead segments to the pin/contact axis
  (`y=0`), replacing the 0.103766-unit PDF residue that produced an uneven
  wire join.
- Clipped the ideal-switch blade from the PDF's interior pivot start to the
  left contact's exterior ink boundary (`radius + normalStroke/2`), leaving
  the hollow centre unobstructed while retaining both pin anchors.
- Regenerated the source evidence, manifest hashes, symbol assets and runtime
  catalog. The focused switch assertions cover axial leads and the blade's
  minimum contact clearance.
- Python compile, stale checks, symbols build, 23 focused tests, direct-PDF
  diffs, and `git diff --check` pass.
