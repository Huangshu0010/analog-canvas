import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { planElectricalMarkerName } from "./electrical-marker-name";

function documentWithMarker(symbolId: "port" | "vdd-port") {
  const document = createEmptyDocument("main", "Main");
  document.instances.push({
    id: "P1",
    symbolId,
    placement: {
      position: { x: 100, y: 100 },
      rotation: 0,
      mirror: "none",
    },
  });
  document.nets.push({
    id: "net-p1",

    terminals: [{ instanceId: "P1", pinName: "P" }],
  });
  document.connectivityEvidence.push({
    id: "claim-p1",
    kind: "name-claim",
    netId: "net-p1",
    name: symbolId === "vdd-port" ? "VDD" : "P1",
    scope: symbolId === "vdd-port" ? "global" : "local",
    ...(symbolId === "vdd-port" ? { powerDomain: "vdd" as const } : {}),
    owner:
      symbolId === "vdd-port"
        ? { kind: "power-marker" as const, objectId: "P1" }
        : { kind: "free-port" as const, instanceId: "P1" },
  });
  return document;
}

describe("electrical marker name planning", () => {
  it("keeps supply markers on the specialized detach-and-rejoin planner", () => {
    const plan = planElectricalMarkerName(
      documentWithMarker("vdd-port"),
      "P1",
      "  AVDD  ",
    );

    expect(plan).toMatchObject({
      status: "ready",
      message: "Supply named AVDD",
    });
    expect(
      plan.status === "ready" &&
        plan.edits.some((edit) => edit.kind === "disconnect_endpoint"),
    ).toBe(true);
  });

  it("keeps Free Net Ports on the same-name logical Net planner", () => {
    const plan = planElectricalMarkerName(
      documentWithMarker("port"),
      "P1",
      "  CLK  ",
    );

    expect(plan).toMatchObject({
      status: "ready",
      message: "Renamed Net Port to CLK",
    });
    expect(
      plan.status === "ready" &&
        plan.edits.some((edit) => edit.kind === "disconnect_endpoint"),
    ).toBe(false);
    expect(
      plan.status === "ready" &&
        plan.edits.some((edit) => edit.kind === "upsert_connectivity_evidence"),
    ).toBe(true);
  });

  it("does not send formal Cell pins through free-marker naming", () => {
    const document = documentWithMarker("port");
    document.netlist = {
      name: "Main",
      terminals: [
        {
          id: "formal-in",
          name: "IN",
          netId: "net-p1",
          interfaceInstanceIds: ["P1"],
          direction: "input",
        },
      ],
      formalParameters: [],
    };

    expect(planElectricalMarkerName(document, "P1", "VIN")).toEqual({
      status: "rejected",
      message: "Formal Cell Pins use Cell naming",
    });
  });
});
