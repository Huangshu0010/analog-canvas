#!/usr/bin/env node
// Thin Skill caller for @icm/agent-routing.
//
// Per ADR 0008: the Skill owns the call flow; @icm/agent-routing owns the
// coordinate arithmetic. This script is a deterministic Node entry that reads
// a RouteTreeDecision + Snapshot-derived input from stdin (or files) and
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

import { readFile } from "node:fs/promises";
import { expandRouteTree } from "@icm/agent-routing";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const [decisionPath, inputPath] = process.argv.slice(2);
  const decisionText = decisionPath
    ? await readFile(decisionPath, "utf8")
    : await readStdin();
  const decision = JSON.parse(decisionText);
  const input = inputPath
    ? JSON.parse(await readFile(inputPath, "utf8"))
    : JSON.parse(await readStdin());
  const expansion = expandRouteTree(decision, input);
  process.stdout.write(`${JSON.stringify(expansion, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`expand-route-tree failed: ${String(error)}\n`);
  process.exit(1);
});
