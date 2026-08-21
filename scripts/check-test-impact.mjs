import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectChangedPaths,
  loadGateCatalog,
} from "./lib/validation-gates.mjs";
import { assessTestImpact, testPathKind } from "./lib/test-impact.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseIndex = process.argv.indexOf("--base");
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined;

if (!base) {
  console.error("Usage: node scripts/check-test-impact.mjs --base <git-ref>");
  process.exitCode = 2;
} else {
  const catalog = await loadGateCatalog();
  const paths = collectChangedPaths(base, {
    ignoredPaths: catalog.ignoredPaths,
  });
  const planDocuments = await Promise.all(
    paths
      .filter((path) => testPathKind(path) === "plan")
      .map(async (path) => ({
        path,
        text: await readFile(resolve(root, path), "utf8"),
      })),
  );
  const result = assessTestImpact(paths, planDocuments);
  if (!result.ok) {
    console.error(`Test-impact check failed: ${result.message}`);
    process.exitCode = 1;
  } else {
    console.log(`Test-impact check passed: ${result.message}`);
  }
}
