import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  collectChangedPaths,
  loadGateCatalog,
  planValidation,
} from "./lib/validation-gates.mjs";
import { assessGateReview } from "./lib/test-impact.mjs";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2).filter((value) => value !== "--");
const baseIndex = args.indexOf("--base");
const base = baseIndex >= 0 ? args[baseIndex + 1] : "origin/main";
const catalog = await loadGateCatalog();
const plan = planValidation(
  collectChangedPaths(base, { ignoredPaths: catalog.ignoredPaths }),
  catalog,
);
const requiresReview = plan.gates.some((gate) => gate.id === "gate-review");

if (!requiresReview) {
  process.stdout.write(
    "Gate Review check passed: the selected gates do not require a review.\n",
  );
} else {
  const planDocuments = await Promise.all(
    plan.paths
      .filter((path) => /^plan\/[^/]+\/plan\.md$/u.test(path))
      .map(async (path) => ({
        path,
        text: await readFile(resolve(root, path), "utf8"),
      })),
  );
  const result = assessGateReview(planDocuments);
  if (!result.ok) {
    console.error(`Gate Review check failed: ${result.message}`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Gate Review check passed: ${result.message}\n`);
  }
}
