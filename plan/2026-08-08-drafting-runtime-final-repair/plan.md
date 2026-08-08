# Drafting Runtime Final Repair

## Goal

Close the remaining Drafting Runtime Completion defects found in the second
audit: schema-complete recursive rich-text round trips, renderer-shared
multi-line layout, cancellable/atomic existing-object dragging, truthful
save/reopen and production-preview tests, and non-blocking complete callout hit
targets.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## main...origin/main
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.icproj.json
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.mjs
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.pdf
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.png
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.svg
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? probe-conflicts.mjs
```

All pre-existing untracked paths are unrelated and will remain untouched and
unstaged. Tracked files are clean and `main` matches `origin/main`.

During execution, another worker added two non-overlapping Razavi commits
(`19e1e99`, `b8e16b4`) in symbol/script/plan paths. They do not overlap this
target and were retained; this target stages none of their files.

## Owned Files

- `packages/model/src/rich-text-markup.ts`
- `packages/model/src/rich-text-markup.test.ts`
- `packages/model/src/drafting-geometry-schema.ts`
- `packages/derived/src/style-profile.ts`
- `packages/derived/src/rich-text-layout.ts`
- `packages/derived/src/rich-text-layout.test.ts`
- `packages/derived/src/drafting-geometry.ts`
- `packages/derived/src/drafting-geometry.test.ts`
- `packages/derived/src/index.ts`
- `packages/render-svg/src/style-profile.ts`
- `packages/render-svg/src/rich-text.ts`
- `packages/render-svg/src/rich-text.test.ts`
- `packages/render-svg/src/render.ts`
- `packages/render-svg/src/drafting-render.test.ts`
- `fixtures/agent-api/agent-circuit.openapi.json`
- `fixtures/agent-api/agent-circuit-response.schema.json`
- `fixtures/visual-golden/phase-5-dense-analog.svg`
- `apps/editor/src/App.tsx`
- `apps/editor/src/visual-demo.ts`
- `apps/editor/e2e/drafting.spec.ts`
- `apps/editor/e2e/manual-editor.spec.ts` (stale assertions/race exposed by the full gate)
- `scripts/editor-production-smoke.mjs`
- `fixtures/editor-production-smoke/report.json`
- `package.json`
- `docs/roadmap/text-annotation-peripheral-editing-plan.md`
- `plan/2026-08-08-drafting-runtime-final-repair/plan.md`
- `plan/log.md`

## Read-Only Files

- unrelated netlists, generated circuit artifacts, and plans
- Razavi symbol assets and generation scripts
- `lib/circuit.vss`

## Shared Dependencies

- RichText resource bounds in `packages/model/src/schema.ts` remain unchanged:
  depth 4, non-empty documents/spans/fraction operands.
- `resolveDraftingObjectGeometry` remains the single geometry entry consumed
  by renderer, editor overlay, and Agent Snapshot.
- The Project schema and Agent API version do not change.
- Guides remain editor-only and electrical topology identity remains unchanged.

## Expected Work

1. Replace regex nesting with a bounded recursive markup parser and ensure
   every schema-valid AST round-trips; empty commands remain literal.
2. Move style-profile data to the derived presentation boundary and add shared
   rich-text measurement used by drafting bounds and SVG line placement.
3. Make existing-text dragging one atomic transaction with one cancel path for
   Escape/pointercancel; complete callout text-plus-leader hit targets.
4. Add real browser tests for existing-text drag/undo/Escape and actual
   save/open anchor persistence.
5. Run production output through Vite preview with a non-mutating `--check`,
   guaranteed cleanup, and a durable release gate.
6. Repair pre-existing manual-editor E2E assertions that no longer match the
   current symbol geometry/math rendering, and wait on actual demo state
   rather than an initially-true diagnostic count.
7. Load the schema-1 visual fixture through the versioned project parser; the
   direct schema-2 parse made the GUI demo command a silent no-op.
8. Remove the runtime-only exporter module fetch that made PNG/PDF buttons
   fail under the development GUI; bind the browser exporter at build time.

## Validation

- focused model, derived, render-svg, and editor tests
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:production-smoke -- --check`
- `pnpm agent-api:artifacts:check`
- `pnpm release:package`
- `git diff --check`
- `git status --short --branch`

The full test/build gates are justified because this target moves a shared
style-profile module and changes model input, formal rendering, editor gestures,
Agent-visible derived geometry, and release validation.

## Experience Signal (for human review)

Repeated shallow-test substitution allowed claims such as “any valid AST” and
“existing-object drag” while only shallow ASTs and drag-create were tested.
This is a candidate lesson if the human requests extraction.

## Commit Intent

Commit as a bounded series:

```text
fix(text): make rich text recursion and layout lossless
fix(editor): make drafting drag cancellation and persistence real
test(editor): verify built preview and drafting runtime closure
```

## Completion Evidence

- focused model/derived/render tests: passed
- full unit suite: 283 passed
- full Playwright suite: 26 passed, including real existing-object drag,
  Escape cancellation, Save -> Open, visual-demo migration, and PNG/PDF export
- workspace typecheck and 12-package build: passed
- production Vite preview smoke `--check`: passed without rewriting its report
- Agent API generated artifacts: regenerated and check passed
- release package: generated successfully
- stale `4173` Vite process from 07:23 was identified and stopped before the
  clean E2E run; this was the source of contradictory old-GUI results
