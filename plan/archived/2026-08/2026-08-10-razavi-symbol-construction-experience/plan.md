# Razavi Symbol Construction Experience

## Goal

Extract one concise, evidence-backed experience note for future Razavi
component extensions. Keep the note in two parts: reusable methodology, then
the concrete code and repository paths that implement the workflow. Write the
note in English and establish English as the language for future experience
notes.

## Dirty-State Decision

The branch contains concurrent editor, model, derived-geometry, renderer,
interaction-test, specification, and target-plan work. Those paths are owned by
other active targets and remain read-only. `plan/log.md` is also concurrently
modified; this target will append one isolated factual entry without rewriting,
formatting, staging, or otherwise disturbing the existing hunks.

## Owned Paths

- `docs/experience/razavi-symbol-construction-and-pixel-calibration.md`
- `docs/experience/README.md`
- `plan/2026-08-10-razavi-symbol-construction-experience/plan.md`
- one isolated appended entry in `plan/log.md`

## Read-Only Paths

- `docs/specs/**`
- `scripts/razavi-fidelity-diff.mjs`
- `scripts/lib/razavi-fidelity.mjs`
- `scripts/lib/symbol-rasterize.mjs`
- `fixtures/visual-reference/razavi-reference-v1/**`
- `packages/symbols/**`
- `packages/render-svg/**`
- all concurrent dirty paths

## Shared Dependencies

- accepted Razavi raster-authority and component-extension contracts
- completed plans and factual log entries covering calibration, registration,
  continuous paths, overlaps, miter joins, and render-only bridges
- the current pixel-fidelity scripts and their compiled-package boundary

## Expected Work

1. Write one experience note with only two primary sections: methodology, and
   code/paths, in English.
2. Capture coordinate ownership, electrical/visual separation, family geometry,
   seam construction, and interpretation of pixel diagnostics.
3. Record the concrete evidence, asset, generator, renderer, and fidelity-tool
   paths plus the required execution order.
4. Keep historical scores and chronology in cited plans/logs rather than
   reproducing them in the lesson.
5. Record English as the required language for future experience notes.

## Validation

- inspect all local links and named paths
- confirm the note follows `docs/experience/lesson.template.md` in substance
- run `git diff --check`
- inspect `git status --short --branch` and the target-only diff

## Commit Intent

Do not mix this documentation target with concurrent dirty implementation work.
Commit only if the new files and isolated log hunk can be staged independently.

## Outcome

- Added one experience note with exactly two primary sections: methodology,
  then code and paths, fully written in English.
- Updated `docs/experience/README.md` so future extracted lessons use English
  consistently.
- Kept detailed chronology and scores in linked plans while retaining the
  reusable rules, executable path map, command order, and final checklist.
- Verified every local Markdown link, named implementation path, and referenced
  root script. `git diff --check` passed.
- Left the target uncommitted because the branch advanced during the work and
  the shared dirty `plan/log.md` contains unrelated concurrent entries; no
  mixed staging was performed.
