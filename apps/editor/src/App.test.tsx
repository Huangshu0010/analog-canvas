import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createEmptyProject } from "@icm/model";
import { serializeProject } from "@icm/model";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App, defaultRazaviSymbolVariantId } from "./App";
import { createDemoProject } from "./demo-project";
import { createRoutingDemoProject } from "./routing-demo";

describe("editor shell", () => {
  it("uses one canonical Razavi presentation for manually placed MOS", () => {
    expect(defaultRazaviSymbolVariantId("nmos")).toBe("textbook-3terminal");
    expect(defaultRazaviSymbolVariantId("pmos")).toBe("textbook-3terminal");
    expect(defaultRazaviSymbolVariantId("resistor")).toBeUndefined();
  });

  it("renders an empty project without owning model state", () => {
    const project = createEmptyProject("project-smoke", "Smoke Project");
    const markup = renderToStaticMarkup(<App project={project} />);
    expect(markup).toContain("Smoke Project");
    expect(markup).toContain("Schematic canvas");
  });

  it("keeps the bundled demo equal to the canonical Project fixture", () => {
    const fixture = readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-1-manual/project.icproj.json",
      ),
      "utf8",
    );
    expect(serializeProject(createDemoProject())).toBe(fixture);
    expect(fixture).not.toMatch(/selection|viewport|dragPreview/u);
  });

  it("keeps the routing demo equal to its canonical Project fixture", () => {
    const fixture = readFileSync(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-3-routing/project.icproj.json",
      ),
      "utf8",
    );
    expect(serializeProject(createRoutingDemoProject())).toBe(fixture);
  });
});
