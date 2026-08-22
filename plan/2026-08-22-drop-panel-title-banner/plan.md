---
status: completed
experience: none
---

# Editor chrome pass: panel banner, Publish, brand, resize, style dialog

## Goal

Five chrome complaints from a live review, delivered together because they
share one ownership boundary (the editor shell) and one validation surface:

1. The Library panel's "QUICK PLACE / Library" banner costs a header row while
   saying nothing the chrome does not — the rail already labels the active
   panel and the banner's only action duplicates the `Insert I` footer button.
   The Examples panel carries the identical banner.
2. "Publish to Gallery…" is buried in the File menu; it belongs beside Search.
3. The brand mark switches editor → gallery but not back.
4. The Library panel has a fixed width and cannot be dragged wider.
5. The Document style dialog reuses the Insert dialog's two-column shell, so
   raw selects sit against their labels beside a large empty pane.

## State and Ownership

Start state from `git status --short --branch`:

```text
## main...origin/main
?? .claude/
?? node_modules
```

Clean apart from untracked local build scaffolding. Branch
`claude/drop-panel-title-banner` from `main` at 6882fc28.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/editor-shell/**`
- `apps/editor/src/components/gallery-feed.tsx`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/{component-insert,manual-editor,gallery}.spec.ts`
- `plan/2026-08-22-drop-panel-title-banner/plan.md`, `plan/log.md`

## Work

1. Remove the `<header className="shapes-panel-header">` block from both
   panels and the rules that only served it.
2. Move the Publish action out of the File menu into the menubar beside
   Search, styled like Search rather than as a bespoke control.
3. Make the whole brand (mark plus wordmark) the editor's link to the gallery,
   and make the gallery's brand a link to the editor.
4. Add a dragged width to the Library panel: `useEditorPanels` owns the
   clamped, persisted value and the workspace grid reads it from an inline
   custom property; a `col-resize` separator sits on the panel edge and also
   answers arrow keys.
5. Rebuild the Document style dialog on the publish dialog's card: one settings
   row per knob (label, description, right-aligned control), a changed-value
   accent, and a Reset/Done footer.

## Validation

- `git diff --check`, `git status --short --branch`
- repository typecheck, prettier, markdown links
- full unit suite (the shell modules and the style-dialog contract)
- full Playwright suite: the panel, menubar, gallery, and style-dialog specs
  all move with this change
- every changed surface exercised in the running editor, including a real
  drag of the new resize handle

## Gate Review

- Decision: affected — presentation-only editor shell change.
- Early gates: prettier, focused unit test.
- Affected gates: the component-insert browser spec.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: none; no generated artifact or persisted contract changes.

## Test Impact

- Decision: tests-updated
- Contracts: Library/Examples panel composition and the ways the Insert
  catalog can be opened.
- Primary checks: `apps/editor/e2e/component-insert.spec.ts`,
  `apps/editor/src/features/editor-shell/shapes-panel.test.ts`

## Commit Intent

```text
refactor(editor): tighten the editor chrome
```

## Outcome

All five landed. The Library and Examples panels start straight at their
content; Publish sits beside Search (`data-testid="publish-gallery-button"`);
the brand switches both ways; the Library panel drags between 180 and 520px
and remembers its width in `icm.library-panel-width.v1`; the style dialog is a
compact settings card.

Validation: repository typecheck, full unit suite (179 files / 1121 tests),
full Playwright suite (185, one unrelated current-marker drag flake that
passes on its own re-run), prettier, markdown links, and diff checks. Every
changed surface was exercised in a running editor, including a real drag of
the new handle (248px → 368px, persisted).
