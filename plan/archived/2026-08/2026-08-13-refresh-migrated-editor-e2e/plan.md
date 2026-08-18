---
status: completed
experience: none
---

# Refresh Migrated Editor E2E Fixtures

## Goal

Restore the mainline browser E2E gate after accepted first-class Port and
RichText migrations by updating stale test fixtures and selectors to the
current model contracts. This target must not alter the editor's routing,
highlighting, or import behavior merely to satisfy an obsolete fixture.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle [ahead 6]
 M fixtures/exports/phase-7-dense-analog/manifest.json
 M fixtures/exports/phase-7-dense-analog/schematic.pdf
 M fixtures/exports/phase-7-dense-analog/schematic.png
 M fixtures/exports/phase-7-dense-analog/schematic.svg
 M plan/log.md
?? plan/2026-08-13-refresh-formal-export-golden/
```

The existing dirty export golden and its plan/log are owned by the preceding
mainline-gate target; they do not overlap this target. This target owns:

- `apps/editor/e2e/manual-editor.spec.ts`
- `apps/editor/e2e/chrome-isolation.spec.ts`
- `fixtures/projects/hierarchy-navigation/project.icproj.json`
- this plan and its later factual log entry

Read-only shared authorities are the current Project schema, routing demo,
RichText renderer, and hierarchy Net trace implementation. The current routing
demo deliberately uses first-class Ports, so imported routes must use Port
endpoints rather than legacy instance terminals.

## Work

1. Replace stale routing-demo test endpoints and UI selectors with current
   first-class Port equivalents.
2. Rebuild the hierarchy-trace fixture and imported hierarchy-navigation
   fixture around real components whose visible symbol pins match the child
   Cell interface, preserving their intended parent-to-child assertions.
3. Update the isolated RichText selector only to the current semantic span
   markup.
4. Run the focused browser tests, then repeat the full mainline gate together
   with the already-regenerated export golden.

## Validation

- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts apps/editor/e2e/chrome-isolation.spec.ts`
- `pnpm ci:check`
- `git diff --check`
- `git status --short --branch`

## Commit Intent

```text
test(editor): refresh migrated routing fixtures
```

## Outcome

Every former browser gate failure was a stale fixture or selector under the
accepted first-class Port/RichText contracts; no product behavior was weakened.
Focused editor browser coverage passed (64 tests), followed by the complete
mainline gate: formatting, docs/reference checks, typecheck, 725 unit tests,
workspace build, performance, golden/PWA/release smoke, and 99 browser E2E
tests. The hierarchy fixture now declares an interface that matches the parent
symbol, so both search navigation and ERC navigation test a real hierarchy
edge.
