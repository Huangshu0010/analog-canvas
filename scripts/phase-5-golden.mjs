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
  "fixtures/projects/phase-5-dense-analog/project.icproj.json",
);
const output = resolve(
  process.cwd(),
  "fixtures/visual-golden/phase-5-dense-analog.svg",
);
const project = parseProject(readFileSync(input, "utf8"));
const document = project.documents.find(
  (candidate) => candidate.id === project.topDocumentId,
);
if (!document) throw new Error("Phase 5 fixture has no top Document");
const svg = renderDocumentSvg(
  document,
  new InMemorySymbolResolver(builtInSymbols),
  { title: project.name },
);

if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== svg) {
    throw new Error("Phase 5 dense analog golden is stale");
  }
  console.log("Validated the Phase 5 dense analog golden");
} else {
  writeFileSync(output, svg, "utf8");
  console.log(`Wrote ${output}`);
}
