# Interactive Circuit Maker

Circuit-design assets and SPICE netlist fixtures for converting electrical
descriptions into reviewable schematics.

## Repository Layout

- `lib/circuit.vss`: binary Microsoft Visio stencil containing circuit symbols.
- `netlists/`: SPICE fixtures and local model declarations, grouped by circuit.
- `docs/overall-product-plan.md`: accepted product and architecture baseline.
- `docs/roadmap/`: staged delivery plans and phase exit gates.
- `docs/specs/`: normative module, file-format, and API contracts.
- `docs/agent/`: Agent API usage and layout guidance.
- `docs/adr/`: architecture decision records and their template.
- `plan/`: target plans, templates, and the factual maintenance log.
- `docs/experience/`: human-triggered reusable lessons and their template.
- `AGENTS.md`: repository-wide rules for Agent-assisted work.

## Working Model

Every bounded target follows:

```text
plan -> implementation -> validation -> log -> commit
```

Reusable experience is a separate, human-triggered layer:

```text
human reviews evidence -> Agent drafts a candidate lesson -> human decides
```

See `AGENTS.md` and `plan/README.md` before changing project assets.
Start product-planning navigation at `docs/README.md`.

## Validation Baseline

Validation must match the changed behavior and risk. At minimum, close out a
target with `git diff --check` and `git status --short --branch`.

For netlist changes, also verify:

- `.subckt` and `.ends` declarations are balanced;
- local `.include` paths resolve from the netlist directory;
- instance pin order and referenced model or subcircuit names are intentional;
- simulator checks are run when the target depends on electrical behavior.

Treat `lib/circuit.vss` as a binary source asset. Review it in Visio or a
compatible tool when changed; text diffs are not meaningful.
