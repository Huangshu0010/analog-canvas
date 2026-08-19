import { createEmptyDocument, createEmptyProject } from "@icm/model";
import { describe, expect, it } from "vitest";

import { buildProjectInstanceIndex } from "./project-instance-index.js";

describe("ProjectInstanceIndex", () => {
  it("has one definition row per document and instance with reference evidence", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("child", "Child");
    project.documents.push(child);
    project.documents[0]!.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: null,
      netlist: { reference: "R1", parameters: { value: "10k" } },
    });
    child.instances.push({
      id: "R1",
      symbolId: "resistor",
      placement: null,
      netlist: { reference: "C1", parameters: {} },
    });

    const index = buildProjectInstanceIndex(project);

    expect(index.rows).toHaveLength(2);
    expect(index.row("child", "R1")).toMatchObject({
      reference: "C1",
      referenceIssues: [{ code: "WRONG_REFERENCE_PREFIX" }],
    });
    expect(index.search("10K").map((row) => row.key)).toEqual([
      "document-main\u0000R1",
    ]);
  });
});
