---
status: completed
experience: none
---

# WP-R1 — ADR and Spec Freeze for Unified Read Models

## Goal

Freeze the cross-module contracts before any code migration (R2–R10). Per
roadmap §8 R1: every cross-package type gets an accepted owner, consumers, and
failure semantics. Documentation-only target — no code, schema, or fixture
change. The frozen types are the ones later work packages implement:

- `ProjectConnectivityIndex` (R2) and its document/net records, typed virtual
  edges, and hierarchy index.
- `ResolvedRouteGeometry` (R3) and its segments, vertices, endpoint joins, and
  hit geometry.
- `ObjectLocator`, `HierarchyFrame`, and the unified `Diagnostic` envelope (R5,
  R6, R8, R9).
- `NoConnect` and `SourceBindingEvidence` persistence shapes (R7).

## State and Ownership

Start state from `git status --short --branch`:

```text
## roadmap/connectivity-routing-debugging
(clean — R0 committed at 40f5d3e; only this target's new edits will appear)
```

Worktree is clean coming off R0. No overlap with any other target.

Owned paths (this target may edit):

- `docs/adr/0013-project-connectivity-index.md` (NEW)
- `docs/adr/0014-resolved-route-geometry.md` (NEW)
- `docs/adr/0015-object-locator-and-diagnostic-envelope.md` (NEW)
- `docs/specs/schematic-model.md` (proposed NoConnect + binding evidence
  subsection; cross-reference)
- `docs/specs/connectivity-and-routing.md` (proposed unified-read-models
  subsection; fix stale `detach` validation bullet; compatibility/deletion
  threshold note)
- `docs/specs/edit-engine.md`, `docs/specs/editor-interaction.md`,
  `docs/specs/agent-api.md`, `docs/specs/export.md` (one-line forward-reference
  to the relevant ADR(s) each)
- `plan/2026-08-12-wp-r1-adr-spec-freeze/plan.md` (this file)
- `plan/log.md` (entry)

Read-only: all code under `packages/**` and `apps/**` — this target writes no
code. Existing ADRs `0001`–`0012` are immutable history; new decisions start at
`0013`.

## Work

1. **ADR 0013 — Project Connectivity Index.** Owner `packages/derived`.
   Consumers: flightline derivation, net highlight/trace, ERC, search object
   index, formal-export geometry source. Freeze the index interfaces
   (`ProjectConnectivityIndex`, `DocumentConnectivityIndex`,
   `NetConnectivityRecord`, `VirtualConnectivityEdge`,
   `HierarchyConnectivityIndex`, `ProjectObjectIndex`), the three-layer fact
   model (logical membership / visible routed graph / virtual edges), the
   revision-based cache invalidation rule, and the failure semantics
   (unresolved endpoint → null point, no guessed geometry; crossing never merges
   nets). Record the R0 finding that flightline from/to direction is currently
   partition-sensitive and state R2's normalization decision.

2. **ADR 0014 — Resolved Route Geometry.** Owner `packages/derived`.
   Consumers: SVG renderer, editor hit testing, segment drag, marker attachment,
   visual/routing diagnostics, formal export. Freeze `ResolvedRouteGeometry`
   (centerline, segments, vertices, `endpointJoins`, `hitGeometry`, bounds) and
   the rule that centerline strictly terminates at real Pin/Port/Junction
   origins while `endpointJoins` carry the terminal/route-anchor miter bridges
   the renderer currently computes privately. State the additive-then-switch
   migration and the seam-golden deletion gate.

3. **ADR 0015 — Object Locator and Diagnostic Envelope.** Owner
   `packages/derived` (locator/diagnostic types) + editor (navigation).
   Consumers: project search, net trace, ERC, SPICE/visual diagnostics,
   diagnostic UI. Freeze `ObjectLocator`, `HierarchyFrame`, the unified
   `Diagnostic` envelope (`domain`, `severity`, `confidence`, `gateEligible`,
   `primary`/`related` locators, parameters), and `navigateTo` semantics (switch
   cell, restore instance path, select, zoom, highlight; never mutate revision).
   Keep `VisualDiagnostic` and `SpiceDiagnostic` producers behind adapters.

