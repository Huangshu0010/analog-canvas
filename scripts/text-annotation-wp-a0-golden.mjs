import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "../packages/model/dist/index.js";
import { renderDocumentSvg } from "../packages/render-svg/dist/index.js";
import {
  InMemorySymbolResolver,
  builtInSymbols,
} from "../packages/symbols/dist/index.js";

// WP-A0 fixtures for the Text, Annotation, and Peripheral Editing System
// (ADR 0010). Each fixture is expressed with the current schema-1 annotation
// model; WP-A1 reinterprets/enriches these into the drafting container. The
// The callout golden contains only formal drafting content.
const fixtures = [
  {
    input: "fixtures/projects/text-rich-text/project.icproj.json",
    output: "fixtures/visual-golden/text-rich-text.svg",
    title: null,
  },
  {
    input: "fixtures/projects/text-route-marker/project.icproj.json",
    output: "fixtures/visual-golden/text-route-marker.svg",
    title: null,
  },
  {
    input: "fixtures/projects/text-callout/project.icproj.json",
    output: "fixtures/visual-golden/text-callout.svg",
    title: "project",
  },
];

const resolver = new InMemorySymbolResolver(builtInSymbols);
const check = process.argv.includes("--check");
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
  if (check) {
    if (readFileSync(output, "utf8") !== svg) {
      throw new Error(`Visual golden is stale: ${fixture.output}`);
    }
  } else {
    writeFileSync(output, svg, "utf8");
    console.log(`Wrote ${output}`);
  }
}
if (check) {
  console.log(`Validated ${fixtures.length} WP-A0 text/annotation goldens`);
}
