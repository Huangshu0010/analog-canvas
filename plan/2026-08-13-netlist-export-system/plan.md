---
status: completed
experience: none
---

# Deterministic Netlist Export System

## Goal

Build a program-only, deterministic netlist export system that converts the
persisted schematic electrical model into either a structural SPICE `.spi`
netlist or a structural Spectre `.scs` netlist. The same validated Project must
produce byte-identical output without AI inference, diagram-geometry inference,
or access to an untracked PDK installation.

The first delivered boundary is a **design netlist**: cells, ordered cell
ports, instances, ordered instance pins, Nets, device targets, and raw instance
parameters. A directly runnable **simulation deck** (PDK/model-library
includes, corner selection, stimuli, analyses, options, and saved outputs) is a
separate later boundary and must not be implied by a successful design-netlist
export.

## State and Ownership

Start state from `git status --short --branch` before branching:

```text
## codex/ci-contract-cleanup
```

The worktree was clean. That branch was three unrelated commits ahead of
`origin/main`, so this target was deliberately branched from the clean,
up-to-date `main` (`62141a8`) rather than inheriting the CI/API cleanup history.
The target branch is:

```text
codex/netlist-export-system
```

The implementation target may own only the following areas unless this plan is
updated before scope expansion:

- `plan/2026-08-13-netlist-export-system/plan.md`
- `plan/log.md` at target close-out
- `docs/specs/netlist-export.md`
- `docs/specs/project-file-format.md`
- `docs/specs/schematic-model.md`
- `docs/specs/symbol-dsl.md`
- one ADR if the schema/version and package-boundary decision cannot be fully
  captured by the accepted specs
- `packages/model/src/` for persisted electrical contract and migration work
- `packages/symbols/src/` for the device-to-netlist definition registry
- `packages/edit-engine/src/` for typed Cell-interface and Instance-netlist
  edits after WP0 acceptance
- focused Agent adapter classification/schema updates required by the new
  public typed edits
- focused downstream test fixtures that construct Documents manually and must
  remain valid after the accepted schema-v4 Cell/Instance contract
- `packages/spice/src/importer.ts` and its focused tests so newly imported
  schema-current Projects write typed netlist facts directly rather than
  relying on a migration that only runs for older files
- a new `packages/netlist/` package for extraction, validation, IR, and printers
- `apps/editor/src/features/netlist-export/` for editor-facing orchestration
- the smallest necessary hooks in `apps/editor/src/app/App.tsx`
- focused fixtures under `fixtures/` when unit construction is insufficient
- workspace manifests and TypeScript references needed to register the new
  package
- focused downstream schema-version assertions such as
  `packages/platform-web/src/file-system-access.test.ts`

Read-only shared dependencies unless the plan is expanded:

- `packages/spice/src/` other than the owned importer seam: current source
  parser and import Circuit IR remain read-only
- `packages/derived/src/connectivity-index.ts`: existing connectivity authority
- `packages/exporters/`: SVG/PNG/PDF pipeline; netlist export must not be added
  to this visual-artifact package
- existing circuit files under `netlists/`: validation inputs, never rewritten
  as part of exporter development
- user examples `C:/Users/90590/Desktop/circuit.spi` and
  `C:/Users/90590/Desktop/ota5_ac.scs`: read-only syntax and product-boundary
  evidence, not golden output to reproduce verbatim

The accepted shared contracts that this target must preserve are:

- logical connectivity is owned by `Net.terminals` and `Net.ports`, not Route
  geometry;
- array order is preserved by canonical Project serialization;
- imported source text and transient Circuit IR are intentionally not persisted;
- explicit `.subckt` interfaces and instance pin order must never be guessed;
- unknown foundry/vendor models and values must never be replaced silently;
- formal SVG/PNG/PDF remains a separate rendering pipeline.

## Product Boundary

### In scope for the first release

- deterministic extraction from every Project document into a dialect-neutral
  design-netlist IR;
- stable generated names for unnamed local Nets;
- stable and unique instance references;
- explicit cell names and ordered cell ports;
- R, C, L, MOS, independent source, ground/global-net marker, and hierarchical
  instance classifications, with unsupported classifications rejected;
