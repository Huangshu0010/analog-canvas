# Project File Compatibility

The released Project schema version is `15`. It retains schematic-only
hierarchy integrity, a Project structural revision, stable formal Cell ports,
and definition-level Cell symbol presentation. It also has one typed Instance
netlist authority, formal Cell parameters, and Project-local external
subcircuit definitions with stable ordered terminal identities and directions.
A canonical v15 file can be opened, saved, reopened, and saved again without
byte drift.

Schema v14 is accepted through one direct upgrade to v15. It does not remain a
v14 Project in the editor: external-subcircuit terminal IDs, passive
directions, and declared interface status are added deterministically, and the
next save writes v15. The original file is never overwritten silently. Schema
v13 and older, and versions newer than v15, are rejected; there is no
accumulating migration registry.

The canonical-current corpus at
[`fixtures/projects/compatibility-corpus.json`](../../fixtures/projects/compatibility-corpus.json)
lists every shipped Project fixture. It distinguishes byte-stable accepted
files from named rejected inputs. Previous-version compatibility uses a
focused synthetic regression instead of retaining historic Project assets.
Retired fields such as first-class
`Document.ports`, `Net.ports`, `spice.*`, and `routeAttachment` are invalid.

An incompatible Project is rejected before it can replace the current browser
Project. Conversion, when needed, is an explicit external operation that must
produce and validate a complete v15 candidate before a human chooses to load it.

The editor never silently merges duplicate canonical Ground (`0`) or VDD Nets.
Duplicate folded Net names are invalid and remain diagnostics until the author
explicitly corrects the Project.

Viewport, selection, canvas overlays, import compiler state, Agent session
credentials, and recovery envelopes are not part of the Project file. Browser
recovery is a non-authoritative safety copy kept in this browser's IndexedDB:
at most two recent working copies, each with a current and a previous
generation, each copy at most 4 MB and 12 MB in total. It does not survive
explicitly clearing site data. Use **File / Save Project** for the portable
editable Project; saving or downloading a Project never deletes the browser
recovery copies.
