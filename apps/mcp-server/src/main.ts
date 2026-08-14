#!/usr/bin/env node
import { McpStdioServer } from "./protocol.js";
import { assembleServer } from "./server.js";

const { handler, serverInfo } = assembleServer();
const server = new McpStdioServer(handler, {
  serverInfo,
  log: (message) => {
    process.stderr.write(`[analog-canvas-mcp] ${message}\n`);
  },
});
await server.run();