- typed device target/model and raw parameter values;
- `.spi` printer for the accepted structural SPICE subset;
- `.scs` printer for the equivalent Spectre structural subset;
- blocking diagnostics before download;
- File-menu export commands and a concise diagnostic/preview surface;
- deterministic unit, migration, round-trip structural, and browser tests.

### Explicitly out of scope for the first release

- selecting or discovering a PDK from a model name;
- copying foundry model data into a Project;
- emitting guessed `.include`, `include`, `.lib`, or corner/section statements;
- AC/DC/transient/noise analyses, simulator options, temperatures, save/probe
  lists, or waveform-output configuration;
- claiming that a structural design netlist is independently simulatable;
- lossless regeneration of the originally imported source file;
- evaluating parameter expressions or converting raw engineering suffixes to
  floating-point values;
- AI-based naming, device classification, model selection, parameter filling,
  or repair.

## Authority Model

The implementation must establish one authority for each exported fact:

| Exported fact           | Authority                                          | Forbidden fallback                                     |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| Cell identity           | typed Document netlist metadata                    | visible document title or source filename              |
| Cell port order         | explicit ordered Port IDs                          | canvas position or alphabetical sort                   |
| Net membership          | `Net.terminals` and `Net.ports`                    | Route contact or geometric overlap                     |
| Net name                | `Net.name`, otherwise deterministic generated name | annotation text not bound through the Net-name edit    |
| Global/ground meaning   | `Net.scope` and the electrical name `0`            | symbol artwork, vertical placement, or text appearance |
| Instance reference      | typed instance reference                           | visible instance-label annotation                      |
| Device class/prefix     | reviewed device-netlist definition                 | parsing `symbolId` ad hoc in a printer                 |
| Model/subcircuit target | typed instance binding                             | symbol name, label text, or guessed PDK convention     |
| Instance pin order      | reviewed device definition or child-cell interface | symbol orientation, x/y position, or object-key order  |
| Parameter name/value    | typed raw parameter map                            | visual label parsing or numeric normalization          |
| Dialect spelling        | SPICE/Spectre printer                              | values stored as preformatted source lines             |

`spice.name`, `spice.target`, `spice.pin.Pn`, and `spice.param.*` remain
compatibility inputs for migration only. Once a Project is migrated, neither
the extractor nor either printer may read those free-form properties as a
second authority.

## Target Contracts

### 1. Persisted cell interface

Add a typed Document-level record equivalent to:

```typescript
interface CellNetlistInterface {
  name: string;
  portOrder: StableId[];
}
```

Contract:

- `name` is the electrical cell/subcircuit identifier and is separate from the
  user-facing Document title;
- it is non-empty, length-bounded, and unique under the selected dialect's
  case-folding rules;
- `portOrder` contains every Document Port exactly once;
- array position is the `.subckt`/`subckt` interface position;
- port canvas coordinates and directions never affect order;
- adding/removing/reordering ports is an explicit Edit Engine operation;
- a hierarchy instance binds by stable child Document ID and maps its pins to
  the child `portOrder` contract;
- migrations may derive a cell name from an existing imported
  `sourceBinding.cellName`; otherwise they create a sanitized deterministic
  name from the Document name and report any collision for user review.

### 2. Port contract

Keep `Port.name` as the electrical terminal name. Tighten validation so that:

- every Port appears in `portOrder` exactly once;
- port names are unique within a cell under dialect case folding;
- every exported Port belongs to exactly one Net;
- an intentionally unconnected Port must have a `NoConnect`, otherwise export
  is blocked;
- direction remains ERC/presentation metadata and does not change emitted pin
  order.

### 3. Net contract

Keep the existing logical membership fields as the only connectivity truth.
No additional export-only connectivity graph is persisted.

- `Net.name`, when present, is the electrical name edited by a Net-label action;
- an unnamed local Net receives a deterministic ephemeral name during
  extraction, using a collision-free `N0001` sequence ordered by stable Net ID;
- an unnamed global Net is invalid and blocks export;
- named Nets must be unique within their scope under dialect case folding;
- the global Net named `0` is the SPICE/Spectre reference node; the existing
  ground placement flow already creates this explicit fact;
- other global Nets produce dialect-specific global declarations and do not
  become implicit cell ports;
