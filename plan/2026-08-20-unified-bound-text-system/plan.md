---
status: completed
experience: none
---

# Unified Bound Text System

## Goal

Replace copied semantic annotation content with a single source-of-truth binding
model, while completing the shared editor features needed for free drafting
text: deterministic Enter line breaks, left/centre/right alignment, overbar,
and a compact circuit-symbol palette. Preserve movable route-attached Net
Labels and their route anchors.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .pnpm-store/
?? .worktrees/
```

`.pnpm-store/` and `.worktrees/` are untracked local infrastructure and do
not overlap this target. This target owns the text model, semantic text
resolver, text-bearing schema consumers, editor text session/toolbar, focused
tests, and plan records. It does not alter route geometry, drag handlers, or
Net Label anchors.

- `packages/model/src/{schema,semantic-text,rich-text}*`
- `packages/derived/src/**` and `packages/render-svg/src/**` only where needed
  to resolve/render bound text and overbars
- `packages/edit-engine/src/**` and `packages/agent-adapter/src/**` only where
  their contracts consume text-bearing annotations
- `apps/editor/src/features/text-editing/**`
- `apps/editor/src/features/properties/use-properties-editor.ts`
- `apps/editor/src/app/App.tsx`
- focused tests in those areas and `apps/editor/e2e/**`
- `plan/root-audit.md`, `plan/log.md`, and this plan

Read-only shared dependencies: document routing/anchor resolution, hierarchy
terminal planning, symbol definitions, and generated visual-reference assets.

## Work

1. Define literal-versus-bound text sources and one resolver. Bind instance
   reference/value, Net name, and Cell terminal displays without persisting a
   second semantic content copy; retain literal RichText for free text and
   route markers.
2. Route Cell Port edits through terminal updates and resolve both the child
   annotation and parent Cell pin name from the same formatter. Do not change
   route attachment or Net Label move semantics.
3. Extend canonical RichText with overbar and render it deterministically;
   retain Unicode text runs for Greek letters and common circuit symbols.
4. Complete the shared canvas text editor: deterministic plain Enter line
   breaks for literal multiline text, Ctrl+Enter commit, alignment controls
   with Word-like SVG icons, and a compact Unicode symbol insertion palette.
   Bound electrical names remain single-line and edit their source field.
5. Update Agent snapshots/edits and focused model, renderer, hierarchy, and
   browser contracts. Validate save/reopen/export behavior and movable Net
   Label regression coverage.

## Validation

- `pnpm test:local packages/model/src/semantic-text.test.ts packages/model/src/rich-text.test.ts packages/render-svg/src/rich-text.test.ts packages/edit-engine/src/hierarchy-planner.test.ts apps/editor/src/features/text-editing/text-editing.test.ts`
- focused `pnpm test:e2e:local` contracts for text editing, hierarchy Ports,
  and Net Label movement
- `pnpm test:impact -- --base origin/main`
- `pnpm verify:branch`
- `git diff --check`
- `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: one semantic source per bound display; the same Cell terminal
  resolves child and parent display text; free text retains multiline RichText;
  alignment persists through shared typed edits; route-attached Net Labels
  remain draggable and retain their route anchor.
- Primary checks: model/renderer/edit-engine unit tests plus focused browser
  text, hierarchy, and Net Label interaction specs.

## Commit Intent

Commit as:

```text
feat(text): unify bound schematic displays
```

## Outcome

Implemented a single resolver-backed text path. New instance reference/value,
Net/power, and Cell Port labels bind to their authoritative source rather than
persisting copied RichText; free drafting text and current/voltage markers keep
literal RichText. SVG render, export bounds, hit testing, diagnostics,
connectivity, copy/paste, hierarchy rename, and text editing now consume the
same resolver. Net-label name edits retain their existing route anchor and
continue through the named-Net merge planner.

The canvas editor now supports literal multiline Enter/Ctrl+Enter commit,
alignment, overbar, and a compact engineering-symbol palette. Bound electrical
names remain single-line semantic identifiers: their style tools are disabled,
while alignment/size and source-field edits remain available. A Cell display
name is explicitly literal and no longer inherits a reference binding.

Validation: focused unit contracts (12 files / 87 tests), focused browser
contracts for semantic labels, movable Net labels, and Cell Ports, test-impact,
and `pnpm verify:branch` all passed (158 files / 945 tests, build, production
smoke).

Commit status: committed as `d4a22fbc` on `codex/unified-text-binding`.
