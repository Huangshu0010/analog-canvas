# Connectivity and Routing

Status: `accepted`

Primary owners: `packages/model`, `packages/edit-engine`, `packages/derived`

`Net.terminals` is logical connectivity. A terminal is an Instance pin; both
`port` and `port-filled` participate through their ordinary pin `P`. Routes use
the same terminal endpoint for those Instances and every other component.

A Route belongs to one Net and connects terminal or Junction endpoints. Its
editable centerline is endpoint, zero or more waypoints, endpoint;
`segmentModes.length` is always `waypoints.length + 1`. Junctions are explicit
branch/route anchors. Geometric crossing or overlap does not create electrical
contact.

## Authoring rules

- Starting and ending a wire on terminals or explicit Junctions creates or
  joins real Net membership through one atomic Edit Engine transaction.
- A Route-segment tap splits geometry at an explicit Junction. A mere crossing
  remains disconnected.
- Moving a connected Instance stretches the attached Route while preserving
  endpoint identity.
- Deleting geometry does not silently invent an alternate connection.
- `NoConnect` and Net membership are mutually exclusive.
- Snap, selection, highlight, clipboard, undo, Agent Snapshot, and formal render
  consume the same resolved endpoint geometry.

Routes may present as `wire`, `bulk-dashed`, or `power-rail`; presentation does
not alter Net identity. `bulk-dashed` is used for explicit MOS B routing.
Manual MOS instances without explicit B membership first use a configured
cell-default Net, otherwise a `supply-default` creates or reuses canonical
global ground/VDD. Starting a `bulk-dashed` route from B treats the implicit
membership as unowned; committing clears the binding before connecting the
explicit Net. Deleting the explicit route may reconcile the configured or
canonical supply default. Source-bound/imported MOS instances remain governed
by their fourth-node evidence and are never guessed.

A `power-rail` Route is valid only on an explicit Net whose persisted
`powerDomain` is `vdd`. VDD rail authoring creates the global Net when needed,
two route-anchor Junctions, the rail Route, and one attached RichText power
label. It creates no VDD Instance. Branch wires on the same Net use ordinary
wire presentation and explicit contact evidence.

## Derived read models

`ProjectConnectivityIndex` is the shared logical/routed connectivity view.
`ResolvedRouteGeometry` is the shared geometry for render, hit testing, drag,
marker attachment, diagnostics, export, and Agent Snapshot.
`deriveDocumentContactEvidence` is the sole coincident-endpoint contact source;
consumers do not infer contact independently from pixels or bounds.

Route queries (tap, nearest segment, crossings) and attachment placement are
read-only derived modules. Route normalization, escape authoring, segment
movement, stretch, and the `RouteEditPlan` preview/commit boundary belong to
`@icm/edit-engine`; no compatibility `RoutePolyline` protocol exists.

For explicit same-Net endpoints at the same page coordinate, contact evidence
records terminals/Junctions, independently authored Route arms, and incident
directions. Route waypoints are not implicit contacts. A visible dot represents
authored branch topology, not line intersection.

## Transaction invariants

- Every terminal and Junction reference exists.
- Every Route endpoint agrees with the Route Net.
- A terminal belongs to at most one Net.
- Route normalization removes duplicate and collinear interior points without
  changing endpoint identity.
- A failed multi-edit transaction changes nothing; a successful one advances
  revision once.
- GUI and Agent use the same planners, transaction engine, derived geometry,
  and diagnostics.
