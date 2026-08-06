import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createEmptyProject } from "@icm/model";
import { serializeProject } from "@icm/model";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { createDemoProject } from "./demo-project";

describe("editor shell", () => {
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
});
