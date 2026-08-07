#!/usr/bin/env node
// Thin Skill caller for @icm/agent-routing.
//
// Per ADR 0008: the Skill owns the call flow; @icm/agent-routing owns the
// coordinate arithmetic. This script is a deterministic Node entry that reads
// a RouteTreeDecision + a SerializedExpansionInput from stdin (or files) and
// prints the expansion (edits, resolvedGeometry, metrics, conflicts) as JSON.
//
// The Skill workflow is:
//   read Snapshot -> choose RouteTreeDecision -> call this expander
//   -> review edits + conflicts -> dry-run transact -> commit -> render
//
// It is a convenience, not a required API. The workflow must remain complete
// with this caller disabled (the Agent can still emit raw set_route_points).
// Conflicts are returned, never auto-rerouted: resolve them by changing the
// decision or placement, not by editing this script.
//
// Usage:
//   node expand-route-tree.mjs <decision.json> [input.json]
//   node expand-route-tree.mjs < decision.json   # input via second stdin read
// To avoid the ambiguous two-stdin-read, prefer passing both files.

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// Resolve the built package dist relative to this script's location, so the
// caller works from any CWD without relying on a hoisted node_modules link.
// On Windows an absolute path must be a file:// URL for dynamic import.
const here = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(
  here,
  "..",
  "..",
  "..",
  "packages",
  "agent-routing",
  "dist",
  "index.js",
);
const { expandRouteGraph, hydrateExpansionInput } = await import(
  pathToFileURL(distPath).href
);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const [decisionPath, inputPath] = process.argv.slice(2);
  if (!decisionPath && !inputPath) {
    process.stderr.write(
      "Usage: expand-route-tree.mjs <decision.json> <input.json>\n",
    );
    process.exit(2);
  }
  const graph = JSON.parse(await readFile(decisionPath, "utf8"));
  const serialized = JSON.parse(await readFile(inputPath, "utf8"));
  // Serialized input arrives with endpoints as an array; hydrate to a Map so
  // the expander's .has/.get lookups work.
  const input = hydrateExpansionInput(serialized);
  const expansion = expandRouteGraph(graph, input);
  process.stdout.write(`${JSON.stringify(expansion, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`expand-route-tree failed: ${String(error)}\n`);
  process.exit(1);
});
