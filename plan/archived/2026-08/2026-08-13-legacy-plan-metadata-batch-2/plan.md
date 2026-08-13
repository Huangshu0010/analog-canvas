---
status: completed
experience: none
---

# Legacy Plan Metadata Sweep: Batch 2

## Goal

Classify the next 25 oldest root plans that predate machine-readable lifecycle
metadata, keeping only operationally relevant or human-decision records in the
root queue.

## State and Ownership

Start state from `git status --short --branch`:

```text
## codex/local-validation-optimization...origin/codex/local-validation-optimization
```

The worktree is clean after batch 1. This batch owns only the 25 records below,
its factual audit index, `plan/root-audit.md`, and `plan/log.md`; product,
tests, CI, archived plans, candidates, and other legacy records are read-only.

- `2026-08-07-use-migrated-mos-variant-geometry`
- `2026-08-07-visio-exact-mos-generation`
- `2026-08-07-visio-exact-nontransistor-batch-a`
- `2026-08-08-anchor-driven-trunk-expander`
- `2026-08-08-coord-land-concurrent-razavi-targets`
- `2026-08-08-diagnostic-policy-separation`
- `2026-08-08-drafting-runtime-final-repair`
- `2026-08-08-editor-browser-crypto-regression`
- `2026-08-08-fix-integration-zero-length-fixture`
- `2026-08-08-flat-cdac-new-architecture-audit`
- `2026-08-08-four-layer-agent-guidance`
- `2026-08-08-four-terminal-mos-bulk-continuity`
- `2026-08-08-mos-terminal-presentation-control`
- `2026-08-08-razavi-complete-mos-pixel-map`
- `2026-08-08-razavi-current-arrow-node-alignment`
- `2026-08-08-razavi-existing-mos-migration`
- `2026-08-08-razavi-fidelity-diff-harness`
- `2026-08-08-razavi-mos-arrow-family-unification`
- `2026-08-08-razavi-mos-arrow-seam-and-pmos-parity`
- `2026-08-08-razavi-mos-canonical-arrow-diff`
- `2026-08-08-razavi-mos-ground-reference-geometry`
- `2026-08-08-razavi-mos-measured-arrow-finalization`
- `2026-08-08-razavi-peripheral-assets-and-four-terminal-mos`
- `2026-08-08-razavi-raster-authoritative-mos`
- `2026-08-08-razavi-symbol-proportion-and-stroke-calibration`

## Work

1. Inspect each plan's outcome or final state, factual log, and Git path
   history; retain a per-record evidence table below.
2. Add lifecycle metadata only where evidence supports a completed or
   superseded state. Archive completed plans with resolved experience.
3. Preserve explicit human-review signals as `completed/candidate`; delete
   only independently reconstructible routine records.
4. Refresh root counts and factual log without changing unrelated records.

## Validation

- Markdown formatting for every changed record.
- Root-state counts match `plan/root-audit.md`.
- `git diff --check` and final status review.

## Commit Intent

```text
chore(plan): classify legacy records batch 2
```

## Outcome

Each record was classified from its final body and Git path history.

| Plan                          | Evidence  | Disposition                   |
| ----------------------------- | --------- | ----------------------------- |
| migrated MOS variant          | `21b85fd` | archived, completed/none      |
| Visio MOS assets              | `4d7b66b` | archived, completed/none      |
| Visio non-transistor assets   | `7a38734` | archived, completed/none      |
| anchor-driven expander        | `13b05c9` | archived, completed/none      |
| Razavi coordination           | `12aafbb` | archived, completed/none      |
| diagnostic policy             | `00ba9dd` | archived, completed/none      |
| drafting runtime repair       | `6b2cfc6` | retained, completed/candidate |
| browser crypto regression     | `7aec788` | retained, completed/candidate |
| zero-length fixture           | `db0f3fa` | archived, completed/none      |
| flat-CDAC audit               | `8d2cd19` | archived, completed/none      |
| four-layer Agent guidance     | `6a2b8e9` | retained, completed/candidate |
| four-terminal bulk            | `16c7566` | archived, completed/none      |
| terminal presentation         | `145987b` | archived, completed/none      |
| MOS pixel map                 | `febad41` | archived, completed/none      |
| current-arrow alignment       | `f652396` | archived, completed/none      |
| existing MOS migration        | `e2687a1` | retained, completed/candidate |
| fidelity diff harness         | `d0a1bf6` | archived, completed/none      |
| arrow-family unification      | `2fab4a9` | archived, completed/none      |
| arrow seam/PMOS parity        | `498ec27` | archived, completed/none      |
| canonical-arrow diff          | `19e1e99` | retained, completed/candidate |
| MOS/ground reference geometry | `8d2cd19` | archived, completed/none      |
| measured-arrow finalization   | `21e5dc9` | archived, completed/none      |
| peripheral assets             | `5f827d5` | archived, completed/none      |
| raster-authoritative MOS      | `49a8ed9` | archived, completed/none      |
| symbol proportion calibration | `12aafbb` | archived, completed/none      |

No record met the narrow deletion conditions. The five retained records each
contain an explicit human-review experience signal.
