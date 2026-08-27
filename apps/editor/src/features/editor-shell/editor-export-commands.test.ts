import type { DesignNetlistIR } from "@icm/netlist";
import { describe, expect, it } from "vitest";

import { planDesignNetlistExport } from "./editor-export-commands";

const emptyIr: DesignNetlistIR = {
  topCellId: "top",
  cells: [],
  externalMasters: [],
  globals: [],
};

describe("editor export commands", () => {
  it("blocks design netlist export until findings are resolved", () => {
    expect(
      planDesignNetlistExport({
        format: "spice",
        ir: null,
        warningsPresent: false,
        warningsReviewed: false,
        projectName: "Circuit",
      }),
    ).toEqual({
      status: "blocked",
      message: "Resolve the Check Report findings before export",
    });
  });

  it("requires explicit review when warnings remain", () => {
    expect(
      planDesignNetlistExport({
        format: "spectre",
        ir: emptyIr,
        warningsPresent: true,
        warningsReviewed: false,
        projectName: "Circuit",
      }),
    ).toEqual({
      status: "blocked",
      message: "Review the Check Report warnings before export",
    });
  });

  it("prepares a printable artifact after warning review", () => {
    const plan = planDesignNetlistExport({
      format: "spice",
      ir: emptyIr,
      warningsPresent: true,
      warningsReviewed: true,
      projectName: "My Circuit",
    });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") return;
    expect(plan.artifact.extension).toBe("spi");
    expect(plan.artifact.mediaType).toBe("application/x-spice");
    expect(plan.artifact.report).toBe("Download requested: my-circuit.spi");
  });
});
