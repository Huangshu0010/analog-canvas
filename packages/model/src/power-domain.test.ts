import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "./factories.js";
import { powerDomainForNet, powerNetNormalizations } from "./power-domain.js";

describe("power-domain facts", () => {
  it("derives power intent from symbol terminals instead of a Net name", () => {
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
      terminals: [{ instanceId: "VDD1", pinName: "P" }],
      ports: [],
    };
    document.nets.push(net);

    expect(powerDomainForNet(document, net)).toBe("vdd");
    expect(powerNetNormalizations(document)).toEqual([
      { netId: "net-ui-2", domain: "vdd", name: "VDD" },
    ]);
  });

  it("keeps mixed VDD and ground terminals as an explicit conflict", () => {
    const document = createEmptyDocument("main", "Main");
    document.instances.push(
      { id: "VDD1", symbolId: "vdd", placement: null, properties: {} },
      { id: "GND1", symbolId: "ground", placement: null, properties: {} },
    );
    const net = {
      id: "net-short",
      scope: "local" as const,
      terminals: [
        { instanceId: "VDD1", pinName: "P" },
        { instanceId: "GND1", pinName: "0" },
      ],
      ports: [],
    };
    document.nets.push(net);

    expect(powerDomainForNet(document, net)).toBe("conflict");
    expect(powerNetNormalizations(document)).toEqual([]);
  });
});