- Routes, Junctions, flightlines, labels, and drawing coordinates never change
  the extracted Net set;
- zero-member Nets, multiply assigned pins, missing referenced pins, and a Port
  assigned to multiple Nets are blocking diagnostics.

### 4. Instance electrical contract

Evolve the current import-only binding evidence into an explicitly editable
electrical binding while retaining source provenance as optional evidence.
The persisted shape should provide these facts without parsing `properties`:

```typescript
interface InstanceNetlistData {
  reference: string;
  binding:
    | { kind: "primitive"; deviceClass: DeviceClass }
    | { kind: "model"; deviceClass: DeviceClass; name: string }
    | { kind: "subcircuit"; childDocumentId: StableId; name: string }
    | { kind: "external-subcircuit"; name: string };
  parameters: Record<string, string>;
}
```

The final schema may retain the existing top-level `binding` field to minimize
migration churn, but the accepted spec must expose exactly one normative
binding and parameter authority.

Contract:

- `reference` is unique within a cell and distinct from visible label text;
- its prefix must agree with the device definition or an explicitly accepted
  external-subcircuit invocation;
- manually placed instances receive a persisted reference at insertion time;
- legacy missing references are assigned deterministically during migration,
  without interpreting visual labels;
- a MOS/model-backed device must have an explicit model target;
- a hierarchical instance must resolve `childDocumentId` and the child cell
  name; name-only hierarchy is rejected when the child is part of the Project;
- all parameter values remain bounded raw strings such as `2u`, `60n`, or
  `{WBASE*2}`; exporters do not evaluate them;
- empty parameter strings are absent, not emitted as empty assignments;
- imported source span and status may remain alongside the electrical binding
  for diagnostics but cannot override it.

### 5. Device-to-netlist definition

Create a reviewed registry in `packages/symbols`, separate from visual artwork,
with a definition equivalent to:

```typescript
interface DeviceNetlistDefinition {
  symbolId: StableId;
  deviceClass:
    | "resistor"
    | "capacitor"
    | "inductor"
    | "mos"
    | "voltage-source"
    | "current-source"
    | "net-marker"
    | "hierarchical";
  referencePrefix: string | null;
  pinOrder: string[];
  targetPolicy: "builtin" | "required-model" | "child-cell" | "none";
  requiredParameters: string[];
}
```

Contract:

- every exportable non-decorative symbol has exactly one reviewed definition;
- every `pinOrder` name resolves to one canonical Symbol pin exactly once;
- ordinary R/C/L use positional `value` semantics in SPICE and printer-specific
  named semantics in Spectre;
- MOS uses canonical D/G/S/B order even when a visual variant hides B;
- hidden/implicit electrical pins remain in the netlist contract;
- VDD and ground graphical instances are `net-marker` definitions and emit no
  device line;
- decorative drafting symbols never enter the registry;
- unregistered symbols produce a blocking unsupported-device diagnostic;
- PDK registry mappings may select a reviewed visual symbol and pin mapping,
  but never supply an unrequested include path or corner.

### 6. Dialect-neutral design-netlist IR

Create a transient output IR distinct from the existing import `CircuitIR`.
It contains only normalized export facts and structured diagnostics:

```typescript
interface DesignNetlistIR {
  topCellId: StableId;
  cells: DesignNetlistCell[];
  globals: string[];
}

interface DesignNetlistCell {
  id: StableId;
  name: string;
  ports: Array<{ id: StableId; name: string; netName: string }>;
  nets: Array<{ id: StableId; name: string; scope: "local" | "global" }>;
  instances: DesignNetlistInstance[];
}

interface DesignNetlistInstance {
  id: StableId;
  reference: string;
  deviceClass: string;
  target: string | null;
  nodes: Array<{ pinName: string; netName: string }>;
  parameters: Array<{ name: string; rawValue: string }>;
}
```

Extraction rules:

- resolve hierarchy in dependency order and reject cycles;
- order cells dependency-first with stable ID/name tie breaking;
- order ports only by the persisted interface;
- order instance nodes only by the reviewed device definition or child
  interface;
