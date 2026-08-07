# Held-out Phase 9 Agent task 3

Using only Agent Circuit API v2 and the supplied starting Project, produce a
readable textbook-monochrome schematic for every Document in the Project.

Preserve imported electrical topology, source model/parameters, hierarchy, and
all locks. Place every instance and port. Express every intended connection with
formal Routes/Junctions or attached local labels whose repeated identity is
visually unambiguous. Make the closed differential signal path, stage order,
local feedback, shared bias, power, and output observation points readable
without relying on explanatory prose.

Use generic typed transactions only. Optional helpers, v1 query, raw Project
replacement, circuit-specific endpoints, and Layout Intent are disabled.
Complete a formal render and a fresh Snapshot for every Document. Base all
grouping and layout decisions on Snapshot pin/Net/parameter evidence rather than
fixture or instance names alone, and report genuine remaining uncertainty.
