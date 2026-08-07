# Reproducible Agent Workflows

The schemas and request fixtures in
[`../../fixtures/agent-api/`](../../fixtures/agent-api/) are checked by the
Agent adapter tests. Phase 9 traces and reports live in
[`../../fixtures/agent-layout-eval/`](../../fixtures/agent-layout-eval/).

Detailed Phase 9 evidence:

- [`examples/phase-9-first-vertical-trials.md`](examples/phase-9-first-vertical-trials.md)
- [`examples/phase-9-generalization-and-performance.md`](examples/phase-9-generalization-and-performance.md)
- [`examples/phase-9-heldout-flash-adc.md`](examples/phase-9-heldout-flash-adc.md)
- [`examples/phase-9-heldout-chopper-afe.md`](examples/phase-9-heldout-chopper-afe.md)
- [`examples/phase-9-external-quality-gate.md`](examples/phase-9-external-quality-gate.md)
- [`examples/phase-9-external-quality-run-1.md`](examples/phase-9-external-quality-run-1.md)
- [`examples/phase-9-external-quality-run-2.md`](examples/phase-9-external-quality-run-2.md)

## 1. Read once, edit, render, refresh

1. Call v2 `capabilities` and select a Document from the Project Index.
2. Send [`snapshot.request.json`](../../fixtures/agent-api/snapshot.request.json)
   and retain its revision and hash.
3. Infer only from the complete Snapshot facts; load relevant knowledge pages.
4. Dry-run a typed transaction with `expectedRevision`.
5. Commit the unchanged transaction, render the affected area, then request a
   fresh Snapshot for final review.

Expected result: one read supplies the Document facts, the revision advances
only on commit, and formal topology remains unchanged by presentation edits.

## 2. Recover layouts without a circuit-specific endpoint

[`phase-9-layout-replay.mjs`](../../scripts/phase-9-layout-replay.mjs) imports
the untouched RLC and hierarchical SKY130 CDAC sources, then reconstructs the
reviewed layouts exclusively through v2 generic typed edits. Its checked report
is
[`recovery-layout-replay.json`](../../fixtures/agent-layout-eval/recovery-layout-replay.json).

Expected result: both circuits preserve their imported electrical topology,
use no v1 query, Layout Intent, or CDAC endpoint, and finish with refreshed
Snapshots and zero blocking visual diagnostics.

## 3. Add an explicit branch without inventing crossing connectivity

1. Inspect the Snapshot's complete Net, Route, and Junction facts.
2. Dry-run `add_junction` with source-route split metadata, followed by
   `set_route_points` from a same-Net terminal to the new Junction.
3. If validation reports an unintended connection or lock conflict, stop and
   revise the route; do not infer connectivity from a geometric crossing.
4. Commit, render, and refresh.

Expected result: a Junction dot exists only for explicit same-Net branches;
unrelated geometric crossings remain dotless.

## 4. Recover from a human/Agent revision race

1. Read revision 42 and prepare a placement transaction.
2. A human edit commits revision 43 through the GUI.
3. Submit the Agent transaction with expected revision 42.
4. Receive `STALE_REVISION`; no partial edit or new revision occurs.
5. Request a fresh Snapshot, reconsider the human change, and create a new
   transaction only if the intent remains valid.

Expected result: human and Agent operations retain identical optimistic
concurrency, lock, and atomicity semantics.
