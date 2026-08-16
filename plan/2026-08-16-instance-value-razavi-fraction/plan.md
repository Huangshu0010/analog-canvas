---
status: completed
experience: none
---

# Razavi fraction values, engineering units, and live Value toggle

## Goal

Fix three review findings on the delivered instance-value display
(PR #97, `plan/2026-08-16-instance-value-display/`):

1. Value text is not Razavi-styled: it must be bold (upright bold, on top of
   the current typography), and displayed values must carry their engineering
   unit — `150n` renders as `150nm`, `10k` as `10kΩ`, `1.8` as `1.8V`.
2. The MOS `W/L` display must be a true stacked fraction — numerator above,
   denominator below, a horizontal fraction bar between — not inline text.
3. The Properties Value toggle must react to typed parameter values
   immediately. Today it stays disabled until the panel is closed and
   reopened (availability is computed from committed state only).

Human veto recorded: the maintainer explicitly chose the stacked fraction
over the inline `<w>/<l>` correction from the previous target, so the
`fraction` RichText node retired in `32e256c` is deliberately restored with
one real consumer (instance-value annotations). The drafting toolbar keeps
zero fraction buttons.

## State and Ownership

Start state:

```text
## main...origin/main
?? .worktrees/
```

`.worktrees/` is an unrelated untracked container; untouched. Implementation
happens on a fresh review branch `zcode/instance-value-razavi-fraction`.

Owned paths:

- `packages/model/src/schema.ts`, `rich-text.ts` + model tests (fraction node,
  schema v11)
- `packages/derived/src/instance-value.ts`, `rich-text-layout.ts`,
  `annotation-presentation.ts` + tests
- `packages/render-svg/src/rich-text.ts`, `render.ts` + tests
- `apps/editor/src/app/App.tsx`, `features/component-insert/*` (live toggle
  preview), e2e specs
- Regenerated shared artifacts: project fixtures, compatibility corpus,
  agent-api schemas, MCP resources, MCP tarball sha256 pin
- `docs/user/project-compatibility.md`, `docs/specs/rich-text` mentions,
  this plan, `plan/log.md`, `plan/root-audit.md`

Read-only unless a step names them: Symbol DSL, netlist contract, reference
label flow, drafting text toolbar (no Insert-fraction button returns).

## Work

1. **Model (schema v11)**: restore the `fraction` run
   (`{ kind, numerator: runs, denominator: runs }`, depth-bounded like the
   retired shape). Flip the retirement test to acceptance; keep the toolbar
   e2e asserting zero Insert-fraction buttons. `flattenRichText` renders a
   fraction as `<num>/<den>`.
2. **Formatter**: unit table by device class — w/l `m`, resistor `Ω`,
   capacitor `F`, inductor `H`, voltage source `V`, current source `A` —
   appended unless the raw string already ends with the unit. All value text
   wraps in one bold span (upright). MOS emits
   `fraction(bold "W<unit>", bold "L<unit>")`; passives/sources emit one bold
   text run.
3. **Layout and presentation**: fraction measures as an inline block
   (width = max part + bar overhang; height = two part lines + bar gap).
   Presentation bounds extend upward for fraction-bearing content so hit
   boxes and export bounds cover the raised numerator.
4. **Renderer**: fraction renders as numerator/denominator tspans at
   subscript scale plus a sibling `<line>` fraction bar emitted from the
   deterministic layout metrics; annotations containing a fraction wrap in a
   `<g>` carrying the same data attributes (non-fraction annotation output
   stays byte-identical).
5. **Editor live toggle**: Value availability in the single-selection panel
   is computed from a preview instance built from the property draft (same
   merge rule as `instancePropertyEdits`). Checking Value commits the pending
   property draft and creates/shows the annotation in one transaction;
   unchecking stays a plain visibility edit. Group toggle keeps committed
   state (drafts reset on selection change).
6. **Artifacts and docs**: regenerate corpus fixtures at v11, refresh the
   `instance-value-display` fixture value annotations to the new projection,
   regenerate agent-api + MCP resources, refresh the MCP tarball sha256 pin,
   update the compatibility doc and affected specs.
7. **Validation closure**: update unit/e2e expectations to the new
   projection; four-orientation visual re-inspection including the fraction
   bar and unit text.

## Validation

- `pnpm test:local` for model, derived, edit-engine, render-svg, editor unit
  contracts touched above.
- `pnpm test:e2e:local apps/editor/e2e/manual-editor.spec.ts --grep
  "value display|reference and value|drag value"` plus
  `component-insert.spec.ts` and `project-file.spec.ts`.
- Full unit suite + full e2e before delivery (shared contract change:
  RichText schema), `pnpm ci:static`, `pnpm verify:branch`,
  `git diff --check`.
- PR with green GitHub Actions before any merge to `main`.

## Commit Intent

```text
feat(model): restore the fraction rich-text node at schema v11
feat(presentation): project razavi fraction values with units
feat(editor): make the value toggle react to typed parameters
test(editor): cover fraction values and live value toggling
docs(plan): record razavi fraction value delivery
```

## Outcome

Delivered on `zcode/instance-value-razavi-fraction`. All three findings
closed: value text is upright bold with its engineering unit (`150n` →
`150nm`, `10k` → `10kΩ`, `1.8` → `1.8V`); MOS W/L is a true stacked
fraction with a horizontal fraction bar (the `fraction` RichText node
retired in `32e256c` restored at schema v11, one real consumer
instance-value annotations, drafting toolbar keeps zero fraction buttons);
the Value toggle reacts to the live property draft and commits the typed
parameters plus the annotation in one transaction.

Validation: 789 unit tests, full e2e 143/143, `pnpm ci:static`,
`pnpm verify:branch` (build + production smoke), `agent-api:artifacts:check`,
`mcp:resources:check`, `git diff --check` clean. Four-orientation GUI
inspection of the fraction fixture: M1/M3 fractions stay stacked with a
visible bar and upright at 0°/90°/180°/270° with no text/symbol overlap;
live-toggle screenshot confirms typing `150n` then checking Value shows
bold `150nF` immediately without reopening the panel.
