# Troubleshooting v0.1

## Import says the entry is ambiguous

Choose exactly one `.cir`, `.sp`, or `.spi` entry. If a directory contains one
`circuit.spi`, it is preferred. Include every local `.inc` or `.lib` file used
by the entry.

## A crossing is not connected

This is intentional. Add a Junction dot at the connection. Never infer an
electrical join from geometry.

## A SPICE statement is reported as opaque

Opaque text is preserved exactly but is not editable circuit semantics yet.
Consult the compatibility matrix and keep the diagnostic when reporting a
missing vendor construct.

## Recovery is corrupt

The app rejects and discards an invalid browser recovery record; it does not
touch formal Project downloads. Reopen the last formal `.icproj.json` and
repeat the unsaved edit.

## PNG or PDF export fails

Confirm that Canvas 2D and Blob downloads are permitted by the browser. SVG is
the canonical fallback and contains the same formal scene.

## The portable host does not start

Use Node 24 or newer and ensure port 4173 is free. The v0.1 host intentionally
does not accept a LAN address. Use `pnpm dev` for a different development port.

## Agent API requests fail

The static host does not enable Agent access. Start the optional Agent adapter
explicitly, use a token of at least 32 characters, and send requests only to
its loopback JSON endpoint. See `docs/agent/usage.md`.
