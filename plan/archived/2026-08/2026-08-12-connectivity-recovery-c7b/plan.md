---
status: completed
experience: none
---

# Connectivity recovery C7b — current-document Net highlight

## Goal

Expose a non-mutating overlay for a current-document Net using C4's canonical
index, callable from a selected route or a Net search result.

## State and ownership

The branch was clean after C6b. This target owns App overlay/state, styles,
focused E2E test, plan and log. Cross-Cell rendering and hierarchy-path-aware
selection remain explicitly out of scope.

## Outcome

Added an overlay that paints indexed route and junction membership and keeps
imported flightline filtering coherent with the highlighted Net. Search results
for Nets now enter this state; a selected route has an explicit Highlight Net
action. The overlay is SVG/UI-only and never changes project revision.

Validation: workspace typecheck; two focused Playwright search/highlight flows;
targeted Prettier and `git diff --check`.
