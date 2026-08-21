---
status: completed
experience: none
---

# Document Style Overrides (Schema 21)

## Goal

User-requested global style knobs with today's look as the untouched default:
one place to scale font size, wire stroke, symbol stroke, drafting/annotation
stroke, and junction-dot radius for a whole document. Persisted as an optional
`presentation.styleOverrides` object of bounded scale factors (0.5–2, default
absent = 1.0) composed over the resolved style profile, so the approved
textbook profiles remain the single source of base values. Applied through
the existing `set_presentation_style` edit (extended with an optional
`styleOverrides` payload; `null` clears), edited in a new "Document style"
dialog under the Draw menu, and honored by every consumer through one
overrides-aware profile resolution.

## State and Ownership

Branched from `claude/junction-dot-collinear-arms` (PR #144 queued to merge);
worktree clean. Following ADR 0023's rolling window, the project schema
advances 20 -> 21: the previous-version reader now upgrades schema-20 files
(identity plus version stamp — the new field is optional), and schema-19
support rolls off.

Owned paths:

- `packages/model/src/schema/{presentation.ts,common.ts,types.ts}` and schema
  tests
- `packages/project-protocol/src/{version.ts,transforms/project.ts}` and its
  tests
- tracked `fixtures/projects/**` and `netlists/**` `.icproj.json` files
  (re-serialized to schema 21)
- `packages/derived/src/style-profile.ts` (+ test) and the profile call sites
  in `drafting-geometry.ts`, `visual.ts`
- `packages/render-svg/src/render.ts` (two resolution sites)
- `packages/edit-engine/src/{edit-schema.ts,transaction.ts}` and
  `presentation.test.ts`
- `apps/editor/src/app/App.tsx` (profile resolution + Draw menu entry),
  new `apps/editor/src/features/editor-shell/style-dialog.tsx` (+ test),
  `apps/editor/src/styles.css` (dialog styling)
- `apps/editor/e2e/manual-editor.spec.ts` (one browser scenario)
- regenerated `packages/agent-adapter/src/agent-authoring-catalog.generated.ts`
  (if affected), `apps/mcp-server/src/resources.generated.ts`,
  `fixtures/agent-api/*` (edit schema gains an optional field)
- `docs/adr/0038-document-style-overrides.md`,
  `docs/specs/project-file-format.md`, `docs/current/README.md`
- `plan/2026-08-21-document-style-overrides/plan.md`, `plan/log.md`

Shared dependencies: the Project schema/version contract (ADR 0022/0023),
the `set_presentation_style` typed-edit surface consumed by the Agent API,
and the resolved style profile consumed by derived geometry, both renderers,
and exporters. The Razavi visual contract is untouched: base profiles remain
authoritative; overrides are explicit user intent scaled on top.

## Work

1. Model: `StyleOverridesSchema` (five optional scales, each 0.5–2) on
   `PresentationIntentSchema`; `CURRENT_PROJECT_SCHEMA_VERSION` 21.
2. Protocol: previous version 20, new upgrade adapter (stamp only);
   re-serialize the six tracked fixture projects.
3. Derived: `resolveDocumentStyleProfile(presentation)` composing the scales
   over the base profile (memoized per presentation identity); switch the six
   internal/external resolution sites.
4. Edit-engine: optional `styleOverrides` (`null` clears) on
   `set_presentation_style`; transaction applies it; tests.
5. Editor: Draw menu "Document style…" dialog — five steppers with live
   preview through ordinary transactions, Reset restores defaults.
6. Docs: ADR 0038, project-file-format presentation section, current reading
   list; regenerate agent/MCP artifacts.
7. Tests at each layer plus one Playwright scenario (open dialog, scale
   fonts and dots, assert the rendered SVG changed accordingly, reset).

## Validation

- focused `vitest`: model schema, project-protocol, derived style-profile,
  edit-engine presentation, editor style-dialog
- `node scripts/generate-mcp-resources.mjs --check` and
  `node scripts/agent-api-artifacts.mjs --check` after regeneration
- `node scripts/export-golden.mjs --check` (no drift expected — defaults
  unchanged)
- repository typecheck, prettier, markdown links
- `node scripts/check-test-impact.mjs --base <branch-base>`
- one `playwright` scenario in `manual-editor.spec.ts`
- `git diff --check` and `git status --short --branch`

## Test Impact

- Decision: tests-updated
- Contracts: schema-21 project shape with bounded optional style overrides;
  rolling 20->21 read compatibility and fixture round-trip; override
  composition over base profiles (absent = byte-identical output);
  `set_presentation_style` accepts/clears overrides atomically and undoably;
  dialog edits the persisted overrides
- Primary checks: `packages/model/src/schema.test.ts` (or presentation
  schema test), `packages/project-protocol/src/protocol.test.ts` and
  `compatibility-corpus.test.ts`, `packages/derived/src/style-profile.test.ts`,
  `packages/edit-engine/src/presentation.test.ts`,
  `apps/editor/src/features/editor-shell/style-dialog.test.tsx`,
  `apps/editor/e2e/manual-editor.spec.ts`

## Commit Intent

Committed on `claude/document-style-overrides` under the user's standing
commit-push-merge direction as:

```text
feat(model): document style overrides with schema 21
```

## Outcome

Delivered end to end. Schema 21 adds bounded optional
`presentation.styleOverrides` (five 0.5–2 scale factors; absent = 1.0);
ADR 0038 records the contract and the rolling window advanced 20 -> 21 with a
stamp-only upgrade (schema-19 support rolled off; protocol, recovery,
project-file, corpus, and bundled-example fixtures re-serialized and their
version-literal tests rewritten; every schema-version documentation mention
updated and still enforced by the executable documentation test).
`resolveDocumentStyleProfile` in @icm/derived is the single composition
point (base-profile identity when overrides are absent, WeakMap-cached
otherwise) and all six resolution sites across derived, render-svg, and the
editor now flow through it. `set_presentation_style` gained the optional
`styleOverrides` payload (omit = keep, null = clear, object = replace;
undoable; out-of-range rejected) and the Agent API request/response schemas
were regenerated (size ceiling deliberately raised 122k -> 130k). The editor
exposes a Draw-menu "Document style" dialog: five preset-select knobs
committing ordinary transactions plus a reset-to-defaults action.
Validation: full unit suite 172 files / 1057 tests green (new contracts in
model schema, protocol, derived profile, edit-engine presentation, and the
dialog), new Playwright scenario (scale fonts document-wide, status, reset)
plus typecheck, prettier, markdown links, export-golden, agent-api and MCP
generator checks, test-impact, and diff checks all clean.