- sort globals, instances, and named parameters deterministically;
- assign unnamed local Net names deterministically without mutating the Project;
- omit `net-marker` instances after verifying their pin participates in the
  intended Net;
- include no coordinates, routes, annotations, source text, simulator commands,
  PDK paths, or rendering fields;
- return `IR | null` plus diagnostics; any error diagnostic prevents printing.

### 7. Printer contracts

Both printers are pure functions over a validated `DesignNetlistIR`. They may
format but may not repair, infer, or query the Project/Symbol resolver.

SPICE `.spi` release:

- emit a generated-file comment and exporter contract version;
- emit sorted `.global` names where applicable;
- emit dependency-first `.subckt <name> <ordered ports>` blocks;
- emit R/C/L, model-backed devices, and X subcircuit calls using the accepted
  node/target/parameter order;
- use continuation lines deterministically when a bounded line length is
  exceeded;
- close every block with `.ends <name>`;
- emit a structural library, not an implicit analysis deck; do not add `.end`
  unless the accepted syntax contract explicitly requires it.

Spectre `.scs` release:

- emit `simulator lang=spectre` and the same exporter contract version;
- emit `global`, `subckt`, and `ends` using Spectre spelling;
- place device nodes in parentheses;
- map primitive device classes and their value keys explicitly (for example,
  resistor `r=`, capacitor `c=`, and inductor `l=`);
- preserve model/subcircuit names and raw parameter expressions;
- emit no `include`, `parameters`, analysis, save, or options statement unless
  supplied by a later typed simulation-deck contract.

Identifiers must be validated against the target dialect before rendering.
The first release should reject incompatible user identifiers rather than
silently rename explicit user facts. Only automatically generated identifiers
may be sanitized by construction.

## Diagnostic Contract

Diagnostics must carry stable code, severity, document/object IDs, and a
specific repair message. Initial blocking coverage must include:

- duplicate/invalid cell name;
- missing, duplicate, invalid, or mismatched cell port order;
- unconnected Port without `NoConnect`;
- unnamed global Net;
- duplicate or invalid explicit Net name;
- Net membership referencing an unknown instance, pin, or Port;
- one terminal/Port assigned to multiple Nets;
- missing/duplicate/invalid instance reference;
- missing device-netlist definition;
- missing required model/subcircuit target;
- missing required parameter;
- required pin absent from the symbol, Net membership, or child interface;
- unexpected extra pin mapping;
- unresolved/mismatched child cell;
- hierarchy cycle;
- parameter/name resource-limit violation;
- a symbol/device class supported by one printer but not the requested dialect.

Warnings may describe generated local Net names or preserved source provenance,
but warnings cannot disguise a fact required for electrically meaningful
output. The UI must never download output while an error exists.

## Work Packages

### WP0 — Accept the boundary and examples

1. Add `docs/specs/netlist-export.md` with the design-netlist versus simulation-
   deck distinction, authorities, schemas, diagnostic policy, and dialect
   subsets.
2. Update the spec index and cross-reference the schematic, Project format,
   Symbol DSL, Circuit IR, and SPICE frontend specs.
3. Decide in an ADR whether the schema change and separate output IR/package
   are sufficiently architectural to require a durable decision record.
4. Convert the two user examples into a capability matrix only; do not copy
   foundry paths or model data into repository fixtures.

Exit gate: every exported token has one named authority and every unsupported
line in the examples is assigned to either the later simulation-deck contract
or an explicit rejection.

### WP1 — Persist typed electrical export facts

1. Advance the Project schema version and add the accepted cell interface,
   instance reference, binding, and parameter fields.
2. Add a migration from the current schema. Migrate known imported
   `spice.name`, binding evidence, ordered `spice.pin.Pn`, and
   `spice.param.*` only when the existing typed/source evidence makes the
   mapping unambiguous.
3. Assign deterministic references to ordinary legacy manual instances; never
   infer a MOS model or external subcircuit target.
4. Preserve unresolved legacy facts as explicit diagnostics, not invented
   defaults.
5. Update canonical serialization and schema fixtures.

Exit gate: save/load/save remains byte-canonical; old fixtures migrate; no
electrical relationship or foundry target is guessed.

### WP2 — Establish the reviewed device registry

