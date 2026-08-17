import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseProject } from "@icm/project-protocol";
import { InMemorySymbolResolver, builtInSymbols } from "@icm/symbols";
import { describe, expect, it } from "vitest";

import { createFormalExportSource } from "./index.js";
import { exportFormalArtifacts } from "./node.js";

describe("formal exporters", () => {
  it("derives SVG, PNG, and PDF from one formal scene", async () => {
    const project = parseProject(
      readFileSync(
        resolve(
          process.cwd(),
          "fixtures/projects/phase-5-dense-analog/project.icproj.json",
        ),
        "utf8",
      ),
    );
    const document = project.documents.find(
      (candidate) => candidate.id === project.topDocumentId,
    )!;
    const source = createFormalExportSource(
      document,
      new InMemorySymbolResolver(builtInSymbols),
      { title: project.name },
    );
    const artifacts = await exportFormalArtifacts(source, 3);
    expect(new TextDecoder().decode(artifacts.svg)).toBe(source.svg);
    expect([...artifacts.png.bytes.slice(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(new TextDecoder().decode(artifacts.pdf.slice(0, 8))).toMatch(
      /^%PDF-/u,
    );
    expect(artifacts.png.width).toBe(Math.round(source.bounds.width * 3));
    expect(artifacts.png.height).toBe(Math.round(source.bounds.height * 3));
    expect(source.svg).toContain('data-layer="formal"');
    expect(source.svg).not.toMatch(/editor-overlay|hit-target|flightline/u);
  });
});
