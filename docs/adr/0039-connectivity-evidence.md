# ADR 0039: Connectivity Evidence and Schema 22

Status: accepted

Date: 2026-08-23

Owners: `packages/model`, `packages/project-protocol`, `packages/spice`,
`packages/derived`, `packages/edit-engine`, `packages/netlist`, `apps/editor`

## Context

One persisted `Net` currently carries structural membership, logical identity,
display name, and import provenance. Semantic operations such as placing a Net
Label or Free Port therefore merge Base Nets destructively. Once the last
visible owner is removed, the system cannot tell whether connectivity remains
because of another label, an explicit name, a SPICE source assertion, or a
physical conductor. Export, ERC, highlight, and routing guidance can also drift
when they reconstruct those meanings independently.

## Decision

Schema 22 adds `Document.connectivityEvidence`, a strict list of stable,
owner-addressable facts:

- `name-claim` binds one Base Net and name/scope to a Net Label, Free Port,
  power marker, or explicit Net property owner;
- `spice-source` binds one Base Net to one source Net identity and optional
  source span;
- `explicit-equivalence` declares a bounded set of two or more Base Nets to be
  logically equivalent.

Evidence IDs share the Document object namespace. Every referenced Net and
owner must exist, and repeated equivalence members are invalid. Deleting an
owner will therefore delete its evidence rather than destroy another owner's
fact. A later resolver target will derive Logical Nets from Base Nets, physical
topology, evidence, hierarchy edges, and global scope; all exporter and editor
consumers will use that one result.

L3 is deliberately transitional: `Net.name` and `Net.origin` remain readable
projections so current producers and consumers do not change semantics in the
schema commit. The schema-21 adapter creates deterministic explicit-property
claims for retained Net names, label-owned claims for existing Net/power
labels, and source assertions for imported origin membership. It cannot infer
historical destructive merge lineage and does not invent equivalence evidence.
Fresh SPICE import writes source assertions directly. Subsequent L4/L5 targets
move semantic producers and consumers to evidence before retiring legacy
authority.

The first L4 mutation layer uses two ordinary typed edits only:
`upsert_connectivity_evidence` and `remove_connectivity_evidence`. They share
the existing transaction, revision, validation, diff, Undo, and rollback
contracts. Deleting an addressable owner removes only its claim; non-owner
assertions remain explicit. Evidence also participates in local-Net
reachability, and Reset Cell Body retains evidence only when its complete
owner/Net reference closure survives. These edits remain unsupported by the
retired Agent product.

Per ADR 0023, schema 22 reads current schema 22 and previous schema 21 only.
Schema 20 rolls off; persistence writes schema 22.

## Consequences

- Name and source ownership become inspectable and independently removable.
- The migration is deterministic and stable-ID based, but cannot reverse
  information already destroyed by an older merge.
- The additive transitional fields avoid a flag-day rewrite of authoring,
  export, ERC, and hierarchy code.
- Evidence itself does not join Nets until the shared resolved-connectivity
  consumer migration lands; schema presence is not a second hidden resolver.
