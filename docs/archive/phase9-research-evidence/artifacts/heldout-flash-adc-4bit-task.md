# Held-out Phase 9 Agent task

Using only Agent Circuit API v2 and the supplied starting Project, produce a
readable textbook-monochrome schematic for every Document in the Project.

Preserve the imported electrical topology, source model/parameters, hierarchy,
and all locks. Place every instance and port, express all intended logical
connections with formal Routes/Junctions or an explicitly justified label-based
convention, add only useful annotations, and complete a formal render plus a
fresh Snapshot for every Document. Optional helpers, v1 query, raw Project
replacement, circuit-specific endpoints, and Layout Intent are disabled.

Do not assume functional roles from fixture names alone. Base grouping,
ordering, symmetry, hierarchy, and routing decisions on pin/Net/parameter
evidence in the complete Snapshots. Record remaining intentional warnings or
uncertainty instead of hiding them.