1. Define and validate `DeviceNetlistDefinition`.
2. Register every currently authorable electrical symbol.
3. Validate prefix, pin order, required parameters, target policy, hidden-pin
   behavior, and `net-marker` omission.
4. Integrate hierarchical block definitions using child Port order rather than
   static catalog assumptions.
5. Keep PDK visual mappings separate from library/include configuration.

Exit gate: every current authorable electrical symbol is either exportable with
a complete reviewed definition or deliberately rejected with a test.

### WP3 — Add explicit authoring and edit operations

1. Add typed edits for cell name/port order and instance reference/binding/
   parameters.
2. Allocate references at insertion time without reading annotation text.
3. Extend component Properties with Reference and, where required, Model or
   Child Cell; preserve existing R/C/L and W/L/M inputs as typed parameters.
4. Add a Port-order editor at the cell/document level.
5. Ensure undo/redo, clipboard, delete, project save/reopen, and source-status
   transitions cover the new facts.

Exit gate: a human can make a manually drawn supported circuit export-complete
without editing JSON.

### WP4 — Extract and validate DesignNetlistIR

1. Create `packages/netlist` with schemas/types, stable naming, hierarchy
   resolution, extractor, and diagnostics.
2. Consume only Project electrical facts, the connectivity index, and the
   reviewed device registry.
3. Prove Route/geometry/annotation independence by exporting Projects that
   share logical connectivity but have different presentation.
4. Add deterministic ordering and resource bounds.
5. Add hierarchy, global/ground, unnamed-Net, hidden-bulk, `NoConnect`, and
   unsupported-device tests.

Exit gate: repeated extraction is deep-equal; presentation-only edits do not
change IR; every invalid fact produces a stable diagnostic.

### WP5 — Implement SPICE and Spectre structural printers

1. Implement pure printers and filename/media-type metadata.
2. Add compact golden fixtures for flat RLC, four-terminal MOS, global/ground,
   hierarchy, parameters, and line continuation.
3. Reparse generated `.spi` through the current SPICE frontend and compare
   normalized structure against the source IR where the accepted input/output
   subsets overlap.
4. Validate `.scs` against grammar-focused goldens; if a licensed Spectre
   executable is unavailable, record that limitation without claiming
   simulation validity.
5. Confirm byte-identical output across repeated runs.

Exit gate: both printers cover the same accepted design semantics and differ
only where dialect syntax requires it.

### WP6 — Integrate export UX

1. Add File → Export → `SPICE (.spi)` and `Spectre (.scs)`.
2. Run extraction/validation before creating a Blob.
3. Show blocking diagnostics with links/selections for affected cells,
   instances, Nets, and Ports.
4. Show a clear “structural netlist; simulation setup not included” message.
5. Reuse safe project filename normalization and existing download behavior.
6. Add browser tests covering a manually authored circuit and an imported
   multi-cell circuit.

Exit gate: valid Projects download correct extensions and bytes; invalid
Projects download nothing and identify the repair required.

### WP7 — Later simulation-deck system (separate follow-up target)

Only after structural export is accepted, design a new typed contract for:

- user-selected relative/absolute library references with explicit path policy;
- SPICE `.include`/`.lib` and Spectre `include ... section=` distinctions;
- process corner, global/project parameters, temperature, and simulator scale;
- structured DC/AC/transient/noise analyses;
- structured voltage/current stimuli;
- save/probe/output selection;
- one or more named simulation profiles per Project.

This follow-up composes a simulation profile with the design-netlist IR. It
must not place simulator directives into Net, Instance, Symbol, or drawing
contracts, and it must never discover a PDK from the host filesystem.

## Validation

Focused development checks, expanded by work package:

- Model schema/migration/persistence tests;
- Symbol registry validation and current-catalog completeness tests;
- Edit Engine typed-edit, undo/redo, clipboard, and source-status tests;
- DesignNetlistIR extraction and diagnostic tests;
- SPICE reparse/structural-equivalence tests;
- Spectre syntax goldens and optional licensed-simulator parse checks when
  available;
- editor unit tests and focused Playwright download/diagnostic flows;
- targeted formatting and workspace typecheck after each shared-contract step;
- `git diff --check` and `git status --short --branch` at every target boundary.

