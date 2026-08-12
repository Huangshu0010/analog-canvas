# Connectivity recovery status

Status: `completed`

This is the factual implementation status following the recovery commits on
`roadmap/connectivity-routing-debugging`. It supplements, rather than rewrites,
the roadmap's original recovery audit.

| Area                    | Verified status                                                                                                                                     | Remaining gate                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior/contracts      | Completed; characterization and ADR/spec contracts are in place.                                                                                    | Preserve parity tests while migrating consumers.                                                                                       |
| Connectivity index      | Core completed; revision cache, resolved geometry and single-pass flightlines now drive editor flightlines, search, trace and ERC.                  | Retain old helpers until all lower-level consumers migrate.                                                                            |
| Resolved route geometry | Formal renderer, editor display/hit/marker, Agent reads, visual diagnostics, stretch, route anchors and drafting consume document-level geometry.   | Edit Engine transaction validation/mutation retains the lower-level primitive by design.                                               |
| Routing planners        | Committed Wire/free-anchor/tap/Delete, segment drag, loose-route translation and group-move edits are in Edit Engine `routing-planner`.           | Pointer preview and Snap-derived optional connection remain editor interaction policy; future routing policy must use the same planner boundary. |
| Search/navigation       | One locator protocol, HierarchyFrame stack, Ctrl+F, cross-Cell selection and explicit multiple-caller result paths are complete.                    | Iterate search ranking/presentation from product feedback.                                                                            |
| Net trace/highlight     | Bidirectional hierarchy trace backs the editor overlay and a navigable concrete hop list with caller instance/pin, Cell and Net.                   | Iterate multi-caller grouping/presentation from product feedback.                                                                      |
| NoConnect               | Completed minimal lifecycle: schema v3 migration, edits, undo/redo, clipboard, render/export, snapshot and topology hash.                           | Maintain regression coverage.                                                                                                          |
| ERC                     | Core completed: binding, unresolved symbol, imported-pin, hierarchy, floating gate/bulk, and NoConnect policy.                                      | Iterate policy and suppression UX from product feedback.                                                                               |
| Diagnostics UI          | Persistent project workbench merges locator-backed ERC, visual and routing diagnostics, with Cell labels, domain/severity filters and cross-Cell navigation. | SPICE remains in Import Review until source spans have stable locators. |
| Compatibility cleanup   | Consumer audit complete for all production read paths; no blind deletion performed.                                                                 | `routePolyline` remains the geometry derivation primitive and is still required inside Edit Engine transaction validation/mutation.    |

## Verification evidence

- Formatting and pinned-reference checks passed.
- Full unit suite: 576 passed.
- Full editor E2E suite: 81 passed.
- 500-instance performance gate passed: formal render 15.567 ms, Agent summary
  7.129 ms, and all configured operation budgets passed.
- Agent API artifacts, Phase 5 formal SVG goldens, route-attached current-arrow
  golden and production-preview smoke checks passed.

The retained `routePolyline` primitive is no longer a parallel production read
path: it remains inside geometry derivation and Edit Engine mutation/validation
where a stored-route primitive is required. Source-only SPICE diagnostics stay
in Import Review by the accepted ADR boundary; they are not falsely assigned a
canvas location. This status records completion of the connectivity recovery,
not an end to future product-policy iteration.
