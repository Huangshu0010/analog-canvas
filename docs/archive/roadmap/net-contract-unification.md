# Net Contract Unification Plan

Status: `completed` on `codex/net-contract-unification-plan`

Primary owners: `packages/model`, `packages/edit-engine`, `packages/derived`,
`packages/netlist`, `apps/editor`

Related contracts:

- [`schematic-model.md`](../../specs/schematic-model.md)
- [`connectivity-and-routing.md`](../../specs/connectivity-and-routing.md)
- [`edit-engine.md`](../../specs/edit-engine.md)
- [`netlist-export.md`](../../specs/netlist-export.md)
- [`connectivity-routing-debugging-plan.md`](../../roadmap/connectivity-routing-debugging-plan.md)

## 1. Outcome

Net authoring, hierarchy, highlighting, ERC, and structural netlist export must
agree on one compact electrical contract:

```text
Net.terminals = persisted logical membership inside one Document
Net.id        = stable object identity inside that Document
Net.name      = preserved user/export spelling
Net.scope     = whether the name is local or project-global
powerDomain   = electrical role metadata, never a shorting key
Route         = visible geometry belonging to a Net, never connectivity truth
```

This plan is a prerequisite refinement for the larger connectivity/debugging
roadmap. It does not replace route geometry, search, or ERC plans. It fixes the
smaller contract on which those features depend.

## 2. Initial inconsistency (resolved)

The persisted shape is already sufficient, but current producers and consumers
interpret it differently:

- placement on an existing conductor can assign a power role to that conductor,
  while standalone power placement creates a new Net and merges it with the
  first Net of the same power role;
- power normalization can add a canonical name and global scope, but does not
  canonicalize duplicate Net objects;
- `set_net_name` checks exact spelling, while netlist export and ERC compare
  names after case folding;
- ERC suppresses duplicate-name errors for repeated global power Nets, while
  netlist export still rejects those same documents;
- highlight and hierarchy trace address Nets by `(documentId, netId)` and have
  no shared global-name equivalence;
- MOS supply fallback may select the first Net with a matching power role, so
  role metadata can accidentally stand in for Net identity;
- `merge_nets` retargets most Net references, but its closure must include the
  formal `Document.netlist.terminals` interface before it becomes the common
  canonicalization primitive.

The result is the observed failure mode: several legal Ground or VDD
attachments can appear acceptable in ERC, separate in highlight, noisy in
flightlines, and invalid during export.

## 3. Frozen semantics

### 3.1 Object identity and electrical identity

No persisted field is added. `Net.id` remains the stable object identity within
one Document. Consumers use these transient references:

```ts
interface NetObjectRef {
  documentId: string;
  netId: string;
}

type ElectricalNetKey =
  | { scope: "local"; documentId: string; netId: string }
  | { scope: "global"; foldedName: string };
```

Rules:

1. A local Net is identified by `(documentId, netId)`.
2. A named global Net is project-wide electrically equivalent to every global
   Net with the same folded name.
3. Global equivalence is a derived index edge. Documents keep their own Net
   objects and revisions; no project-wide persisted Net object is introduced.
4. Parent/child connectivity is not inferred from equal local names. It follows
   the explicit parent Instance pin to `Document.netlist.terminals` mapping.

### 3.2 Name normalization

One pure helper, owned by `packages/model`, supplies comparison semantics:

```ts
foldNetName(name) = name.trim().toLowerCase()
```

The folded value is never persisted. The authored spelling is preserved for
display and export. The existing portable export subset remains an exporter
policy; this plan does not add dialect-specific escaping.

Within one Document, two named Net objects may not have the same folded name.
Applying an existing name through a high-level GUI planner means electrical
merge, matching schematic-label behavior. The low-level `set_net_name` edit
continues to reject ambiguity and requires an explicit `merge_nets` edit in the
same transaction.

### 3.3 Scope

| Scope | Meaning | Connection rule |
| --- | --- | --- |
| `local` | A node owned by one Document | Never connects across Documents by name |
| hierarchical interface | Existing formal terminal plus parent Instance pin | Connects only through explicit pin mapping |
| `global` | A deliberately project-wide named node | Same folded name connects across Documents |

An unnamed local Net is valid and receives a deterministic transient export
name. An unnamed global Net is invalid because it has no global identity.

### 3.4 Power role

`powerDomain` remains `none | vdd | ground | conflict` for schema compatibility,
with these authoring rules:

- `powerDomain` classifies a Net; it never identifies or merges one;
- `AVDD` and `DVDD` remain distinct even when both have role `vdd`;
- reference ground uses global Net name `0` and role `ground`;
- `VSS` is not silently converted to SPICE ground;
- a Ground Instance attaches through ordinary pin `0` to the canonical `0` Net;
- a VDD rail attaches to the explicitly named global `VDD` Net and remains
  Route/Junction/annotation authoring, not a second connectivity system;
