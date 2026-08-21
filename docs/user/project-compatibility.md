# Project File Compatibility

The released Project schema version is `18`. It retains schematic-only
hierarchy integrity, a Project structural revision, stable formal Cell ports,
and definition-level Cell symbol presentation. It also has one typed Instance
netlist authority, formal Cell parameters, and Project-local external
subcircuit definitions with stable ordered terminal identities and directions.
Every ordinary Instance has one RichText schematic label, initially derived
from its internal schematic or netlist reference until the user edits it. A
free Port is identified by its Net name; a formal Cell Pin is identified by its
terminal name, such as `Vout`. Their bound annotations may persist same-text
RichText formatting but cannot store a divergent alias. A
canonical v18 file can be opened, saved, reopened, and saved again without
byte drift.

Schema v17 is accepted through one direct upgrade to v18. The upgrade converts
ordinary default designator labels into RichText schematic-label projections,
then removes the redundant `P#` schematic Reference/designator label from each
formal Cell Port; its stable `Instance.id` and terminal name remain unchanged.
The next save writes v18. The original file is never overwritten silently. Schema v16
and older, and versions newer than v18, are rejected; there is no accumulating
migration registry.

The canonical-current corpus at
[`fixtures/projects/compatibility-corpus.json`](../../fixtures/projects/compatibility-corpus.json)
lists every shipped Project fixture. It distinguishes byte-stable accepted
files from named rejected inputs. Previous-version compatibility uses a
focused synthetic regression instead of retaining historic Project assets.
Retired fields such as first-class
`Document.ports`, `Net.ports`, `spice.*`, and `routeAttachment` are invalid.

An incompatible Project is rejected before it can replace the current browser
Project. Conversion, when needed, is an explicit external operation that must
produce and validate a complete v18 candidate before a human chooses to load it.

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
