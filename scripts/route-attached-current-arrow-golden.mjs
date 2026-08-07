import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "../packages/model/dist/index.js";
import { renderDocumentSvg } from "../packages/render-svg/dist/index.js";
import {
  InMemorySymbolResolver,
  builtInSymbols,
} from "../packages/symbols/dist/index.js";

const input = resolve(
  process.cwd(),
  "fixtures/projects/route-attached-current-arrow/project.icproj.json",
);
const output = resolve(
  process.cwd(),
  "fixtures/visual-golden/route-attached-current-arrow.svg",
);
const project = parseProject(readFileSync(input, "utf8"));
const document = project.documents.find(
  (candidate) => candidate.id === project.topDocumentId,
);
if (!document) throw new Error("Current-arrow fixture has no top Document");
const svg = renderDocumentSvg(
  document,
  new InMemorySymbolResolver(builtInSymbols),
  { title: project.name },
);
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== svg) {
    throw new Error(`Visual golden is stale: ${output}`);
  }
  console.log("Validated route-attached current-arrow visual golden");
} else {
  writeFileSync(output, svg, "utf8");
  console.log(`Wrote ${output}`);
}
