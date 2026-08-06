# Reproducible Agent Workflows

The request fixtures in [`../../fixtures/agent-api/`](../../fixtures/agent-api/)
are schema-checked, and the service/HTTP suites execute the same behavior.

## 1. Inspect, align, and review a matched pair

1. Send `capabilities.request.json`.
2. Send `query-region.request.json` and retain its revision.
3. Send `align.request.json` as a dry run. Inspect `changedObjectIds` and visual
   diagnostics.
4. Repeat with `dryRun: false` and the unchanged expected revision.
5. Send `render.request.json`; decode the base64 SVG only for visual review.

Expected result: the revision advances once, attached labels move with their
instances, and the diagnostic layer is separate from formal content.

## 2. Add an explicit branch without inventing crossing connectivity

1. Query one Net and the bounded region around the intended branch.
2. Dry-run `add_junction` with the source route split metadata, followed by
   `set_route_points` from a same-Net terminal to the new Junction.
3. If the Edit Engine reports that the dot also lies on another route, stop;
   either choose another point or explicitly split every truly connected
   branch in a revised human-reviewed transaction.
4. Commit and render the changed bounds.

Expected result: a Junction dot exists only for explicit same-Net branches;
unrelated geometric crossings remain dotless.

## 3. Recover from a human/Agent revision race

1. Query at revision 42 and prepare a placement transaction.
2. A human edit commits revision 43 through the GUI.
3. Submit the Agent transaction with expected revision 42.
4. Receive `STALE_REVISION`; no partial edit or new revision occurs.
5. Query the relevant scope again, reconsider the human change, and create a
   new transaction only if the intent is still valid.

Expected result: human and Agent operations retain identical optimistic
concurrency and atomicity semantics.