4. **schematic-model.md** — add a `proposed` "NoConnect and source binding
   evidence" subsection freezing the R7 persistence shapes (`NoConnect`,
   `SourceBindingEvidence`) and their invariants (endpoint not simultaneously
   Net/Route/NoConnect; migration backfills empty arrays, infers nothing).

5. **connectivity-and-routing.md** — add a `proposed` "Unified read models"
   subsection referencing ADRs 0013/0014/0015 and naming each consumer; fix the
   stale `detach retaining Net membership` validation bullet to reflect the
   current `cut_connection` branches (consistent with the R0 Phase-3 note); add
   a compatibility/deletion-threshold clause (old `deriveVisibleConnectivity` /
   `deriveFlightlines` / renderer-private bridges remain until R10 proves no
   consumers and characterization parity).

6. **edit-engine / editor-interaction / agent-api / export specs** — add one
   forward-reference line each to the ADR(s) that freeze a contract they
   consume (planners → 0014; navigation/search → 0015; Agent snapshot/diagnostic
   additive → 0015; export consumes resolved geometry → 0014).

## Validation

- `git diff --check`
- `git status --short --branch`
- Prettier is not a gate for `docs/` markdown (R0 confirmed the gate glob
  excludes `.md`); new ADRs/spec prose follows existing section structure.
- Cross-link check: each ADR's "Related documents" links the specs and roadmap;
  each amended spec links the ADR it references.

Scope rationale: documentation-only freeze; no typecheck/test/build surface
changes. The smallest deterministic validation is diff cleanliness plus a link
audit.

## Commit Intent

```text
docs(adr): freeze connectivity index, resolved geometry, and locator contracts (WP-R1)
```

## Outcome

Froze the cross-module contracts as three accepted ADRs and amended the
normative specs to acknowledge them. Documentation-only; no code, schema,
fixture, or Project-file change.

- `docs/adr/0013-project-connectivity-index.md` — owner `packages/derived`;
  frozen index interfaces, the three-layer fact model, revision cache/invalidation,
  failure semantics, and the flightline id/direction normalization that resolves
  the WP-R0 partition-sensitivity finding.
- `docs/adr/0014-resolved-route-geometry.md` — owner `packages/derived`; frozen
  `ResolvedRouteGeometry`/segments/vertices/`endpointJoins`/`hitGeometry`/bounds;
  centerline strictly terminates at real endpoints; bridges move out of the
  renderer only after a seam-golden gate.
- `docs/adr/0015-object-locator-and-diagnostic-envelope.md` — owner
  `packages/derived` + `apps/editor`; frozen `ObjectLocator`/`HierarchyFrame`,
  unified `Diagnostic` envelope, and `navigateTo` semantics; existing
  `VisualDiagnostic`/`SpiceDiagnostic` producers stay behind adapters.
- `docs/specs/schematic-model.md` — proposed NoConnect + SourceBindingEvidence
  subsection with frozen invariants for R7.
- `docs/specs/connectivity-and-routing.md` — proposed unified-read-models
  subsection referencing 0013/0014/0015; compatibility/deletion threshold; fixed
  the stale `detach retaining Net membership` validation bullet to the current
  `cut_connection` branches (consistent with the R0 Phase-3 note).
- `docs/specs/{edit-engine,editor-interaction,agent-api,export}.md` — one
  forward-reference line each to the relevant ADR(s).

Validation: cross-link audit — every referenced path resolves (12/12); `git
diff --check` clean. Markdown under `docs/`/`plan/` is outside the `format:check`
glob (confirmed in R0), so no prettier gate applies. No code surface changed,
so no typecheck/test/build regression is possible from this target.

`status: completed`, `experience: none`.
