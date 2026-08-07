import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const caller = resolve(here, "expand-route-tree.mjs");
const decision = resolve(here, "fixtures", "decision.json");
const input = resolve(here, "fixtures", "input.json");

function runCaller() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [caller, decision, input], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

describe("expand-route-tree caller", () => {
  it("runs end-to-end and emits edits + resolvedGeometry", async () => {
    const result = await runCaller();
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    const expansion = JSON.parse(result.stdout);
    expect(expansion.conflicts).toEqual([]);
    expect(expansion.edits).toHaveLength(1);
    expect(expansion.edits[0].kind).toBe("route_orthogonal");
    expect(expansion.metrics.routeCount).toBe(1);
    expect(expansion.resolvedGeometry).toHaveLength(1);
    expect(expansion.resolvedGeometry[0].points).toEqual([
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ]);
  });

  it("requires two file arguments and exits 2 otherwise", async () => {
    const result = await new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, [caller], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        resolvePromise({ code, stdout, stderr });
      });
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Usage");
  });
});
