---
status: completed
experience: none
---

# Connectivity recovery C7a — recursive hierarchy Net trace

## Goal

Add a pure bidirectional hierarchy Net trace graph over the C4 connectivity
index. Preserve the legacy one-hop `traceNet()` API while exposing all reached
document/Nets and instance-specific traversal hops for later editor highlighting.

## State and ownership

Clean branch after C6a. This target owns derived net-highlight code/tests, plan
and log. Locator/navigation UI, selection overlay and hierarchy frame-stack
restore are explicitly excluded.

## Validation

Focused trace/index tests, workspace typecheck, Prettier and `git diff --check`.

## Outcome

Added `traceHierarchyNet()` as a pure bidirectional graph traversal over the
connectivity index. It reports every reached logical document/Net plus concrete
parent-instance/child-port hops and stops cycles by visited document/Net pair.
The original one-hop downward `traceNet()` API is unchanged. Editor overlays and
hierarchy-path navigation remain future consumers.

Validation: workspace typecheck; 15 focused trace/index tests; targeted
Prettier and `git diff --check`.
