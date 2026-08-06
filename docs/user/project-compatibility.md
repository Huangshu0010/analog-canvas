# Project File Compatibility in v0.1

The released Project schema version is `1`. A canonical v1 file can be opened,
saved, reopened, and saved again without byte drift.

Files with a newer schema version are rejected before replacing the current
Project. The migration registry accepts only explicit, advancing migrations;
there is no pre-v1 public release to migrate in v0.1. The canonical
`fixtures/projects/minimal/project.icproj.json` file is the retained v1
compatibility fixture.

Viewport, selection, canvas overlays, import compiler state, and recovery
envelopes are not part of the Project file. This keeps future UI and compiler
changes from forcing Project migrations.
