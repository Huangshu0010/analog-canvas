import { createEmptyDocument } from "@icm/model";
import { describe, expect, it } from "vitest";

import { planEnsureNamedNet } from "./named-net-planner.js";

describe("named Net planner", () => {
  it("renames an unnamed candidate when the name is unused", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push({ id: "net-source", scope: "local", terminals: [] });

    expect(
      planEnsureNamedNet(document, {
        candidateNetId: "net-source",
        name: "Bias",
      }),
    ).toEqual({
      ok: true,
      netId: "net-source",
      name: "Bias",
      edits: [{ kind: "set_net_name", netId: "net-source", name: "Bias" }],
    });
  });

  it("merges into the deterministic same-folded-name Net", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push(
      { id: "net-z", name: "BIAS", scope: "local", terminals: [] },
      { id: "net-source", scope: "local", terminals: [] },
      { id: "net-a", name: "bias", scope: "local", terminals: [] },
    );

    expect(
      planEnsureNamedNet(document, {
        candidateNetId: "net-source",
        name: "Bias",
      }),
    ).toEqual({
      ok: true,
      netId: "net-a",
      name: "bias",
      edits: [
        { kind: "merge_nets", targetNetId: "net-a", sourceNetId: "net-source" },
      ],
    });
  });

  it("rejects a merge across incompatible power roles", () => {
    const document = createEmptyDocument("main", "Main");
    document.nets.push(
      {
        id: "net-vdd",
        name: "VDD",
        scope: "global",
        powerDomain: "vdd",
        terminals: [],
      },
      {
        id: "net-source",
        scope: "local",
        powerDomain: "ground",
        terminals: [],
      },
    );

    expect(
      planEnsureNamedNet(document, {
        candidateNetId: "net-source",
        name: "vdd",
      }),
    ).toMatchObject({ ok: false, relatedNetIds: ["net-vdd", "net-source"] });
  });
});
