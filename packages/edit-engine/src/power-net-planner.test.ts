import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { planEnsurePowerNet } from "./power-net-planner.js";

describe("power Net planner", () => {
  it("selects canonical VDD by name rather than the first VDD-role Net", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push(
      {
        id: "net-avdd",
        name: "AVDD",
        scope: "global",
        powerDomain: "vdd",
        terminals: [],
      },
      {
        id: "net-vdd",
        name: "VDD",
        scope: "global",
        powerDomain: "vdd",
        terminals: [],
      },
    );

    expect(
      planEnsurePowerNet(document, {
        candidateNetId: "net-new-ground-marker",
        candidateState: "pending-connection",
        domain: "vdd",
      }),
    ).toEqual({
      ok: true,
      netId: "net-vdd",
      edits: [
        {
          kind: "merge_nets",
          targetNetId: "net-vdd",
          sourceNetId: "net-new-ground-marker",
        },
      ],
    });
  });

  it("promotes an unnamed contacted Net to the requested canonical supply", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push({ id: "net-contact", scope: "local", terminals: [] });

    expect(
      planEnsurePowerNet(document, {
        candidateNetId: "net-contact",
        candidateState: "existing",
        domain: "ground",
      }),
    ).toEqual({
      ok: true,
      netId: "net-contact",
      edits: [
        { kind: "set_net_name", netId: "net-contact", name: "0" },
        {
          kind: "set_net_power_domain",
          netId: "net-contact",
          powerDomain: "ground",
        },
      ],
    });
  });

  it("rejects a requested supply attached to a differently named Net", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push({
      id: "net-avdd",
      name: "AVDD",
      scope: "global",
      powerDomain: "vdd",
      terminals: [],
    });

    expect(
      planEnsurePowerNet(document, {
        candidateNetId: "net-avdd",
        candidateState: "existing",
        domain: "ground",
      }),
    ).toMatchObject({ ok: false, relatedNetIds: ["net-avdd"] });
  });
});
