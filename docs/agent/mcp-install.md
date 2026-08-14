# Install the Analog Canvas MCP adapter

Analog Canvas ships a self-contained Node.js stdio MCP package. The release
contains both an unpacked executable and an npm-compatible tarball:

```text
mcp/analog-canvas-mcp-v0.1.0/bin/analog-canvas-mcp.mjs
mcp/analog-canvas-mcp-server-0.1.0.tgz
```

Node.js 24 or newer is the only runtime requirement. Configure an MCP host to
run the unpacked file with `node`, or install the tarball and run
`analog-canvas-mcp`. The production relay defaults to
`https://analog-canvas.tokenzhang.com`; a staging deployment may set
`ANALOG_CANVAS_API_URL`.

The first `connect` call takes the Claim Code copied from the editor. Later MCP
processes call `connect` without a code: the Helper reads the revocable
connector from the user's `.analog-canvas/connector.json` and obtains a new
short-lived bearer. Set `ANALOG_CANVAS_MCP_CONNECTOR` only when the host needs a
different private credential location.

The connector remains bound to one browser-authorized Project/session. The
editor's **Disconnect** action or the MCP `disconnect` tool revokes it. Closing
the connection details does not disconnect it. Project replacement also
revokes it.

For a deployment check, `pnpm release:verify` builds the browser release,
bundles and packs MCP, and runs a local golden path covering initial claim,
inspection, atomic edit, verification, render, export, staged import, process
restart, and connector resume.
