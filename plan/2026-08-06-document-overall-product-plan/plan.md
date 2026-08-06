# Document Overall Product Plan

## Goal

Consolidate the supplied product definition and the subsequent design
decisions into one durable Markdown document covering product boundaries,
architecture, SPICE language support, project/document/page hierarchy,
explicit junction semantics, VSS-to-Symbol-DSL conversion, repository layout,
runtime file flow, AI commands, validation, and implementation phases.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
```

The worktree was clean. No pre-existing changes overlap this target.

## Owned Files

- `docs/overall-product-plan.md`
- `plan/2026-08-06-document-overall-product-plan/plan.md`
- `plan/log.md`

## Read-Only Files

- `README.md`
- `AGENTS.md`
- `plan/README.md`
- `lib/circuit.vss`
- `netlists/`
- The user-supplied product-definition attachment

## Shared Dependencies

- Existing SPICE fixtures and their hierarchy conventions
- The binary Visio stencil as the initial symbol artwork source
- Product decisions made in the current design discussion
- Repository-wide plan-log-experience workflow

## Expected Work

1. Merge the original product definition with the accepted design changes.
2. Define the full-SPICE compatibility layers and dialect architecture.
3. Specify project, document, page, connectivity, route, and junction models.
4. Document VSS extraction, Symbol DSL generation, repository layout, and user
   project file flow.
5. Review the document for internal consistency and record the result.

## Validation

- `git diff --check`
- `git status --short --branch`
- Check Markdown headings and fenced-code blocks for structural balance.
- Search the final document for the required contracts: full SPICE support,
  `CircuitProject`, `SchematicDocument`, `SchematicPage`, explicit junctions,
  crossing behavior, VSS conversion, repository structure, and file flow.

These checks match a documentation-only change: they verify formatting and
that all decisions requested by the user are represented without claiming
runtime or electrical validation.

## Experience Signal (for human review)


## Commit Intent

Commit as:

```text
Document overall circuit canvas architecture
```
