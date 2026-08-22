---
status: completed
experience: none
---

# Example import, square palette tiles, and a clear Publish label

## Goal

Three review items, plus the paste defect the first one exposed:

1. Clicking an Example replaced the whole canvas, silently discarding work in
   progress behind a confirm. It should join the current drawing instead.
2. Dragging the Library wider stretched its tiles instead of fitting more of
   them; the tiles should stay square and the row count should follow the
   width.
3. The menubar button read "Publish…", whose ellipsis reads as a truncated
   label rather than "opens a dialog".

## State and Ownership

Start state: clean worktree on `main` (untracked local build scaffolding
only). Branch `claude/publish-label-clarity`.

Owned paths:

- `apps/editor/src/app/App.tsx`
- `apps/editor/src/features/clipboard/clipboard.ts`
- `apps/editor/src/styles.css`
- `apps/editor/e2e/component-insert.spec.ts`
- `plan/2026-08-22-example-import-and-tiles/plan.md`, `plan/log.md`

## Work

1. `openLibraryExample` builds the example's content as an ordinary clipboard
   payload and attaches it to the placement cursor, so the example is placed
   like a copy and nothing is overwritten. A hierarchical example (more than
   one Document) cannot be flattened onto the current Document, so it still
   opens as its own Project behind the existing dirty guard.
2. The palette grid becomes `repeat(auto-fill, var(--icm-shapes-tile))` with
   square tiles, so a wider panel fits more per row.
3. Label the Publish button "Publish", with the full action in its title and
   accessible name.
4. Paste allocates a free reference for schematic-only markers (ground, power
   ports). They carry a netlist reference but no device reference policy, so
   the policy-driven allocator skipped them and a second paste produced
   `Duplicate netlist instance reference: PWR1`.

## Validation

- repository typecheck, prettier
- full unit suite; full Playwright suite
- example import, tile squareness, and the resize interaction exercised in a
  running editor

## Gate Review

- Decision: affected — editor shell and one clipboard planner.
- Early gates: prettier, focused unit tests.
- Affected gates: clipboard unit tests, component-insert browser spec.
- Final gates: `pnpm ci:check` cannot run locally (pnpm absent); delegated to
  the remote required checks.
- Platform risks: none; no generated artifact or persisted contract changes.

## Test Impact

- Decision: tests-updated
- Contracts: example placement joins the Document; Library tile geometry;
  paste reference allocation for schematic-only markers.
- Primary checks: `apps/editor/e2e/component-insert.spec.ts`,
  `apps/editor/src/features/clipboard/clipboard.test.ts`

## Commit Intent

```text
feat(editor): place examples into the drawing instead of replacing it
```

## Outcome

Examples now attach to the placement cursor (status "Place <name> on the
canvas"), so existing work survives; verified live by placing a resistor,
importing an example, and confirming both remain. Palette tiles stay 56×56 and
the row count follows the panel width (218px → 2 columns, 405px → 5). The
Publish button reads "Publish".

The paste fix came out of the second import failing document validation with
`Duplicate netlist instance reference: PWR1`: ground and power-port markers
carry a netlist reference but have no device reference prefix, so paste kept
their original reference. It now claims the next free ordinal for that prefix,
which also fixes ordinary copy/paste of those markers.

Validation: typecheck, 179 unit files / 1121 tests, 185 Playwright tests,
prettier, and diff checks.
