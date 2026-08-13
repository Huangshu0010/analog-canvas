---
status: completed
experience: none
---

# RichText and VisualAnchor Single Authority

## Goal

Complete M2 of the Agent takeover roadmap. Every editable SchematicAnnotation
and Drafting text uses required canonical `RichTextDocument` content, and every
attachment is represented only by `VisualAnchor`. Remove runtime string/markup
parsing and `routeAttachment` fallback while preserving old Project rendering
through a versioned schema migration.

## State and Ownership

Start state:

```text
## codex/agent-project-lifecycle...origin/codex/agent-project-lifecycle
```

The target began from M1 (`74606e2`) on
`codex/agent-project-lifecycle`; all later dirty paths are owned by this
target. This target owns the next Project
schema migration, annotation schemas and typed edits, rich-text semantic helper,
annotation/drafting geometry, renderer, GUI text editing, clipboard,
connectivity/Net label consumers, Agent Snapshot/schema artifacts, fixtures,
and affected tests. It does not change electrical netlist representation,
simulation/PVT/waveform scope, File Resource work, or the four-operation
Circuit boundary.

Shared dependencies:

- `Document.ports` schema-v6 migration is complete and read-only.
- `VisualAnchor` and RichText primitives already exist, but annotations still
  persist `text` plus optional `content` and `routeAttachment`; this target
  removes that dual authority rather than adding a third representation.
- Net-label connectivity must consume the canonical RichText plain projection;
  it cannot keep an independent persisted label string.
- Agent production authoring already rejects missing `content` and
  `routeAttachment`; the persisted model/GUI/renderer must catch up.

## Work

1. Inventory all `Annotation.text`, `Annotation.content`, `routeAttachment`,
   `anchor`, `parseSchematicMath`, and renderer attribution consumers. Classify
   each as migration-only, semantic plain projection, or current authoring;
   do not retain a runtime fallback merely because a test fixture uses it.
2. Define schema v7: required annotation `content`, one required `anchor`, no
   persisted `text` or `routeAttachment`. Make semantic label text a derived
   `flattenRichText(content)` result with documented restrictions for Net and
   power labels. `netId` is the only retained electrical association for a
   net/power label; it is not a visual attachment. All visual placement is the
   required `VisualAnchor` union. Write v6-to-v7 migration that converts
   legacy text with the existing one-time parser, maps a legacy Net attachment
   to `netId`, moves route attachment to a route anchor with deterministic
   fallback, maps object attachment to an object anchor, and produces explicit
   free anchors where a legacy target is missing. No migration guesses a new
   Net, Route, or segment from proximity.
3. Replace GUI creation/editing/default label authoring, copy/paste, group
   transforms, route reattachment, annotation drag, and renderer placement so
   they write/read only `content` and `anchor`. Provide dedicated conversion
   helpers at migration/legacy import boundaries only.
4. Remove renderer-only `legacy-base`/`legacy-subscript`/`legacy-suffix`
   attribution and runtime `parseSchematicMath`; all formatting must arrive in
   the AST. Preserve current Razavi appearance with AST golden tests rather
   than identifiers interpreted at render time.
5. Update Agent Snapshot/OpenAPI/fixtures; add schema migration, edit/undo,
   clipboard, routing-anchor, connectivity, renderer, GUI and Agent parity
   tests. Regenerate artifacts and canonical visual outputs.

## Canonical schema-v7 boundary

An editable `SchematicAnnotation` is exactly a semantic kind, `content`, one
visual `anchor`, typography/presentation fields, and where applicable a typed
`netId`. It never owns both a Net/object id and a physical attachment id.

| Annotation use           | Electrical relation | Visual relation                      |
| ------------------------ | ------------------- | ------------------------------------ |
| instance label           | none                | `anchor: object(instance)`           |
| net / power label        | `netId`             | `anchor: route`, `object`, or `free` |
| current / voltage marker | none                | `anchor: route`, `object`, or `free` |

The migration-only identifier formatter may construct an AST from historic
text. It is not a renderer, hit-testing, semantic-connectivity, or future
authoring fallback. New GUI defaults create their intended AST directly; Agent
requests submit AST data governed by the generated OpenAPI.

## Validation

- focused model migration/schema, rich-text, connectivity, edit-engine,
  renderer, clipboard/text-editor, Agent contract/Snapshot tests
- `pnpm agent-api:artifacts` plus check
- `pnpm typecheck`, `pnpm docs:check`, `pnpm references:check`,
  `pnpm visual:golden:check`, `git diff --check`
- `pnpm verify:branch` before delivery

## Commit Intent

```text
feat(model): make RichText and VisualAnchor canonical
```

## Outcome

Completed schema-v7 annotation migration and removed the runtime dual
authority. Current annotations require RichText `content` and one
VisualAnchor; Net/power labels additionally carry only `netId` for electrical
identity. GUI, edit engine, Snapshot, routing, clipboard, derived connectivity,
SVG render/export, and generated OpenAPI now consume the same structure.

Legacy `text`, `attachedObjectId`, `position`, `offset`, and `routeAttachment`
are accepted only by the v6-to-v7 reader migration. It preserves resolved Net
identity without guessing geometry and converts unresolved historic labels into
free DraftText. Renderer attribution/string parsing has been removed; current
semantic defaults construct RichText AST before render.

Validation passed: focused M2 suites, full `pnpm test:local` (116 files,
701 tests), `pnpm ci:static`, Agent artifact write/check, visual golden check,
`git diff --check`, and `pnpm verify:branch` (workspace build plus production
smoke).
