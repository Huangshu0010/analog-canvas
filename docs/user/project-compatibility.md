# Project File Compatibility

The released Project schema version is `2`. A canonical v2 file can be opened,
saved, reopened, and saved again without byte drift. Version 1 files are
accepted through the registered v1-to-v2 migration; every new save writes v2.

Files with a newer schema version are rejected before replacing the current
Project. The migration registry accepts only explicit, advancing migrations;
there is no promise that a future file can be opened by an older Page build.
The canonical `fixtures/projects/minimal/project.icproj.json` file is a v2
compatibility fixture.

Viewport, selection, canvas overlays, import compiler state, and recovery
envelopes are not part of the Project file. This keeps future UI and compiler
changes from forcing Project migrations.