- MOS bulk uses an explicit cell default first, then the canonical configured
  supply name. It never selects an arbitrary first Net by role;
- normal authoring rejects opposite-role merge or reassignment atomically;
  `conflict` is accepted only as imported/legacy evidence for diagnosis.

## 4. One authoring boundary

Add one pure planner in `packages/edit-engine`, named for intent rather than UI
gesture:

```ts
planEnsureNamedNet(document, {
  candidateNetId,
  name,
}) -> { netId, name, edits }
```

It emits existing typed edits; no new mutation language is introduced.

Planner behavior:

1. Fold the requested name once.
2. Find the one matching Net in the current Document.
3. Preserve the candidate when it already matches, or rename it when the name
   is unused.
4. Merge the candidate into a compatible same-folded-name Net when one exists.
5. Retarget every reference through the existing `merge_nets` implementation,
   including Routes, Junctions, annotations, MOS defaults/bindings, layout
   references, and formal cell-terminal Net IDs.
6. Reject incompatible power roles instead of overwriting them.
7. Return an ordered edit list so preview, dry-run, undo, GUI, and Agent all use
   the same atomic transaction.

The following producers must call this planner rather than construct their own
Net sequence:

- Ground placement, both standalone and on an existing conductor;
- VDD rail creation;
- high-level net-label naming/renaming;
- component placement contact when the component declares a named global Net;
- SPICE import normalization;
- MOS supply-default materialization;
- Agent semantic naming actions; raw typed Agent transactions remain strict.

Ordinary unnamed wire authoring continues to use the routing planner. It does
not need the named-Net planner until a label, global attachment, or explicit
name is introduced.

## 5. Read model and semantic bridges

`ProjectConnectivityIndex` keeps per-Document records keyed by `netId` and adds
two explicit edge types:

```text
Hierarchy edge: parent Instance pin <-> child formal terminal Net
Global edge:    global folded name <-> matching global NetObjectRefs
```

These edges serve trace, highlight, search, and ERC. A global edge does not draw
a Route and is not persisted.

Flightlines remain visual completion hints. They join routed components only
when no authored semantic bridge already explains the connection. Existing
net-label/power-label evidence is retained; Ground markers and VDD power-label
attachments contribute equivalent typed evidence. Consequently:

- two terminals connected only by imported `Net.terminals` can still show a
  flightline;
- two islands deliberately connected by matching labels or power markers do
  not show a misleading flightline;
- global equivalence across Documents never creates a cross-page flightline.

## 6. Shared validation and export

Introduce one read-only `validateNetContract(document)` result consumed by
Document diagnostics, ERC, and netlist extraction. It checks:

- trimmed non-empty explicit names;
- folded-name uniqueness within a Document;
- every global Net has an explicit name;
- ground role is compatible with global name `0`;
- incompatible roles do not occupy one canonical Net;
- every terminal has one owner;
- every Net reference, including formal cell terminals, resolves.

After producer migration and legacy normalization, remove the ERC-only
exception for repeated global power Nets. ERC and exporter must report the
same naming/role violation from the shared facts; ERC may enrich it with canvas
locators, but may not redefine validity.

Export remains deterministic:

- connectivity comes only from canonical `Net.terminals` and explicit
  hierarchy mappings;
- unnamed local Nets receive deterministic generated names;
- `0` is emitted as the SPICE reference node and omitted from `.global`;
- other global names are emitted once in deterministic folded-name order while
  preserving their canonical authored spelling;
- `AVDD` and `DVDD` remain separate nodes;
- Route, Junction, label artwork, flightlines, and visual diagnostics never
  affect emitted connectivity.

## 7. Existing Project handling

The persisted shape does not change, so no Project schema bump is planned.
There is no duplicate-Net compatibility repair: a Project with same-Document
same-folded names is invalid and is diagnosed until the author explicitly uses
the current typed rename or merge operations. The editor operates on one
current Project shape and does not silently rewrite an opened Project.

## 8. Delivery slices

Each slice is an independent target and commit.

### N0 — Contract characterization

- Add fixtures for repeated Ground/VDD, AVDD/DVDD, local same-name Nets in
  different cells, explicit hierarchy mapping, and global trace.
- Record current ERC/export/highlight/flightline results before mutation.
- Accept this roadmap through a focused ADR/spec update.

Exit: all observed divergences have deterministic regression fixtures.

### N1 — Name and merge primitives

- Add `foldNetName`, `NetObjectRef`, and shared validation.
- Make name checks consistently folded.
- Complete `merge_nets` reference closure, especially formal cell terminals.
- Add the pure named-Net planner and transaction tests.

Exit: one transaction can create, reuse, merge, reject, undo, and dry-run a
named/global Net without an editor dependency.

### N2 — Producer migration

- Migrate Ground, VDD rail, labels, SPICE import, MOS defaults, and Agent
  intent producers one at a time.
- Remove domain-only Net selection.

