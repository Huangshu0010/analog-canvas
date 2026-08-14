# Reproducible Agent Workflows

The schemas and request fixtures in
[`../../fixtures/agent-api/`](../../fixtures/agent-api/) are checked by the
Agent adapter tests. The retained guidance-structure report lives in
[`../../fixtures/agent-layout-eval/`](../../fixtures/agent-layout-eval/);
retired Phase 9 traces live under [`../archive/`](../archive/).

Current optional Phase 9 research:

- [Archived external quality run 1](../archive/phase9-external-quality-studies/run-1-flash-adc.md)
- [Archived external quality run 2](../archive/phase9-external-quality-studies/run-2-chopper-afe.md)

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

## 2. Add an explicit branch without inventing crossing connectivity

1. Inspect the Snapshot's complete Net, Route, and Junction facts.
2. Dry-run one `wireIntent` from the terminal endpoint to the target
   `route-segment` anchor. The shared GUI planner owns the Junction ID, Route
   split, Net merge, and Route creation choreography.
3. If validation reports an unintended connection or lock conflict, stop and
   revise the route; do not infer connectivity from a geometric crossing.
4. Inspect `diagnosticDelta`, commit, render, and refresh.

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
