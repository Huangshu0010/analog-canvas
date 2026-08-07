import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "../packages/model/dist/index.js";
import { renderDocumentSvg } from "../packages/render-svg/dist/index.js";
import {
  InMemorySymbolResolver,
  builtInSymbols,
} from "../packages/symbols/dist/index.js";

const fixtures = [
  {
    input: "fixtures/projects/phase-1-rendered/project.icproj.json",
    output: "fixtures/visual-golden/phase-1-manual.svg",
    title: null,
  },
  {
    input: "fixtures/projects/phase-5-dense-analog/project.icproj.json",
    output: "fixtures/visual-golden/phase-5-dense-analog.svg",
    title: "project",
  },
];
const resolver = new InMemorySymbolResolver(builtInSymbols);
for (const fixture of fixtures) {
  const input = resolve(process.cwd(), fixture.input);
  const output = resolve(process.cwd(), fixture.output);
  const project = parseProject(readFileSync(input, "utf8"));
  const document = project.documents.find(
    (candidate) => candidate.id === project.topDocumentId,
  );
  if (!document) throw new Error(`${fixture.input} has no top Document`);
  const svg = renderDocumentSvg(document, resolver, {
    ...(fixture.title === "project" ? { title: project.name } : {}),
  });
  if (process.argv.includes("--check")) {
    if (readFileSync(output, "utf8") !== svg) {
      throw new Error(`Visual golden is stale: ${fixture.output}`);
    }
  } else {
    writeFileSync(output, svg, "utf8");
    console.log(`Wrote ${output}`);
  }
}
if (process.argv.includes("--check")) {
  console.log(`Validated ${fixtures.length} Phase 1/5 visual goldens`);
}