Risk requires broader validation when the persisted schema, Symbol DSL, Edit
Engine API, or workspace package graph changes. Before delivering any
non-document implementation to `main`, run from a clean dependency/build state:

```powershell
pnpm install --frozen-lockfile
pnpm ci:check
```

Then push the review branch and require the corresponding GitHub Actions checks
to pass. A successful focused test or local export does not satisfy the mainline
delivery gate.

Electrical acceptance for v1 is structural, not simulated:

- emitted cell interfaces match persisted Port order;
- every emitted instance node matches explicit Net membership and pin order;
- explicit model/subcircuit targets and raw parameters are preserved;
- no PDK library, device value, Net relationship, stimulus, or analysis is
  guessed;
- SPICE generated output reparses to the same normalized structure;
- Spectre output matches the accepted structural grammar fixtures;
- identical input produces identical bytes.

## Commit Strategy

Keep work reviewable and avoid one schema/UI/printer mega-commit. Intended
commit sequence:

```text
docs(netlist): define deterministic export contracts
feat(model): persist netlist cell and instance facts
feat(symbols): add reviewed device netlist definitions
feat(editor): author typed netlist properties
feat(netlist): extract validated design netlist IR
feat(netlist): print SPICE and Spectre structures
feat(editor): expose structural netlist downloads
docs(plan): close deterministic netlist export target
```

Each commit must leave the workspace type-correct and must include the focused
tests for the behavior it introduces. If schema, package ownership, or UI work
proves independently reviewable, split it into child target plans before
editing rather than allowing this plan to become an unbounded implementation
record.

## Open Decisions to Resolve in WP0

1. Whether to keep the current top-level `Instance.binding` JSON field and
   rename only its TypeScript meaning, or introduce a nested `netlist` record.
   The accepted result must have one authority and one migration path.
2. Whether explicit user identifiers outside the shared SPICE/Spectre subset
   are rejected for both formats or supported through a typed dialect-specific
   alias. Silent renaming is not allowed.
3. Whether independent voltage/current sources enter structural export v1 with
   a small structured source-spec contract, or remain blocked until the
   simulation-deck target. RLC/MOS/hierarchy must not wait on this decision.
4. Whether `.spi` structural-library output ends without `.end` or uses a
   versioned option. The output must not masquerade as a runnable top-level
   analysis deck.
5. Whether `packages/netlist` owns both printers or exposes IR to thin dialect
   modules. Avoid reusing import `CircuitIR` or visual `packages/exporters` for
   convenience.

## Outcome

Delivered a deterministic, program-only structural netlist pipeline. Project
schema v4 persists explicit Cell names/Port order and Instance references,
typed binding targets, and raw parameters; migration/import write those facts
without inventing a PDK model. The reviewed Symbol registry owns device class,
reference prefix, pin order, target policy, and required parameters.

The new `@icm/netlist` package validates the reachable hierarchy and produces a
dependency-first dialect-neutral IR. It assigns stable transient names only to
unnamed local Nets and blocks invalid/missing identifiers, globals, ports,
pins, references, targets, parameters, child mappings, cycles, and unsupported
devices. Pure printers emit structural SPICE `.spi` and Spectre `.scs` files
with deterministic ordering and no `.include`/`include`, corner, stimulus,
analysis, save, or deck `.end` inference.

The editor now assigns references on insertion and copy, exposes Cell and
Instance netlist properties, and offers both downloads from File > Export.
Export errors prevent download and appear as clickable diagnostics that locate
the affected Cell or electrical object. The UI explicitly labels the output as
a structural design netlist without simulation setup or PDK includes.

Validation completed from a frozen lockfile with `pnpm ci:check`: formatting,
pinned references, workspace typecheck, 113 unit-test files / 693 tests,
release and production smoke checks, performance budgets, export/PWA goldens,
and 101 Playwright tests all passed. Generated SPICE is reparsed by the current
SPICE frontend; Spectre uses deterministic grammar-focused goldens because no
licensed Spectre executable is available in this environment. Simulation-deck
profiles and ordered external-subcircuit interfaces remain intentionally
deferred to WP7. All implementation work is committed on
`codex/netlist-export-system`; the target closes with `experience: none`.
