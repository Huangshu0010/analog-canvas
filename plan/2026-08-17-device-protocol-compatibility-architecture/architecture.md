# Device Protocol and Project Compatibility Architecture

Status: planning record for the next implementation targets

Primary owners: `packages/model`, future `packages/devices`,
future `packages/project-protocol`, and `packages/symbols`

## Purpose

Make device evolution and Project compatibility first-class, independently
maintainable concerns while retaining the current product behavior. This plan
is deliberately narrower than a general plug-in or damaged-file recovery
system: it establishes clear ownership and one bounded compatibility boundary,
not a matrix of independently versioned persisted modules.

## Current baseline

The current persisted format is Project schema 11. The reader accepts schema
11 and directly advances schema 10 to schema 11, then validates only the
current `CircuitProjectSchema`. The serializer writes schema 11 only. The
current model is strict, the Edit Engine is the sole committed mutation path,
and `Net.terminals` remains the connectivity authority.

Current device facts are split between:

- `packages/model/src/schema.ts`: Instance shape and generic netlist facts;
- `packages/symbols/src/schema.ts`: Symbol geometry and canonical pins;
- `packages/symbols/src/netlist.ts`: device class, pin order, required
  parameters, reference prefix, and dialects.

The plan centralizes those facts without changing their meaning.

## Non-negotiable invariants

The first implementation sequence is a behavior-preserving refactor. Until a
separate, explicitly approved persisted protocol change occurs, all of the
following must remain identical:

- Project schema version 11 and canonical Project JSON;
- every current `symbolId`, Symbol pin name/order/anchor, and visual variant;
- Instance properties and typed netlist data;
- reference prefixes, required parameters, target policies, and SPICE/Spectre
  output;
- MOS D/G/S/B behavior, implicit bulk defaults, and explicit bulk override;
- Net membership, Route endpoints, Junction behavior, and formal cell
  terminals;
- editor Properties, placement, undo/redo, Agent mutation, import, recovery,
  export, save, and reopen behavior.

The work must not add a persisted `deviceKind`, revise current Instance JSON,
or reinterpret `symbolId`. A future need to separate device identity from
visual identity is a new protocol decision, not part of this refactor.

## Target module boundaries

```text
Project JSON
     |
     v
project-protocol  --->  current model  <---  devices
                              ^
                              |
                           symbols
```

### `packages/model`

Owns only the current normalized circuit model and its structural invariants:

- Project, Document, Instance, Net, Route, Junction, Annotation, Drafting,
  layout, and source data shapes;
- local and cross-object current-model validation;
- stable model types and factories.

It has no historical Project parsing, serialization policy, migration adapter,
or dependency on a concrete device registry.

The existing monolithic schema source is split by responsibility, while public
exports remain stable:

```text
packages/model/src/schema/
  common.ts
  source.ts
  instance.ts
  connectivity.ts
  routing.ts
  rich-text.ts
  annotations.ts
  drafting.ts
  presentation.ts
  document.ts
  project.ts
  validation.ts
  index.ts
```

The composed `InstanceSchema`, `SchematicDocumentSchema`, and
`CircuitProjectSchema` retain their existing public names and behavior.

### `packages/devices`

Owns the current electrical and netlist contract for built-in devices. It is
the sole registry for facts currently duplicated across model and symbol
netlist definitions:

- canonical Symbol association;
- pin names and formal pin order;
- device class and reference prefix;
- required parameters and target policy;
- supported dialects;
- explicitly existing capabilities, including MOS bulk support.

Each device resides in one descriptor file. Its first identifier is the
existing `symbolId`; this preserves current behavior and avoids a new
persisted identity field.

