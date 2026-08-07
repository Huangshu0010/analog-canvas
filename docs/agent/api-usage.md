# Agent API Usage

## Recommended v2 lifecycle

1. Call `capabilities` once and obey the returned operations, permissions, edit
   kinds, and byte/transaction limits.
2. Read the returned Project Index and choose one Document. Request exactly one
   complete `snapshot` for that Document; do not construct a query plan first.
3. Reason over the Snapshot's complete instance-pin/Net-terminal mapping,
   hierarchy references, placements, routes, locks, and diagnostics. Load only
   the circuit-knowledge pages relevant to the observed evidence.
4. Prepare generic typed edits with the Snapshot revision as
   `expectedRevision`. Dry-run any non-trivial transaction.
5. Inspect the dry-run diff and diagnostics, then submit the same edits without
   `dryRun` if the assumptions still hold.
6. Request a `formal` or `diagnostics` render. Repair only evidenced problems.
7. Request a fresh Snapshot before global review and handoff. On
   `STALE_REVISION`, refresh and reconsider; never blindly retry the old edit.

A successful `transact` returns `resolvedRoutes`: the post-edit resolved
polyline for each Route in `diff.changedObjectIds`. Read it to learn the actual
stored geometry — including any normalization (e.g. `set_route_points`
collapsing collinear waypoints) — without an immediate `snapshot`. A rejected
`transact` localizes the failure: each diagnostic `path` points at the failing
edit position (`["edits", index]`) or, for a Route geometry failure, at the
Route (`["routes", routeId]`), and `objectIds` names the offending object. Read
`path`/`objectIds` to pinpoint the failing edit rather than parsing the message.

The normal v2 operation surface is intentionally flat:
`capabilities`, `snapshot`, `transact`, and `render`. API v1 `query` remains a
compatibility boundary, not a recommended planning language.

## Loopback example

The desktop host creates a high-entropy token and starts the optional adapter.
Clients send one JSON operation per request:

```http
POST /v2/circuit HTTP/1.1
Host: 127.0.0.1:PORT
Authorization: Bearer HOST_GENERATED_TOKEN
Content-Type: application/json

{"apiVersion":"2.0","requestId":"cap-1","operation":"capabilities"}
```

Then request the selected Document:

```json
{
  "apiVersion": "2.0",
  "requestId": "snapshot-1",
  "operation": "snapshot",
  "documentId": "document-differential-stage",
  "includeSourceSpans": false
}
```

Do not place tokens in Project files, prompts, source netlists, or committed
configuration. Stop the listener when the Agent session ends. The request path
and body API version must match.

## Failure handling

- `INVALID_REQUEST`: repair the payload against the checked schema.
- `PERMISSION_DENIED`: request narrower authority or ask the human/host for a
  new authorized session; do not route around it.
- `LIMIT_EXCEEDED`: split a transaction. Do not drop electrical edits silently.
- `SNAPSHOT_TOO_LARGE`: select a smaller hierarchical Document. The API does
  not fall back to a selector/query DSL.
- `STALE_REVISION`: request a fresh Snapshot and reconsider the edit.
- `EDIT_PRECONDITION`: preserve current state and explain the rejected
  assumption, including lock or pin-map conflicts.
- `RENDER_TOO_LARGE`: request smaller render bounds.

No error authorizes filesystem access, raw Project replacement, or a fallback
mutation mechanism.
