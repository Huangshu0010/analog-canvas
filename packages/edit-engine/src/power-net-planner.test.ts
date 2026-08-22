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

  it("treats Ground on an ordinary named Net as an explicit grounding action", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push(
      {
        id: "net-tail",
        name: "TAIL",
        scope: "local",
        terminals: [],
      },
      {
        id: "net-global-0",
        name: "0",
        scope: "global",
        powerDomain: "ground",
        terminals: [],
      },
    );

    expect(
      planEnsurePowerNet(document, {
        candidateNetId: "net-tail",
        candidateState: "existing",
        domain: "ground",
      }),
    ).toEqual({
      ok: true,
      netId: "net-global-0",
      edits: [
        {
          kind: "merge_nets",
          targetNetId: "net-global-0",
          sourceNetId: "net-tail",
        },
      ],
    });
  });

  it("renames and classifies an ordinary named Net when it is the first Ground", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push({
      id: "net-tail",
      name: "TAIL",
      scope: "local",
      terminals: [],
    });

    expect(
      planEnsurePowerNet(document, {
        candidateNetId: "net-tail",
        candidateState: "existing",
        domain: "ground",
      }),
    ).toEqual({
      ok: true,
      netId: "net-tail",
      edits: [
        { kind: "set_net_name", netId: "net-tail", name: "0" },
        {
          kind: "set_net_power_domain",
          netId: "net-tail",
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
