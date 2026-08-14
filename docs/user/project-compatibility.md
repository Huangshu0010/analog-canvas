# Project File Compatibility

The released Project schema version is `9`. A canonical v9 file can be opened,
saved, reopened, and saved again without byte drift. Older and newer schema
versions are rejected; the editor has no compatibility reader or migration
registry.

The current-only corpus at
[`fixtures/projects/compatibility-corpus.json`](../../fixtures/projects/compatibility-corpus.json)
lists every shipped Project fixture. It distinguishes byte-stable accepted
files from named rejected inputs. Retired fields such as first-class
`Document.ports`, `Net.ports`, `spice.*`, and `routeAttachment` are invalid.

An incompatible Project is rejected before it can replace the current browser
Project. Conversion, when needed, is an explicit external operation that must
produce and validate a complete v9 candidate before a human chooses to load it.

Viewport, selection, canvas overlays, import compiler state, Agent session
credentials, and recovery envelopes are not part of the Project file. Browser
recovery is a non-authoritative safety copy; use **File / Save Project** for the
portable editable Project.
