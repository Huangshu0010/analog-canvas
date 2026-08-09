# Editor Help Tutorial

## Goal

Add an in-editor Help entry that opens an accessible two-part guide for the
browser-based circuit editor: a concise Introduction and a denser Handbook.
The guide must describe only user-facing local editing and file workflows; it
must not expose Agent-facing capabilities.

## Dirty-State Note

Start state from `git status --short --branch`:

```text
## feat/razavi-fidelity-diff-harness...origin/feat/razavi-fidelity-diff-harness [ahead 9]
?? .zcode/
?? fixtures/visual-reference/razavi-reference-v1/text-diff/
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.icproj.json
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.mjs
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.pdf
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.png
?? netlists/rlc-rf-bandpass-100mhz/agent-bandpass-layout.svg
?? plan/2026-08-08-flat-cdac-new-architecture-audit/
?? plan/2026-08-08-razavi-mos-ground-reference-geometry/
?? plan/2026-08-08-wp-r0-r1-drafting-runtime-completion/
?? plan/2026-08-09-razavi-fidelity-measurement-hardening/
?? probe-conflicts.mjs
```

The listed paths are unrelated untracked work and do not overlap the owned
editor files. Proceed without modifying them.

During implementation, unplanned changes appeared in all three owned editor
files, including a Draw menu and File/Export/Style toolbar restructuring. They
overlap the Help insertion point and cannot be attributed safely from the
working tree alone. The target is left uncommitted pending owner coordination;
no further edits will be made to those shared files.

## Owned Files

- `apps/editor/src/App.tsx`
- `apps/editor/src/App.test.tsx`
- `apps/editor/src/styles.css`
- `plan/2026-08-09-editor-help-tutorial/plan.md`
- `plan/log.md`

## Read-Only Files

- `apps/editor/src/main.tsx`
- `apps/editor/package.json`
- `README.md`
- `plan/README.md`

## Shared Dependencies

- The editor toolbar layout and existing command-menu styling.
- Browser-only storage/recovery behavior and file import/export labels.
- Existing React/Vitest editor test setup.

## Expected Work

1. Add a Help control to the editor toolbar and an accessible two-part dialog.
2. Keep the Introduction brief; make the Handbook a compact reference for
   starting/opening, placing and wiring, editing/navigation, exporting, all
   implemented keyboard and mouse shortcuts, and the local-only data/recovery
   boundary.
3. Add focused coverage for opening and closing the tutorial, then validate the
   editor build and changed surface.

## Validation

- `pnpm exec vitest run apps/editor/src/App.test.tsx`
- `pnpm --filter @icm/editor build`
- `git diff --check`
- `git status --short --branch`

These checks cover the interactive entry point and static production build;
the change does not alter shared circuit data or electrical behavior.

## Experience Signal (for human review)

## Commit Intent

Commit as:

```text
feat(editor): add in-app help tutorial
```
