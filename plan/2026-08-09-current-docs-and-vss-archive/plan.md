# Current Documentation Index and VSS Archive

## Goal

Reduce default documentation context to a small current set, physically archive
the obsolete VSS development and Agent style canon, and leave short redirects
at legacy paths so historical links do not silently become active guidance.

## Dirty-State Note

Concurrent work owns editor, model, renderer, and raster-fidelity files. This
target does not edit them. `docs/specs/razavi-textbook-style.md` is explicitly
read-only because it is being revised by the raster-fidelity target. `plan/log.md`
is clean at start and is owned for the factual close-out.

## Owned Files

- `docs/current/README.md`
- `docs/archive/README.md`
- `docs/archive/visio-vss/vss-development-import.md`
- `docs/archive/visio-vss/razavi-style-canon.md`
- `docs/specs/vss-development-import.md`
- `docs/agent/knowledge/razavi-style-canon.md`
- `docs/README.md`
- `docs/specs/README.md`
- `docs/roadmap/README.md`
- `docs/roadmap/phase-5-symbols-and-visual-quality.md`
- `docs/roadmap/phase-8-direct-manipulation-and-manual-authoring.md`
- `skills/circuit-layout/references/manifest.md`
- `plan/log.md`
- `plan/2026-08-09-current-docs-and-vss-archive/plan.md`

## Read-Only Files

- `docs/specs/razavi-textbook-style.md`
- `docs/overall-product-plan.md`
- `docs/adr/0011-retire-visio-vss-as-visual-authority.md`
- VSS source, scripts, and fixtures

## Shared Dependencies

- ADR 0011 is the authority for the VSS retirement boundary.
- The circuit-layout manifest must continue to resolve a valid, current style
  source without loading archived Visio guidance.
- Historical links remain valid through redirect stubs.

## Expected Work

1. Introduce a compact current-document entry point and an explicit archive
   boundary.
2. Move obsolete VSS/Visio guidance out of current spec and Agent knowledge
   trees; replace each old path with a short ADR-linked redirect.
3. Remove VSS language from current navigation and mark completed Phase 5/8
   records as historical where their visual-source claims are superseded.

## Validation

- `git diff --check`
- verify the circuit-layout manifest no longer routes to VSS canon
- verify specs/roadmap current indexes carry no active VSS entry
- `git status --short --branch`

## Commit Intent

```text
docs: separate current guidance from VSS archive
```
