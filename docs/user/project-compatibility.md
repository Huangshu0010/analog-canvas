# Project File Compatibility

The released Project schema version is `8`. A canonical v8 file can be opened,
saved, reopened, and saved again without byte drift. Versions 1 through 7 are
accepted only through the explicit sequential migration chain; every new save
writes v8.

Older files are read as migration inputs, not as a second live editor format.
Their supported path is:

```text
read → sequential migration → validate → edit → save canonical v8
```

The compatibility corpus at
[`fixtures/projects/compatibility-corpus.json`](../../fixtures/projects/compatibility-corpus.json)
lists every shipped fixture and saved circuit Project. It distinguishes current
canonical files from immutable historic inputs and named rejected inputs. The
test suite verifies that every supported historic input reaches a stable v8
form without retaining retired `spice.*` properties or `routeAttachment`.

Files with a newer schema version are rejected before replacing the current
Project. The migration registry accepts only explicit, advancing migrations;
there is no promise that a future file can be opened by an older Page build.

Viewport, selection, canvas overlays, import compiler state, Agent session
credentials, and recovery envelopes are not part of the Project file. Browser
recovery is a non-authoritative safety copy; use **File / Save Project** for
the portable editable Project.
