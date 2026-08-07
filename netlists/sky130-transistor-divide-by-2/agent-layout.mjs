function annotation(input) {
  return {
    kind: "upsert_annotation",
    annotation: {
      offset: { x: 0, y: 0 },
      rotation: 0,
      locked: false,
      ...input,
    },
  };
}

export default {
  id: "sky130-divide-by-2-agent-v1",
  agentId: "codex-divide-by-2-layout",
  sourceRoot: "netlists/sky130-transistor-divide-by-2",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "divide_by_2",
  outputDocumentName: "Rising-Edge Divide-by-Two",
  projectName: "SKY130 Transistor Divide-by-Two",
  outputBase: "agent-divide-by-2",
  exportMargin: 30,
  exportScale: 4,

  prepareModel({ document }) {
    const portPositions = {
      clk: { x: 70, y: 150 },
      reset: { x: 70, y: 410 },
      vdd: { x: 930, y: 70 },
      vss: { x: 930, y: 490 },
      clkout: { x: 1010, y: 270 },
    };
    document.ports = document.ports.map((port) => ({
      ...port,
      position: portPositions[port.name] ?? port.position,
    }));
    document.presentation = {
      ...document.presentation,
      styleProfileId: "razavi-textbook-v1",
      compactness: "compact",
      flow: {
        power: "top",
        ground: "bottom",
        input: "left",
        output: "right",
      },
    };
  },

  buildEditPhases({ document, netId, port, terminal, junction }) {
    const structure = [];
    const routes = [];
    const labels = [];

    const placements = {
      XCLK0: [170, 150, 0, "none"],
      XCLK1: [290, 150, 0, "none"],
      XFB: [290, 350, 0, "none"],
      XFF: [450, 270, 0, "none"],
      CSTATE: [570, 350, 0, "none"],
      XBUF0: [670, 250, 0, "none"],
      XBUF1: [810, 250, 0, "none"],
      XOUTRST: [890, 350, 0, "none"],
    };
    for (const [instanceId, [x, y, rotation, mirror]] of Object.entries(
      placements,
    )) {
      structure.push({
        kind: "place_instance",
        instanceId,
        placement: { position: { x, y }, rotation, mirror },
      });
    }

    for (const instance of document.instances.filter((candidate) =>
      candidate.symbolId.startsWith("hierarchical-symbol-"),
    )) {
      structure.push({
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: instance.symbolId,
        symbolVariantId: "implicit-supplies",
      });
    }

    const resetDevice = document.instances.find(
      (instance) => instance.id === "XOUTRST",
    );
    if (!resetDevice || resetDevice.symbolId !== "nmos") {
      throw new Error("Expected the output reset device to map to NMOS");
    }
    const resetBulk = document.nets.find((net) =>
      net.terminals.some(
        (candidate) =>
          candidate.instanceId === "XOUTRST" && candidate.pinName === "B",
      ),
    );
    if (resetBulk?.name !== "vss") {
      throw new Error("XOUTRST bulk must remain on vss");
    }
    structure.push({
      kind: "set_instance_symbol",
      instanceId: "XOUTRST",
      symbolId: "nmos",
      symbolVariantId: "textbook-3terminal",
    });

    for (const [id, netName, x, y] of [
      ["ckb", "ckb", 240, 190],
      ["cki", "cki", 360, 210],
      ["qstate", "qstate", 560, 240],
      ["d", "d", 380, 230],
      ["qb", "qb", 740, 280],
      ["clkout", "clkout", 920, 270],
      ["reset", "reset", 820, 410],
      ["vss-cap", "vss", 600, 490],
      ["vss-reset", "vss", 910, 490],
    ]) {
      structure.push({
        kind: "add_junction",
        junctionId: `junction-${id}`,
        netId: netId(netName),
        position: { x, y },
      });
    }

    let routeIndex = 0;
    const addRoute = (netName, from, to, waypoints = [], mode = "manual") => {
      routeIndex += 1;
      routes.push({
        kind: "set_route_points",
        routeId: `route-div2-${String(routeIndex).padStart(3, "0")}`,
        netId: netId(netName),
        from,
        to,
        waypoints,
        segmentModes: Array.from({ length: waypoints.length + 1 }, () => mode),
      });
    };

    // Clock conditioning and the two complementary clock phases.
    addRoute("clk", port("clk"), terminal("XCLK0", "a"), [{ x: 70, y: 140 }]);
    addRoute("ckb", terminal("XCLK0", "y"), junction("junction-ckb"), [
      { x: 240, y: 160 },
    ]);
    addRoute("ckb", junction("junction-ckb"), terminal("XCLK1", "a"), [
      { x: 240, y: 140 },
    ]);
    addRoute("ckb", junction("junction-ckb"), terminal("XFF", "ckb"), [
      { x: 390, y: 190 },
      { x: 390, y: 260 },
    ]);
    addRoute("cki", terminal("XCLK1", "y"), junction("junction-cki"), [
      { x: 360, y: 160 },
    ]);
    addRoute("cki", junction("junction-cki"), terminal("XFF", "cki"), [
      { x: 390, y: 210 },
      { x: 390, y: 280 },
    ]);

    // Divide-by-two feedback: D receives the inversion of Q.
    addRoute("qstate", terminal("XFF", "q"), junction("junction-qstate"));
    addRoute("qstate", junction("junction-qstate"), terminal("XBUF0", "a"), [
      { x: 600, y: 240 },
    ]);
    addRoute("qstate", junction("junction-qstate"), terminal("CSTATE", "1"), [
      { x: 560, y: 350 },
    ]);
    addRoute("qstate", junction("junction-qstate"), terminal("XFB", "a"), [
      { x: 540, y: 240 },
      { x: 540, y: 320 },
      { x: 250, y: 320 },
    ]);
    addRoute("d", terminal("XFB", "y"), junction("junction-d"), [
      { x: 250, y: 370 },
      { x: 250, y: 230 },
    ]);
    addRoute("d", junction("junction-d"), terminal("XFF", "d"), [
      { x: 380, y: 240 },
    ]);

    // State buffer chain and reset pull-down at the output.
    addRoute("qb", terminal("XBUF0", "y"), junction("junction-qb"), [
      { x: 740, y: 260 },
    ]);
    addRoute("qb", junction("junction-qb"), terminal("XBUF1", "a"), [
      { x: 740, y: 240 },
    ]);
    addRoute("clkout", terminal("XBUF1", "y"), junction("junction-clkout"), [
      { x: 920, y: 260 },
    ]);
    addRoute(
      "clkout",
      junction("junction-clkout"),
      port("clkout"),
      [],
      "trunk",
    );
    addRoute("clkout", junction("junction-clkout"), terminal("XOUTRST", "D"), [
      { x: 920, y: 320 },
    ]);

    addRoute("reset", port("reset"), junction("junction-reset"), [], "trunk");
    addRoute("reset", junction("junction-reset"), terminal("XOUTRST", "G"), [
      { x: 860, y: 410 },
    ]);
    addRoute("reset", junction("junction-reset"), terminal("XFF", "reset"), [
      { x: 800, y: 410 },
      { x: 800, y: 430 },
      { x: 390, y: 430 },
      { x: 390, y: 300 },
    ]);

    // Hierarchical power membership stays canonical while repetitive supply
    // pins use the selected implicit-supply presentation. Only the visible
    // state capacitor and reset transistor need the bottom rail.
    addRoute("vss", port("vss"), junction("junction-vss-reset"), [], "trunk");
    addRoute(
      "vss",
      junction("junction-vss-reset"),
      junction("junction-vss-cap"),
      [],
      "trunk",
    );
    addRoute("vss", junction("junction-vss-cap"), terminal("CSTATE", "2"));
    addRoute("vss", junction("junction-vss-reset"), terminal("XOUTRST", "S"));

    labels.push(
      annotation({
        id: "label-clk",
        kind: "net-label",
        text: "CLK",
        position: { x: 55, y: 142 },
        attachedObjectId: netId("clk"),
        alignment: "end",
      }),
      annotation({
        id: "label-reset",
        kind: "net-label",
        text: "RESET",
        position: { x: 55, y: 402 },
        attachedObjectId: netId("reset"),
        alignment: "end",
      }),
      annotation({
        id: "label-clkout",
        kind: "net-label",
        text: "CLKOUT",
        position: { x: 1025, y: 262 },
        attachedObjectId: netId("clkout"),
        alignment: "start",
      }),
      annotation({
        id: "label-vdd",
        kind: "power-label",
        text: "VDD",
        position: { x: 955, y: 62 },
        attachedObjectId: port("vdd").portId,
        alignment: "start",
      }),
      annotation({
        id: "label-vss",
        kind: "power-label",
        text: "VSS",
        position: { x: 955, y: 482 },
        attachedObjectId: port("vss").portId,
        alignment: "start",
      }),
      annotation({
        id: "label-q",
        kind: "net-label",
        text: "Q",
        position: { x: 555, y: 222 },
        attachedObjectId: netId("qstate"),
        alignment: "middle",
      }),
      annotation({
        id: "label-qb",
        kind: "net-label",
        text: "QB",
        position: { x: 740, y: 302 },
        attachedObjectId: netId("qb"),
        alignment: "middle",
      }),
    );

    for (const [instanceId, text, x, y, alignment] of [
      ["XCLK0", "INV1", 170, 110, "middle"],
      ["XCLK1", "INV2", 290, 110, "middle"],
      ["XFB", "FB", 290, 400, "middle"],
      ["XFF", "DFFR", 450, 340, "middle"],
      ["CSTATE", "C1", 570, 400, "middle"],
      ["XBUF0", "BUF1", 670, 200, "middle"],
      ["XBUF1", "BUF2", 810, 200, "middle"],
      ["XOUTRST", "MR", 935, 350, "start"],
    ]) {
      labels.push(
        annotation({
          id: `instance-label-${instanceId}`,
          kind: "instance-label",
          text,
          position: { x, y },
          attachedObjectId: instanceId,
          alignment,
        }),
      );
    }

    if (document.instances.length !== 8 || document.nets.length !== 10) {
      throw new Error(
        `Unexpected divider topology: ${document.instances.length} instances, ${document.nets.length} Nets`,
      );
    }
    return [
      { id: "div2-structure", edits: structure },
      { id: "div2-routes", edits: routes },
      { id: "div2-labels", edits: labels },
    ];
  },
};
