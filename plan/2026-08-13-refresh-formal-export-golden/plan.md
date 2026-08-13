---
status: completed
experience: none
---

# Refresh Formal Export Golden After Canonical Text Migration

## Goal

Bring the Phase 7 formal export baseline into agreement with the current
schema-v7 RichText and VisualAnchor authority before mainline delivery. The
observed SVG delta replaces legacy flat text/attachment output with canonical
semantic text spans and anchor metadata; it is an expected consequence of
already-accepted model migration, not a File Resource behavior change.

## State and Ownership

The Agent delivery branch has merged current `origin/main` at `452fbc3`. The
worktree is clean. This target owns only `fixtures/exports/phase-7-dense-analog`
and its plan/log records. Source renderers, model schema, Project fixture, and
export generation script are read-only authorities.

## Work and Validation

1. Regenerate the formal SVG/PNG/PDF and manifest with the existing deterministic
   exporter; do not hand-edit binary artifacts.
2. Inspect the diff to confirm it records the canonical text/anchor migration.
3. Run export-golden check and the full mainline `pnpm ci:check` after the
   baseline update, plus `git diff --check`.

## Commit Intent

```text
test(export): refresh formal export golden
```

## Outcome

Regenerated all Phase 7 formal export artifacts through the existing exporter.
The SVG records only the expected canonical RichText/VisualAnchor presentation
delta; PNG/PDF and the hash manifest changed deterministically with it.
The export-golden check passes. The complete post-update mainline gate also
passed: formatting, documentation/reference checks, typecheck, 725 unit tests,
workspace build, performance, PWA, release smoke, and 99 browser E2E tests.
