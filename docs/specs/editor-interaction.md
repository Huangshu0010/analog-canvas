# Editor Interaction

Status: `accepted`

Primary owner: `apps/editor`

The browser editor is a direct-manipulation client over one current
`SchematicDocument`. Human and Agent mutations enter the same Edit Engine,
revision, validation, undo, rendering, and recovery boundaries.

## Components and Ports

The insertion UI lists only exact reviewed Symbol IDs. Both `port` and
`port-filled` remain ordinary manually reachable components. Choosing either
starts the same placement state as any component; terminal `P` participates in
ordinary snap, wire, move/stretch, selection, clipboard, and delete behavior.
No canvas interaction creates a first-class Port object.

Canonical `nmos`/`pmos` use the asset's `textbook-3terminal` visual variant by
default while retaining D/G/S/B electrically. A B connection is explicit or
uses an existing configured cell-default Net. The editor never creates a
synthetic VDD/ground Net or applies a product fallback.

Ground is the `ground` component connected through pin `0`. VDD Rail is a
separate two-click construction tool. It creates/reuses an explicit global VDD
Net, creates two route-anchor Junctions and one `power-rail` Route, and persists
one RichText power-label annotation. It creates no VDD Instance.

## Interaction states

```text
Pointer
  -> BoxSelect -> Pointer
  -> MoveSelection -> Pointer
  -> ComponentDialog -> PlaceComponent -> Pointer
  -> Wire -> Pointer
  -> VddRail(first point) -> VddRail(second point) -> Pointer
  -> TextEdit -> Pointer
```

Escape cancels the active preview without mutation. A committed gesture is one
atomic transaction. Hover, geometric crossing, selection, and preview never
change connectivity. A wire endpoint or explicit segment tap is required to
create contact.

## Text and presentation

Every visible editable label is one persisted RichText annotation. Component
insertion creates an `instance-label` only when reference display is requested.
The renderer never synthesizes text from Instance IDs and no empty suppressor
label exists. Net/power labels carry Net identity separately from their visual
anchor. Drafting text has no electrical meaning.

## Files, recovery, and replacement

Open, demo load, restore, and human-approved staged import replace the entire
Project through one replacement boundary; they are not Edit Engine
transactions. Replacement cancels pending recovery for the outgoing Project
and terminates its Agent session. Only complete schema-9 Projects are accepted;
the editor performs no migration.

Selection, viewport, active tool, previews, Agent tokens, and approval UI are
transient and never enter Project JSON. Recovery is scheduled only after a
successful transaction or explicit replacement and stores no bearer token.

## Agent semantic control

API 2.0 may advertise optional `semanticControl` for transient review focus:
select a canonical locator, highlight a Net, activate/fit an existing Cell, or
clear focus. It cannot send pointer events, keystrokes, CSS, selectors, DOM
queries, or arbitrary zoom matrices. Semantic control never changes revision,
topology hash, history, recovery, or formal export.

## Deterministic validation

- state-transition and shortcut focus-guard unit tests;
- component placement and ordinary terminal connectivity for both Port assets;
- VDD rail creation with no VDD Instance and one explicit VDD Net;
- canonical MOS default-variant and explicit bulk behavior;
- move/stretch, segment tap, crossing non-connectivity, cancel, delete, and
  undo/redo tests;
- annotation-only label rendering with no duplicates;
- GUI/Agent transaction parity;
- Playwright flows for insertion, wiring, transformation, save/reopen, staged
  candidate isolation, human replacement approval, and formal export.
