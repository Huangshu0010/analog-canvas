import { createEmptyProject } from "@icm/model";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("editor shell", () => {
  it("renders an empty project without owning model state", () => {
    const project = createEmptyProject("project-smoke", "Smoke Project");
    const markup = renderToStaticMarkup(<App project={project} />);
    expect(markup).toContain("Smoke Project");
    expect(markup).toContain("Schematic canvas");
  });
});
