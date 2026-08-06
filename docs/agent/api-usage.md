# Agent API Usage

## Recommended lifecycle

1. Call `capabilities` and cache only the returned API version, operation set,
   permissions, and limits.
2. Query the smallest useful scope. Prefer one Net or region to a long object
   list.
3. Use the response revision as `expectedRevision`.
4. Dry-run a transaction when placement or connectivity judgment is involved.
5. Inspect the diff and diagnostics, then submit the same edits without
   `dryRun` if still appropriate.
6. Request a `diagnostics` render of the changed bounds.
7. On `STALE_REVISION`, query again; never blindly retry the old mutation.

## Loopback example

The desktop host creates a high-entropy token and starts the optional adapter.
Clients send one JSON operation per request:

```http
POST /v1/circuit HTTP/1.1
Host: 127.0.0.1:PORT
Authorization: Bearer HOST_GENERATED_TOKEN
Content-Type: application/json

{"apiVersion":"1.0","requestId":"cap-1","operation":"capabilities"}
```

Do not place tokens in Project files, prompts, source netlists, or committed
configuration. Stop the listener when the Agent session ends.

## Failure handling

- `INVALID_REQUEST`: repair the payload against the checked schema.
- `PERMISSION_DENIED`: request narrower work or ask the human/host for a new
  authorized session; do not route around it.
- `LIMIT_EXCEEDED`: split the query or transaction.
- `STALE_REVISION`: re-query and reconsider the edit.
- `EDIT_PRECONDITION`: preserve the current geometry and explain the rejected
  assumption.
- `RENDER_TOO_LARGE`: request smaller bounds.

No error authorizes filesystem access, raw Project replacement, or a fallback
mutation mechanism.