```ts
interface DeviceDescriptor {
  readonly symbolId: string;
  readonly deviceClass: string;
  readonly pins: readonly string[];
  readonly referencePrefix: string | null;
  readonly requiredParameters: readonly string[];
  readonly targetPolicy:
    | "builtin"
    | "required-model"
    | "child-cell"
    | "none";
  readonly dialects: readonly ["spice", "spectre"];
  readonly capabilities: {
    readonly supportsModel: boolean;
    readonly supportsBulkBinding: boolean;
    readonly supportsValueAnnotation: boolean;
  };
}
```

The Registry validates descriptor uniqueness and parity with Symbol pins. It
does not become a second mutation engine or a second persisted Project schema.

### `packages/symbols`

Continues to own only visual Symbol definitions, geometry, variants, and
resolution. It validates that its canonical pins agree with the corresponding
device descriptor, but does not own netlist parameter or pin-order truth.

### `packages/project-protocol`

Is the sole Project file boundary. It owns:

- JSON parsing and structured diagnostics;
- current and previous Project version recognition;
- the one direct previous-to-current adapter;
- current-model validation after adaptation;
- canonical current-only serialization.

It depends on current model contracts and the device/symbol validation surface.
Model and devices do not depend on this package, preventing a compatibility
dependency cycle.

## Device Registry implementation rule

The first registry is a source-of-truth consolidation, not a behavior rewrite.
Before removing existing definitions, a registry contract verifies descriptor
parity for every built-in device:

- Symbol pins equal descriptor pins in order;
- descriptor pin order equals netlist output order;
- current reference prefix, target policy, and required parameters match;
- every current SPICE/Spectre behavior remains available.

MOS bulk semantics remain in the current model/Edit Engine path. The MOS
descriptor records that the device supports that behavior; it must not replace
or infer bulk connectivity.

Adding a device that existing generic Instance data can express is a device and
Symbol addition, not a Project schema upgrade. Changing persisted fields,
pin names/order, parameter representation, or electrical meaning of an
existing device is a Project protocol change and requires the compatibility
process below.

## Compatibility policy

### One root version

Project files retain one integer `schemaVersion`. Code may use module-local
transform helpers, but files do not carry independently mutable device,
routing, or annotation versions. This avoids a combinatorial version matrix
while preserving code ownership.

### Rolling N-1 read window

At every release, the reader accepts only current and exactly one named
previous Project version:

```text
Current Project version: N
Accepted reader inputs: N and N - 1
Serialized output: N only
Rejected: < N - 1 and > N
```

The current v10-to-v11 behavior is retained under this policy. When a future
schema 12 is introduced, v11-to-v12 replaces v10-to-v11; the earlier adapter
is deleted rather than retained as a chain.

### Direct adapter rule

Compatibility retains only:

- the previous version constant;
- one previous-to-current transform;
- focused tests for fields changed by that transform.

It does not retain an old Zod schema, old runtime type, old serializer, old
fixture archive, compatibility-shaped editor mode, or sequential registry.

The adapter works on parsed raw JSON, makes only deterministic transformations,
then validates the output through current schemas. It must reject ambiguous
electrical facts rather than infer them.

```text
JSON parse
-> root schemaVersion check
-> current: validate current model
-> previous: direct raw transformation
-> validate current model and device/symbol parity
-> open one current runtime Project
```

### Load and save API

The file boundary exposes a compact result, rather than throwing into the UI:

```ts
type ProjectLoadResult =
  | {
      ok: true;
      project: CircuitProject;
      sourceSchemaVersion: number;
      migrated: boolean;
    }
  | {
      ok: false;
      diagnostics: readonly ProtocolDiagnostic[];
    };
```

On failure, the editor keeps its existing Project, reports diagnostics with
data paths, and never modifies the chosen source file. On migration, the file
opens as current data and requires an explicit user save; serialization always
writes only the current version.

The normal loader remains strict. This plan does not add automatic field
dropping, partial Document loading, a degraded editor, or guessed electrical
repair. If real user data later demonstrates a safe recovery need, it must be
introduced as a separate repair-tool target with an explicit save-as policy.

## Version-change decision rule

