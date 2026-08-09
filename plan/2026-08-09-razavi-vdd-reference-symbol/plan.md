# Razavi VDD reference symbol

## Goal

Archive the supplied VDD screenshot within the sole Razavi authority and add a
reviewed screenshot-derived VDD power-port asset to the Razavi palette.

## Dirty-state decision

The staged documentation renames and `plan/log.md` update are owned by another
target. They do not overlap this asset/catalog target and will not be modified,
staged, or committed. Existing untracked layout artifacts and plans remain out
of scope.

## Ownership

- `fixtures/visual-reference/razavi-reference-v1/vdd-reference.png`
- VDD geometry and authority-manifest registration
- `packages/symbols/assets/razavi-v1/vdd.symbol.json` and catalog metadata
- generated Razavi catalog artifacts and focused catalog tests
- `plan/2026-08-09-razavi-vdd-reference-symbol/plan.md`

## Validation

Archive/hash verification, catalog generation, Symbols build, focused palette
test, and GUI availability check.

## Commit intent

One asset/catalog-only commit, excluding the concurrent documentation target.
