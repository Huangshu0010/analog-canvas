---
status: completed
experience: none
---

# Connectivity recovery C4 — complete document connectivity index

## Goal

Complete the usable document portion of ADR 0013: materialise the C3 route
geometry map, derive flightlines once per Document build, and cache a document
index only while the same document revision and SymbolResolver are used.

## State and ownership

The worktree is clean after C3. This target owns connectivity-index code/tests,
its target plan and log. C3 geometry is a read-only dependency. Project-level
revision semantics and hierarchy navigation are intentionally not introduced;
the model has no independent project revision.

## Work

1. Add route geometry to `DocumentConnectivityIndex` from the document-level
   C3 resolver.
2. Precompute and group normalized flightlines before individual Net records
   are built.
3. Use a non-persisted WeakMap cache keyed by document object, revision and
   resolver identity; expose no mutable cache state to consumers.

## Validation

Focused connectivity-index/deletion-parity tests including cache invalidation;
workspace typecheck, Prettier and `git diff --check`.

## Outcome

`DocumentConnectivityIndex` now exposes C3 `routeGeometry`, precomputes
normalized flightlines once per Document build, and uses a derived-only WeakMap
cache guarded by document revision and resolver identity. The cache stores no
project data and the project index remains a fresh immutable wrapper, so there
is no persisted cache or invented project revision.

Validation: workspace typecheck; 18 focused connectivity-index/deletion-parity
tests, including route-geometry exposure and revision invalidation; targeted
Prettier and `git diff --check`.
