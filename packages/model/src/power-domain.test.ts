import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "./factories.js";
import { powerDomainForNet, powerNetNormalizations } from "./power-domain.js";

describe("power-domain facts", () => {
  it("reads explicit power intent without consulting legacy symbol terminals", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push({
      id: "VDD1",
      symbolId: "vdd",
      placement: null,
      properties: {},
    });
    const net = {
      id: "net-ui-2",
      scope: "local" as const,
      powerDomain: "vdd" as const,
      terminals: [{ instanceId: "VDD1", pinName: "P" }],
    };
    document.nets.push(net);

    expect(powerDomainForNet(net)).toBe("vdd");
    expect(powerNetNormalizations(document)).toEqual([
      { netId: "net-ui-2", domain: "vdd", name: "VDD" },
    ]);
  });

  it("does not infer a supply domain from old marker terminals at runtime", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(
      { id: "VDD1", symbolId: "vdd", placement: null, properties: {} },
      { id: "GND1", symbolId: "ground", placement: null, properties: {} },
    );
    const net = {
      id: "net-short",
      scope: "local" as const,
      powerDomain: "none" as const,
      terminals: [
        { instanceId: "VDD1", pinName: "P" },
        { instanceId: "GND1", pinName: "0" },
      ],
    };
    document.nets.push(net);

    expect(powerDomainForNet(net)).toBe("none");
    expect(powerNetNormalizations(document)).toEqual([]);
  });
});