| Change | Project schema upgrade |
| --- | --- |
| Symbol artwork, label placement, or UI behavior with identical persisted facts | No |
| New device expressible by existing Instance data | No |
| Internal implementation refactor with identical semantics | No |
| New required persisted field | Yes |
| Existing pin rename/order change | Yes |
| Parameter persistence representation change | Yes |
| Existing electrical meaning changes | Yes |
| MOS bulk persistence/meaning changes | Yes |

Any `Yes` requires: a new current schema version, replacement N-1 adapter,
focused migration tests, current-only serializer validation, documentation
update, and ordinary mainline validation. It does not require retaining an
older full protocol.

## Test ownership and validation

The plan follows the repository rule of one primary test layer per behavior.

| Contract | Primary protection |
| --- | --- |
| Current model local/cross-object invariants | `packages/model` unit/module tests |
| Built-in descriptor/Symbol/netlist parity | `packages/devices` registry contract test |
| Typed mutation preserves device constraints | focused `packages/edit-engine` contract tests |
| Previous-to-current parse and rejection boundary | `packages/project-protocol` module tests |
| Imported previous Project, edit with current capability, save/reopen | one focused editor browser workflow |

Canonical fixture files remain current-version only. Migration tests use small,
local raw inputs for the fields actually transformed; they are evidence for the
one adapter, not a reusable historic fixture corpus.

Every behavior-preserving extraction validates that canonical Project output,
netlist output, device descriptor parity, and existing focused editor behavior
are unchanged. The final implementation target runs its focused tests first;
because this work crosses model, symbols, persistence, Edit Engine, and editor
boundaries, it also justifies `pnpm verify:branch`, and mainline delivery still
requires frozen install, `pnpm ci:check`, and green GitHub Actions.

## Implementation sequence

### Target A — behavior inventory and refactor guardrails

Add only missing focused contract coverage for current device behavior and map
each behavior to its primary owner. No shape, output, or protocol changes.

Acceptance: all named current device contracts are explicit; no Project JSON,
netlist, or visual output change.

### Target B — split current model schema source

Move code into the model schema modules above, preserving exports and
composition exactly. Keep `schemaVersion: 11` and existing persistence entry
points unchanged.

Acceptance: type checking, current model tests, canonical serialize/reopen,
and relevant editor contracts show no behavior change.

### Target C — extract the device registry

Create `packages/devices`, move the existing device/netlist facts into one
descriptor registry, wire symbols and netlist export to it, and remove the old
duplicate authority only after parity tests pass.

Acceptance: every built-in Descriptor agrees with its Symbol and netlist
behavior; MOS bulk and current exports remain unchanged.

### Target D — extract the Project protocol boundary

Move version detection, direct migration, diagnostics, and current-only
serialization from model persistence into `packages/project-protocol`. Update
editor file/recovery callers to the compact result API. Preserve current
v10-to-v11 behavior exactly.

Acceptance: current files, previous files, rejection cases, recovery metadata,
explicit migrated save, and browser save/reopen behavior are unchanged.

### Target E — future persisted protocol change

Only when a product change actually needs it, advance to schema 12 and replace
the direct adapter as described above. This is intentionally not part of
Targets A-D.

## Explicit non-goals

This architecture does not introduce:

- per-module persisted versions or arbitrary version combinations;
- per-device persisted version numbers;
- a plug-in protocol or third-party device execution model;
- a migration registry or historical adapter chain;
- old model schemas, runtime types, serializers, or fixture archives;
- persisted `deviceKind` or a changed Instance JSON shape;
- automatic loss-tolerant loading, guessed electrical repair, or a complex
  recovery editor;
- a second edit/mutation path.

## Delivery and documentation rule

This planning record is not itself an accepted product contract. Before Target
A begins, create an ADR that records this architecture decision and updates the
current documentation reading set if accepted. Each implementation target then
gets its own bounded plan, test-impact declaration, log entry, review branch,
and validation record.
