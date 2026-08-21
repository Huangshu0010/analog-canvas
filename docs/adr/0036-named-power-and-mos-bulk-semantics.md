# ADR 0036: Named Power Nets and Explicit MOS Bulk Policy

Status: accepted

Date: 2026-08-21

## Context

The editor previously overloaded `global VDD` with three unrelated jobs: Net
identity, visible Rail/Port presentation, and the default PMOS bulk target.
That made a VDD Rail unique by convention, prevented ordinary AVDD/DVDD use,
and allowed placing a MOS to invent electrical connectivity that the user had
not authored.

## Decision

- Power Net identity is its ordinary authored Net name within one Document.
  Same-folded names select the same Net; `VDD`, `AVDD`, and `DVDD` are distinct.
- `Net.powerDomain` is classification metadata, not identity. Multiple Nets may
  carry `powerDomain: "vdd"`.
- A manually placed VDD Port and a Rail named `VDD` create or reuse the same
  Document-local Net. An explicitly loaded/imported global Net of that name is
  preserved and may also be reused; authoring does not silently change scope.
- `add_power_rail` carries `netName`, `scope`, and `powerDomain: "vdd"`.
  Its label is a `net-name` binding, so rendering and later rename share the
  existing RichText/Razavi text system.
- MOS bulk resolves only from explicit B membership or an explicitly configured
  `mosBulkDefaults` Net. Without either, it remains unresolved. Device polarity
  and visible supply artwork never create or select a Net.
- Existing persisted `supply-default` bindings remain readable for rolling
  compatibility, but new manual authoring does not create them.
- Ground node `0` keeps its existing explicit global SPICE-reference behavior;
  generalizing ground naming is outside this hotfix.

Across Documents, matching text alone does not create a Project-wide
connection. Hierarchical interfaces or an explicit imported/global declaration
remain the authority.

## Consequences

The editor can draw any number of same- or differently-named power projections,
VDD Port and VDD Rail coexist without duplicate Nets, and deleting the last
projection allows the ordinary orphan-Net lifecycle to remove its unused local
Net. Bulk policy is now visible configuration rather than an implicit global
supply side effect.

## Non-goals

This ADR does not add Agent planning features, change Formal Port cardinality,
or introduce automatic rerouting.
