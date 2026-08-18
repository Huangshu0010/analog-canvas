import { describe, expect, it } from "vitest";

import { createEmptyDocument, createEmptyProject } from "@icm/model";
import { hierarchicalSymbolId } from "@icm/symbols";

import { summarizeProjectCells } from "./cell-summary.js";

describe("Cell summary", () => {
  it("reports ports and every concrete caller without changing the Project", () => {
    const project = createEmptyProject("project", "Project");
    const child = createEmptyDocument("child", "Stage");
    child.netlist!.terminals.push({
      id: "terminal-in",
      name: "IN",
      netId: "net-in",
      direction: "input",
      interfaceInstanceId: "P1",
    });
    project.documents.push(child);
    for (const id of ["X1", "X2"]) {
      project.documents[0]!.instances.push({
        id,
        symbolId: hierarchicalSymbolId("Stage"),
        placement: null,
        properties: {},
        netlist: {
          reference: id,
          parameters: {},
          binding: {
            kind: "subcircuit",
            name: "Stage",
            childDocumentId: child.id,
          },
        },
      });
    }

    expect(summarizeProjectCells(project)).toEqual([
      expect.objectContaining({
        id: "document-main",
        isTop: true,
        callers: [],
      }),
      expect.objectContaining({
        id: "child",
        portCount: 1,
        callers: [
          expect.objectContaining({ instanceId: "X1" }),
          expect.objectContaining({ instanceId: "X2" }),
        ],
      }),
    ]);
  });
});
