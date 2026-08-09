# Razavi Capacitor Reference Archive

## Goal

Archive the user-supplied Razavi capacitor screenshot within the sole
`razavi-reference-v1` visual authority and replace the incorrect statement
that the reference contains no capacitor.

## Dirty-State Decision

`packages/model/src/schema.ts`, `packages/render-svg/src/render.ts`,
`packages/render-svg/src/rich-text.ts`, and
`packages/render-svg/src/schematic-text.ts`, plus untracked plans/layout
artifacts, belong to concurrent targets. This archive target owns only
visual-reference and documentation/plan paths and will not touch them.

## Owned Files

- `fixtures/visual-reference/razavi-reference-v1/capacitor-reference.png`
- `fixtures/visual-reference/razavi-reference-v1/capacitor-geometry.json`
- `fixtures/visual-reference/razavi-reference-v1/manifest.json`
- `docs/specs/razavi-textbook-style.md`
- this plan and `plan/log.md`

## Read-only Dependencies

- `C:\Users\90590\AppData\Local\Temp\codex-clipboard-01761f6a-6781-4659-808b-32b2b79bd946.png`
  (user-supplied source image)
- `fixtures/visual-reference/razavi-reference-v1/razavi-six-panel.png`

## Expected Work

1. Copy the source PNG byte-for-byte into the existing sole authority folder.
2. Record hash-pinned C1 vertical and C2 horizontal evidence coordinates.
3. Update the authority manifest and style contract to allow capacitor
   calibration from this image in a later bounded target; do not alter the
   capacitor asset here.

## Validation

Verify SHA-256 manifest entries, image dimensions, JSON syntax, `git diff
--check`, and final status.

## Commit Intent

`docs(razavi): archive capacitor reference evidence`

## Result

Archived the exact user-supplied 279 by 279 PNG as
`capacitor-reference.png`, hash-pinned it in the existing sole-authority
manifest, and recorded C1 vertical plus C2 horizontal crop anchors. The style
contract now correctly states that the authority includes capacitor evidence.
No capacitor runtime asset was changed.

Validation: manifest/image/geometry SHA-256 relationships verified, both
evidence IDs found, JSON parsed, and `git diff --check` passed.
