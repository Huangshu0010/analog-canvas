import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@icm/model";

import { extractDesignNetlist } from "./extract.js";

describe("current formal cell interface", () => {
  it("maps private cell terminals to Nets without canvas Port objects", () => {
    const project = createEmptyProject("project", "Project");
    const document = project.documents[0]!;
    document.netlist = {
      name: "inverter",
      terminals: [
        { name: "VIN", netId: "net-in" },
        { name: "VOUT", netId: "net-out" },
      ],
    };
    document.nets.push(
      { id: "net-in", name: "VIN", scope: "local", terminals: [] },
      { id: "net-out", name: "VOUT", scope: "local", terminals: [] },
    );

    const result = extractDesignNetlist(project);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.cells[0]?.ports).toEqual([
      { id: "net-in", name: "VIN", netName: "VIN" },
      { id: "net-out", name: "VOUT", netName: "VOUT" },
    ]);
  });
});
