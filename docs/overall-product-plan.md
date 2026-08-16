# Current Product Architecture

Analog Canvas is a local-first schematic editor. A human edits a circuit in the
browser, while an authorized Agent may inspect and modify the same live Project
through typed, revision-checked requests. The product is an editor and a
structural circuit tool; it is not a simulator, cloud Project store, or general
browser-automation service.

## Product boundary

The editor accepts structural SPICE input, manual component placement, wires,
text, and limited drawing annotations. It persists a canonical
`.icproj.json` Project, exports SVG/PNG/PDF, and can create deterministic
structural SPICE or Spectre design netlists once all required design facts are
explicit. Source SPICE, simulation decks, PDK setup, analyses, and browser
recovery copies are not authoritative Project data.

The authoritative sources are deliberately separate:

| Concern                            | Authority                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Persisted circuit facts            | Project schema and `@icm/model`                                                  |
| Human and Agent mutations          | `@icm/edit-engine` transactions                                                  |
| Symbol electrical semantics        | `@icm/symbols`                                                                   |
| Visual construction and acceptance | Razavi reference manifest and [visual contract](specs/razavi-visual-contract.md) |
| SPICE import                       | `@icm/spice` transient Circuit IR                                                |
| Design-netlist export              | `@icm/netlist` transient DesignNetlistIR                                         |
| Browser Agent session              | accepted [web-session spec](specs/web-agent-session.md)                          |

## System shape

```text
human UI / authorized Agent
            │ typed, revision-checked edits
            ▼
      Schematic Edit Engine
            │ validates and atomically applies
            ▼
       Project and Document model
        ├─ derived connectivity and diagnostics
        ├─ SVG/PNG/PDF formal export
        ├─ structural SPICE/Spectre export
        └─ canonical Project persistence
```

Both actors use the same edit engine. The UI is responsible for interaction,
file choice, and presentation; the Agent transport is responsible only for
scoped authentication and forwarding. Neither can bypass electrical,
revision, lock, or transaction invariants.

## Core invariants

- Net membership, explicit Junctions, formal cell terminals, and typed Instance
  terminals are
  electrical facts; drawing geometry never silently creates a connection.
- A Crossing is not a Junction. Ambiguous intersections are rejected rather
  than guessed.
- Routes describe visible geometry; they may stretch locally during movement
  without changing logical connectivity.
- A Project is a canonical schema-11 JSON file. Browser recovery is an
  origin-local, non-authoritative copy.
- Visual variants may change presentation but never remove electrical terminal
  semantics. The Razavi raster manifest is the sole visual authority; Visio/VSS
  is retired historical evidence by [ADR 0011](adr/0011-retire-visio-vss-as-visual-authority.md).
- An Agent reads a complete Snapshot, submits typed edits with an expected
  revision, and refreshes after a conflict. It does not infer a second command
  language or mutate through DOM automation.

## Where to read next

- User workflows and limits: [user guides](user/getting-started.md).
- Stable behavior: [normative specifications](specs/README.md).
- Why shared boundaries exist: [architecture decisions](adr/README.md).
- How an Agent should operate: [Agent workflow](agent/workflow.md).
- Remaining cross-module work: [roadmap](roadmap/README.md).

Historical delivery records and retired evidence live under
[archive/](archive/README.md). They do not define current behavior.
