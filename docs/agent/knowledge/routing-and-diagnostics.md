# Routing and diagnostics

Owner: Edit Engine for connectivity; Agent reasoning for geometry. Strength:
hard for endpoint/Net identity and guidance for expression. Trigger: routing,
crossings, Junctions, flightlines, or visual diagnostics.

Use Routes to express the existing Net topology. Geometry may change freely
within locks and revision rules; electrical membership may not change merely to
simplify routing.

## Route construction

- Start from placed pin, port, or Junction endpoints and keep explicit endpoint
  identity.
- Prefer short orthogonal segments, few bends, shared trunks for genuinely shared
  Nets, and consistent escape directions from dense devices.
- Allow a wire to end at any intended waypoint or Junction supported by the edit
  contract; do not snap it to an unrelated electrical object.
- A crossing without a Junction remains disconnected. Add a Junction only when
  the Snapshot topology says the Nets are the same and the branch must connect.
- Keep deliberate crossings visually clear. Do not add detours solely to reduce
  a crossing counter.
- When moving a group, move the internal objects and route geometry coherently;
  preserve external boundary connections and locked segments.
- When a long shared Net is intentionally not drawn as a trunk, attach the same
  meaningful Net label to each local branch. Do not leave short unlabeled stubs
  and explain them only in a caption.

## Repair loop

1. Read diagnostic `code`, `revision`, object IDs, bounds/point, and parameters.
2. Confirm the diagnostic still applies to the current revision.
3. Identify the smallest responsible placement, Route segment, Junction, or
   annotation set.
4. Dry-run the typed correction when connectivity or multiple objects are
   involved.
5. Render the affected bounds and then review the whole Document before finish.

## Diagnostic decisions

- Unresolved symbol or unplaced instance: resolve the mapping/fact or place the
  object before detailed routing.
- Symbol or label overlap: move the least structurally important unlocked object
  locally; retain true matched alignment.
- Short Route segment: remove the redundant bend or move the waypoint while
  preserving endpoints and segment modes.
- Ambiguous Junction/crossing: inspect the exact point and Net IDs; never infer
  connection from pixels.
- Constraint violation or outside-page object: honor the owning lock/constraint
  and change the surrounding layout when necessary.
- Flightline: route it or explicitly report why it must remain. Do not call an
  unrouted intended connection complete.

Routing-quality metrics report evidence, not pass/fail verdicts:

- `VISUAL_WIRE_THROUGH_SYMBOL`: a Route segment passes through an instance
  silhouette that is not one of its terminal endpoints. Usually a placement or
  tree-shape problem; move the instance or change the Route, do not retunnel
  through the device.
- `VISUAL_ROUTE_OVERLAP`: two Routes on the same Net share a collinear
  overlapping segment. Collapse the duplicate or switch one branch to a label.
- `VISUAL_TERMINAL_DEPARTURE` (info): a terminal-anchored Route's first segment
  does not leave along the pin outward direction. Evidence only — a deliberate
  immediate bend is sometimes clearer; decide from the render, not from the
  counter alone.

Warnings may remain only when intentional and explained with object IDs. Errors,
stale diagnostics, and unintended electrical ambiguity block completion.