Exit: no production producer creates duplicate canonical `0` or `VDD` Nets;
`AVDD` and `DVDD` remain distinct.

### N3 — Index, flightline, ERC, and export convergence

- Add global equivalence edges to `ProjectConnectivityIndex`.
- Make trace/highlight and semantic flightline bridges consume the index.
- Make ERC and netlist extraction consume shared validation.
- Remove repeated-power special cases and independent name folding.

Exit: the same Project has one connectivity interpretation in GUI, ERC, trace,
flightlines, and exported netlist.

### N4 — Consumer cleanup

- Remove superseded editor-local power orchestration after `rg` proves no
  production consumer; do not retain a compatibility normalizer or hidden
  editor load effect.
- Update current specs, Agent documentation, and user-facing repair guidance.
- Run branch integration verification.

Exit: one planner, one name fold, one validator, and one project index own Net
semantics.

## 9. Acceptance matrix

| Scenario | Required result |
| --- | --- |
| Four Ground Instances in one Cell | One canonical `0` Net; no duplicate ERC; one exported ground node |
| Three VDD rails in one Cell | One canonical `VDD` Net; one global export name |
| `AVDD` and `DVDD`, both role `vdd` | Two independent Nets and export nodes |
| Ground placed on a VDD conductor | Atomic rejection; no partial role/name mutation |
| `out` in two unrelated child Cells | Separate local Nets |
| Parent pin mapped to child terminal | Connected only through the explicit hierarchy edge |
| Global `VDD` in parent and child | Cross-Cell trace/highlight through the global edge |
| Names `Bias` and `bias` in one Cell | High-level authoring merges; low-level ambiguous rename rejects |
| Matching net labels on separate islands | One logical Net; no unnecessary flightline between labelled islands |
| Imported logical Net without visible label/wire | Membership exports correctly; flightline may guide routing |
| Unnamed local Net | Deterministic generated export name |
| Unnamed global Net | Shared blocking diagnostic in ERC and export |
| Duplicate same-folded names in an opened Project | Shared blocking diagnostic; no silent repair |

The current authoring regressions exercise the typed explicit merge path;
project entry never repairs duplicate Net identities.

## 10. Explicit non-goals

This work does not add:

- a persisted `normalizedName` or project-wide Net object;
- buses, differential pairs, net classes, voltage ranges, or PCB constraints;
- name-based inference that silently converts `VSS`, `GND`, or `VDD` roles;
- a new first-class Port, label, or power-symbol connectivity collection;
- a second mutation API beside the Edit Engine;
- full simulator-dialect quoting or expression syntax;
- route-geometry, crossing, junction, or visual-overlap redesign;
- automatic ERC or Project-entry Net repair.

Those concerns can build on this contract later without changing its identity
rules.

## 11. Validation boundary

Focused implementation targets must cover:

- model name folding and validation;
- edit planner create/reuse/merge/reject/dry-run/undo;
- complete merge reference closure;
- placement, VDD rail, MOS default, import, and Agent parity;
- Project index local/hierarchy/global trace;
- flightline semantic-bridge positive and negative cases;
- ERC/export diagnostic parity;
- SPICE and Spectre global emission and structural reparse;
- schema-10 direct upgrade without Net mutation;
- save/reopen stability for a valid current Project;
- `pnpm test:impact -- --base <base-ref>` and the normal branch gate at the
  delivery boundary.

No full-suite requirement is attached to the documentation slice. Runtime
slices expand validation only when their owned contracts cross package or
public API boundaries.

## 12. Delivery record

The completed implementation keeps the protocol deliberately small:

| Concern | Owner | Delivered boundary |
| --- | --- | --- |
| Name equivalence and document validity | `packages/model` | `foldNetName` and `validateNetContract`; authored spelling remains persisted unchanged. |
| Authoring | `packages/edit-engine` | Existing typed edits plus the named-Net and power-Net planners; the latter is only a role-aware wrapper and does not define a second Net identity. |
| Read-side electrical equivalence | `packages/derived` | `ProjectConnectivityIndex` local, hierarchy, and named-global edges; semantic flightline and trace consumers. |
| Export and diagnostics | `packages/netlist`, `packages/derived` | Shared contract validation, deterministic local generated names, and explicit global emission. |
| Project entry | `apps/editor` | Installs the validated Project without Net repair; current MOS bulk materialization remains a separate presentation operation. |
| Agent intent | `packages/agent-client`, `packages/agent-adapter` | Semantic Net rename reuses the same named-Net planner as GUI; raw typed transactions remain strict. |

Final branch verification passed on 2026-08-17: `pnpm verify:branch` completed
static checks, 143 test files / 860 tests, all workspace builds, and the
editor production-preview smoke check. The size warning emitted by Vite is
non-blocking and is unrelated to Net semantics.

The adjacent routing/debugging roadmap remains independent: this delivery does
not claim completion of route-geometry redesign, broader ERC policy, search,
or visual diagnostics.
