---
status: completed
experience: none
---

# Consolidate the RichText contract

## Goal

Make the current floating-toolbar text editor the only authoring surface for
formatting, retire the obsolete fraction and markup-command features, and use
one canonical RichText AST across persistence, editing, layout, rendering, and
the Agent contract without changing retained text behavior or schematic-label
appearance.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/ci-contract-cleanup
```

The worktree is clean. This target owns the RichText model and helpers, editor
adapter, derived layout and semantic-text conversion, SVG rendering, generated
Agent contracts, current specifications, focused tests, and this plan/log
record.

- `packages/model/src/`
- `apps/editor/src/features/text-editing/`
- `apps/editor/src/features/wiring/route-interaction-geometry.ts`
- `apps/editor/e2e/drafting.spec.ts`
- `packages/derived/src/`
- `packages/render-svg/src/`
- `packages/agent-adapter/src/`
- `fixtures/agent-api/`
- `docs/specs/`
- `plan/2026-08-13-rich-text-contract-consolidation/plan.md`
- `plan/log.md`

Shared dependencies are the persisted Project schema, generated Agent API,
formal SVG output, and schematic style profiles. Historical ADRs, archived
plans, and logs are read-only evidence except for the new factual log entry.

## Work

1. Define one explicit recursive RichText type in the model and bind the Zod
   schema to it; retain text, line-break, bold, italic, subscript, and
   superscript while removing fraction.
2. Replace editor, layout, and renderer shadow types with the canonical model
   types and remove RichText `unknown` bridges.
3. Retire public markup parsing/serialization while retaining focused
   normalization and plain-text flattening helpers.
4. Route legacy semantic labels through one shared semantic-to-RichText
   conversion before measurement and rendering, preserving current M1/VDD and
   signed-label output.
5. Regenerate Agent schema artifacts, update current specifications, and
   replace obsolete fraction/markup tests with focused retained-behavior and
   rejection coverage.

## Validation

- `pnpm exec prettier --check` on changed source, tests, specs, and plan files
- focused model RichText and schema tests
- focused derived RichText layout and visual diagnostics tests
- focused SVG RichText, schematic-text, and render tests
- focused editor RichText E2E scenario if the local browser runner is viable
- Agent contract generation/parity check
- relevant workspace typecheck and build
- `git diff --check`
- `git status --short --branch`

The full local suite is intentionally not the default loop because this target
has focused deterministic coverage and the repository's browser suite is
resource-heavy. The canonical clean-state CI and remote required checks remain
mandatory before delivery to `main`.

## Commit Intent

Commit as:

```text
refactor(rich-text): consolidate the active text contract
```

## Outcome

The active RichText contract now has one explicit model type and contains only
text, line-break, and bold/italic/subscript/superscript spans. Editor, layout,
rendering, persistence, and generated Agent contracts consume that type
directly; fraction support and the public markup parser/serializer were
removed. Semantic identifier conversion is shared by measurement, editing, and
rendering. A read-only fallback preserves existing M1/VDD and historical
underscore annotation visuals without exposing markup as a current authoring
surface.

Validation completed with focused RichText/model/derived/render/editor/Agent
tests (135 assertions total across the two focused Vitest runs), the retained
floating-toolbar Playwright scenario, TypeScript typecheck, workspace build,
generated Agent artifact check, Phase 1/3/5 visual goldens, current-arrow visual
golden, Prettier, and `git diff --check`.
