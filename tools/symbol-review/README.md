# Symbol Review

This deterministic contact-sheet tool renders the normalized built-in Symbol
DSL that corresponds to reviewed `circuit.vss` masters. It does not render raw
Visio artwork and does not assign electrical pins.

```powershell
pnpm symbols:review
pnpm symbols:review:check
```

Reviewers compare the contact sheet with the VSS inventory, then approve pin
semantics in `fixtures/symbols/circuit-vss-review.json`.
