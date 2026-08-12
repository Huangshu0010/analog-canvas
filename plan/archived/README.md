# Archived Target Plans

`plan/archived/` contains completed target plans that no longer belong in the
active planning surface. Archiving changes discoverability, not history: the
original plan content remains unchanged, `plan/log.md` remains the factual
summary, and Git remains the implementation record.

## Eligibility

Archive a current-format plan only when:

1. it has `status: completed` and its work is represented by a Git commit;
2. its outcome and validation are recorded;
3. it has no unresolved decision, blocked follow-up, or pending coordination;
4. `experience` is `none`, `extracted`, `rejected`, or explicitly `deferred`;
5. no active target depends on its root-level path.

For legacy plans created before the metadata contract, equivalent explicit
completion/outcome text and Git evidence may establish eligibility. A blank or
`None` legacy `Experience Signal` is resolved as `experience: none`; substantive
signal text remains unresolved until a human extracts, rejects, or defers it.

Keep failed, blocked, unresolved, proposed-only, superseded-before-
implementation, pending, and active plans in `plan/`. A plan with a possible
experience signal remains active until a human accepts, rejects, or explicitly
defers extraction.

## Layout

Archived plans are grouped by completion month:

```text
plan/archived/YYYY-MM/<original-target-directory>/plan.md
```

Do not rewrite archived plan bodies merely to update terminology or paths.
Current rules live in `AGENTS.md`, `plan/README.md`, accepted specs, and ADRs.

## 2026-08 foundation batch

| Archived target | Commit |
| --- | --- |
| `2026-08-06-bootstrap-repository-workflow` | `f74547e` |
| `2026-08-06-document-overall-product-plan` | `a1fa51f` |
| `2026-08-07-flatten-overall-product-plan` | `3ab6765` |
| `2026-08-07-establish-execution-docs` | `fe889cf` |
| `2026-08-07-execute-phase-0` | `e7532ea` |
| `2026-08-07-execute-phase-1` | `56f4f18` |
| `2026-08-07-execute-phase-2` | `a0feb43` |
| `2026-08-07-execute-phase-3` | `105915a` |
| `2026-08-07-execute-phase-4` | `b1c581c` |
| `2026-08-07-execute-phase-5` | `346b308` |
| `2026-08-07-execute-phase-6` | `46cdc0a` |
| `2026-08-07-execute-phase-7` | `adcb087` |

`2026-08-07-checkpoint-integrated-development` and
`2026-08-07-execute-phase-8` were intentionally excluded because their plans
contain experience signals awaiting an explicit human decision.

## 2026-08 lifecycle sweep

On 2026-08-13, 136 current-format targets with `status: completed`,
`experience: none`, recorded outcomes, and Git history were moved from the
root into `2026-08/` without changing their bodies. The root retention queue
and the plans needing a human experience decision are recorded in
[`../root-audit.md`](../root-audit.md).

Later on 2026-08-13, 14 routine visual-calibration, naming, and narrow
geometry-fix plan bodies were deleted under the retention rule in
[`../README.md`](../README.md). Their factual log entries and Git history
remain available; architecture, migration, delivery, integration, and
unresolved records were retained.

## 2026-08 completed second batch

These legacy plans have recorded outcomes and commit evidence. They have no
substantive undecided experience signal; blank or `None` legacy signal sections
were classified as `experience: none` without rewriting historical bodies.

| Archived target | Commit |
| --- | --- |
| `2026-08-07-atomic-visio-core-catalog` | `7a38734` |
| `2026-08-07-fix-manual-wire-endpoints-and-junction-delete` | `21b85fd` |
| `2026-08-07-generate-cmos-buffer-example` | `7c6b2cb` |
| `2026-08-07-generate-transistor-divide-by-2` | `57e5fbe` |
| `2026-08-07-prevent-stale-dev-service-worker` | `62b750d` |
| `2026-08-07-razavi-rv1-vss-decoder-proof` | `f0cd9bb` |
| `2026-08-07-razavi-rv2-catalog-boundary` | `50134d0` |
| `2026-08-07-razavi-rv3-stroke-profile` | `803031a` |
| `2026-08-07-razavi-rv6b-reviewed-catalog-migration` | `8e463cf` |
| `2026-08-07-razavi-visual-convergence` | `2381e0c` |
| `2026-08-07-redraw-ota-with-repaired-bulk-and-new-symbols` | `4d738eb` |
| `2026-08-07-refine-and-flatten-divide-by-2` | `32954fe` |
| `2026-08-07-route-attached-current-arrow` | `a9a90e6` |
| `2026-08-08-annotation-editing-and-ground-label` | `a9a90e6` |
| `2026-08-08-arrowhead-proportion-calibration` | `447dce4` |
| `2026-08-08-arrowhead-second-pass` | `1e73f1d` |
| `2026-08-08-precise-hit-targets-and-text-markup` | `12aafbb` |
| `2026-08-08-razavi-default-and-style-switch` | `12aafbb` |
| `2026-08-08-razavi-reference-pixel-calibration` | `444ee81` |
| `2026-08-08-refine-cdac-inverter-readability` | `3e9abc2` |
| `2026-08-08-text-annotation-peripheral-system-plan` | `12aafbb` |
| `2026-08-09-canonical-instance-label-authoring` | `f21d720` |
| `2026-08-09-direct-miter-terminal-joins` | `9e85e33` |
| `2026-08-09-razavi-extension-documentation` | `8535df5` |
| `2026-08-09-semantic-richtext-rendering` | `f7e1fe0` |
| `2026-08-09-terminal-escape-routing` | `387deca` |
| `2026-08-09-text-entry-and-current-arrow-repair` | `9337c8d` |
| `2026-08-09-vdd-rotation-literal-typecheck` | `3d5042e` |
| `2026-08-09-visual-selection-normalization` | `940b854` |
| `2026-08-10-attached-text-orientation-follow` | `20cb099` |
| `2026-08-10-document-controller` | `b549488` |
| `2026-08-10-instance-transform-follow` | `4459814` |
| `2026-08-10-net-label-route-follow` | `4ea7054` |
| `2026-08-10-preserve-instance-label-clearance` | `d197fe6` |
| `2026-08-10-project-recovery` | `1a17c2b` |
| `2026-08-10-razavi-symbol-construction-experience` | `b555062` |
| `2026-08-10-reusable-wire-endpoints` | `6d542c4` |
| `2026-08-10-selection-controller` | `bf2bdcb` |
| `2026-08-10-stable-instance-annotation-translation` | `c5cf03a` |
| `2026-08-10-unify-razavi-visual-contract` | `b555062` |
| `2026-08-10-upright-label-reference-edge` | `cc709b4` |
| `2026-08-10-upright-transformed-instance-labels` | `df61952` |
