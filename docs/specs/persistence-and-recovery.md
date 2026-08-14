# Persistence and Recovery

Status: `accepted`

Primary owner: `packages/model` and the editor document controller

Portable Projects use canonical schema-9 `.icproj.json`. Persistence validates
the complete current schema before open or save and writes atomically where the
platform supports it. Non-current versions are rejected; no migration or
compatibility reader runs during open, recovery, staging, or save.

Recovery state is a non-authoritative browser safety copy. It may restore only
a complete schema-9 Project associated with the same browser Project session.
Corrupt, incompatible, or partial recovery data is discarded without changing
the live Project. Credentials, Agent bearer tokens, selection, viewport,
overlays, and pending external approvals are never embedded in Project JSON.

Agent File Resource staging stores a bounded candidate separately from the
browser Project. Inspecting or requesting approval does not mutate the live
Project. Only an explicit human **Replace Project** action may install a valid
candidate, and replacement terminates the old Agent session.

Required validation covers canonical save/load/save byte stability, exact
schema-version rejection, atomic-write failure, corrupt recovery, Project
identity mismatch, staged-candidate isolation, and human-approved replacement.
