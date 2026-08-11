---
status: completed
experience: candidate
---

# Correct Closed-Switch PDF Evidence

## Goal

Replace the incorrectly self-rendered closed-switch witness and horizontal-line
proxy with the exact Figure 13.5 S2 artwork on printed page 542: two hollow
contacts and the native angled blade shown in the approved source crop.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree is clean. This corrective target owns the closed-switch extractor,
evidence/witness/measurement/authority data, its generated Symbol/catalog
outputs, focused tests, and plan/log records.

- `tools/pdf-vector-extract/extract-razavi-common-assets.py`
- `fixtures/visual-reference/razavi-reference-v1/{closed-switch-*,common-symbol-geometry.json,fidelity-targets.json,manifest.json}`
- `packages/symbols/assets/razavi-v1/{closed-switch.symbol.json,catalog.json}`
- `packages/symbols/src/{razavi-catalog.generated.ts,razavi-catalog.test.ts}`
- `plan/2026-08-11-correct-closed-switch-pdf-crop/plan.md`
- `plan/log.md`

Read-only: the approved Razavi PDF, user-provided S2 crop, the open-switch
asset, and the visual-contract specifications. Existing open switch remains
unchanged.

## Work

1. Locate the exact Figure 13.5 S2 native line/curve objects using source text
   position and rendered crop, rather than inferring a contact state from a
   nearby wire.
2. Preserve the source blade angle, contact geometry, and line ordering in the
   normalized Symbol; use semantic pin extensions only outside source artwork.
3. Store a source-cropped PNG witness rather than a candidate-generated witness
   and register its fixed crop/origin in the authority protocol.
4. Regenerate assets and require visual diff inspection in addition to numeric
   fidelity results.

## Validation

- source PDF crop and native-object fingerprint checks
- comparison reference is a source-PDF crop, not generated artwork
- `node scripts/razavi-fidelity-diff.mjs closed-switch`
- common/catalog stale checks, symbols build, and focused authority/catalog tests
- enlarged render and spatial diff inspection
- `git diff --check` and `git status --short --branch`

## Commit Intent

Commit as:

```text
fix(symbols): correct Razavi closed switch evidence
```

## Outcome

Corrected the prior false baseline. The extractor now selects the five native
Figure 13.5 S2 objects (two horizontal lead segments, two hollow contact
outlines, and one angled blade) and creates a fixed 96x48 direct-PDF crop as
the witness. The source crop is aligned to the measured contact midpoint and
excludes the surrounding feedback loop. The Symbol preserves the native blade
and lead coordinates, adding only short outer pin extensions to `(-30, 0)` and
`(30, 0)`. The common geometry registry now carries witness-owned windows, so
the fidelity runner crops the same source region. Catalog/authority tests and
generators passed; source-crop fidelity is IoU 0.9854 with anti-alias-only
residuals, and enlarged reference/render/diff inspection confirms the S2
silhouette.
