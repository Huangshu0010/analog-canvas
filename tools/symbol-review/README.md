# Symbol Review

This deterministic contact-sheet tool renders two normalized Symbol DSL
catalogs: the human-reviewed `circuit.vss` mappings and a separate set of
geometry-migrated candidates whose provisional pins still require review. It
does not render raw Visio artwork and does not assign electrical pins.

```powershell
pnpm symbols:review
pnpm symbols:review:check
```

Reviewers compare the contact sheet with the VSS inventory, then approve pin
semantics in `fixtures/symbols/circuit-vss-review.json`. The generated files
are `phase-5-symbol-review.svg` and `vss-migration-candidates.svg`; the latter
must retain `data-pin-status="review-required"` until review is recorded.
