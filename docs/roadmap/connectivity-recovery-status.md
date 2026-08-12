# Connectivity recovery status

Status: `active`

This is the factual implementation status following the recovery commits on
`roadmap/connectivity-routing-debugging`. It supplements, rather than rewrites,
the roadmap's original recovery audit.

| Area                    | Verified status                                                                                                                    | Remaining gate                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Behavior/contracts      | Completed; characterization and ADR/spec contracts are in place.                                                                   | Preserve parity tests while migrating consumers.                                                               |
| Connectivity index      | Core completed; revision cache, resolved geometry and single-pass flightlines now drive editor flightlines, search, trace and ERC. | Retain old helpers until all lower-level consumers migrate.                                                    |
| Resolved route geometry | Formal renderer and editor display/hit/marker readers consume it.                                                                  | Mutation-side attachment remap, stretch and visual diagnostics still need the same interface.                  |
| Routing planners        | Wire, free-anchor, route-tap and visual deletion are in Edit Engine `routing-planner`.                                             | Segment, Junction and group stretch are not one common planner API yet.                                        |
| Search/navigation       | Core completed; one locator protocol, HierarchyFrame stack, Ctrl+F, cross-Cell selection and Up-path browser regression.           | Expose multiple caller paths in product UI.                                                                    |
| Net trace/highlight     | Core completed; bidirectional hierarchy trace backs the editor overlay.                                                            | Add visible path expansion/multiple-caller presentation.                                                       |
| NoConnect               | Completed minimal lifecycle: schema v3 migration, edits, undo/redo, clipboard, render/export, snapshot and topology hash.          | Maintain regression coverage.                                                                                  |
| ERC                     | Core completed: binding, unresolved symbol, imported-pin, hierarchy, floating gate/bulk, and NoConnect policy.                     | Iterate policy and suppression UX from product feedback.                                                       |
| Diagnostics UI          | Persistent project workbench merges locator-backed ERC and visual diagnostics, with Cell labels, domain/severity filters and cross-Cell navigation. | SPICE remains in Import Review until source spans have stable locators; routing must adopt the envelope before it joins the workbench. |
| Compatibility cleanup   | Not ready for deletion.                                                                                                            | `routePolyline` remains a valid lower-level primitive for geometry derivation, stretch and visual diagnostics. |

## Verification evidence

- Full unit suite: 568 passed.
- Full editor E2E suite: 79 passed.
- 500-instance performance gate passed: formal render 19.715 ms, Agent summary
  11.124 ms, and all configured operation budgets passed.

The compatibility layer must remain until each remaining consumer has been
migrated with equivalent characterization and performance coverage. This status
does not treat an additive module as a completed work package.
