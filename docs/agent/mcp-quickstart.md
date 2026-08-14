# Analog Canvas MCP quickstart

Use the MCP tools as the only operational interface for this session. The
Helper owns HTTP endpoints, bearer tokens, request IDs, revisions, Snapshot
caching, dry runs, and exact-payload retries; do not reconstruct those requests
manually.

## Connect and inspect

1. Call `connect` with the Claim Code shown by the browser editor.
2. Call `get_context`; provide `documentId` when the session authorizes more
   than one Document.
3. Read `analog-canvas://catalog/builtins` before placing a reviewed built-in
   symbol. Read the other reference Resources only when the task needs them.
4. Use `inspect` or `search` for current object, Net, routing, and diagnostic
   facts. These tools refresh by default so concurrent human edits are visible.

## Create and edit

Use `apply_actions` for normal authoring. One call must compile to exactly one
underlying atomic transaction:

- group compatible placement/property/text edits in one call;
- make each visible wire connection in its own call;
- refresh between create and wire phases so newly created IDs and pin page
  positions come from Snapshot;
- use `connect.via` only for deliberate orthogonal interior points;
- connect first, refresh, then use `rename` on the newly created Net.

`connect` creates visible Route geometry. A Route ending on an existing Route
segment uses the server-owned split/Junction behavior; do not fabricate Net or
Junction membership from pixels.

Use `advanced_transact` only after reading
`analog-canvas://contract/advanced-edits`, and only when the compact action
surface cannot express a current operation.

## Verify and recover

After editing, call `verify`, then `render` when visual review matters. On
`STATE_CHANGED`, inspect the reported objects and re-plan; never replay a
changed payload. `EDITOR_OFFLINE` means the authorized browser is not attached.

M0-M3 credentials are process-local. Calling `connect` without a Claim Code
only re-checks the active session in the same MCP process. A new process needs
a new Claim Code until M4 delivers a server-issued, revocable connector
credential and browser Revoke UI.
