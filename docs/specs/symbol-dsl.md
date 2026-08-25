# Symbol DSL

Status: `accepted`

Primary owner: `packages/symbols`

The Symbol DSL defines runtime-independent electrical pins, reviewed vector
geometry, and visual variants. Runtime resolution is exact by canonical asset
ID; symbol aliases and compatibility libraries do not exist.

## Current product assets

The product library is exactly the reviewed Razavi catalog: `nmos`, `pmos`,
`npn`, `pnp`, resistor, capacitor, inductor, diode, ground, voltage/current
sources, op-amp, switches, voltage amplifier, `port`, and `port-filled`.
VDD is not an asset; the editor constructs an explicit Net/Route rail.

Both interface-marker assets are ordinary single-pin components with pin `P`.
Their future selection policy is intentionally unspecified; both remain
manually reachable through the same insertion, placement, snapping, wiring,
transform, and delete mechanisms as every other component.

Canonical `nmos` and `pmos` retain D/G/S/B electrical pins. Their
`textbook-3terminal` visual variant is the deterministic default and may hide
bulk presentation without deleting the B electrical terminal. Separate
`nmos3`/`pmos3` assets do not exist.

## Resolution and variants

`SymbolResolver.resolve(symbolId, variantId?)` returns the exact validated
definition and either the requested variant or the definition's declared
default. Unknown asset or variant IDs return `undefined`; resolution never
substitutes a different pin order or asset.

A visual variant may hide named pin presentation or named primitive parts and
add reviewed presentation primitives. It cannot add, delete, reconnect, or
rename electrical pins. Selecting `textbook-3terminal` never implies `B=S`.

## Geometry and style

Primitives are line, polyline, polygon, circle, and path. Pins carry stable
name, electrical role, anchor, direction, and visibility metadata. Pin anchors
lie on the canonical 10-unit electrical grid; artwork may use finite decimal
coordinates. Razavi assets use semantic stroke roles resolved through the
Document style profile. Raw per-asset compatibility widths are not accepted.

A reviewed auxiliary/variant pin contact may be off that grid only when its
`routing` metadata declares an outward, grid-aligned `preferredLanding`.
Registration rejects a landing behind or transverse to the pin direction.
Runtime resolves the exact contact and the landing as one
`EndpointConnection`; the Symbol never persists a Document Route escape.

## Invariants

- Symbol IDs and pin names are unique.
- Every hidden pin or primitive part names an existing member.
- Hidden or implicit pins retain electrical membership while disappearing from
  visible snap/flightline/formal-pin presentation.
- Geometry contains no placement, Net, model, or reference-label authority.
- PDK mappings name an exact canonical symbol, terminal count, and full ordered
  pin list; no mapping is inferred from model spelling alone.
- `@icm/devices` separately owns class, reference prefix, canonical pin order,
  target policy, required parameters, dialects, and capabilities. Symbols own
  artwork and anchors only; registry/Symbol pin parity is a cross-package
  contract.

The application ships the compiled catalog and a Project persists only exact
symbol and optional variant IDs plus its library lock. Generated catalog tests
prove every advertised asset resolves and that retired IDs and aliases fail.
