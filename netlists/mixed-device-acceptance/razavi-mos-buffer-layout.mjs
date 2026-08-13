function annotation(input) {
  return {
    kind: "upsert_schematic_annotation",
    annotation: {
      offset: { x: 0, y: 0 },
      rotation: 0,
      locked: false,
      ...input,
    },
  };
}

export default {
  id: "mixed-mos-buffer-razavi-v1",
  agentId: "codex-cmos-buffer-layout",
  sourceRoot: "netlists/mixed-device-acceptance",
  sourceFiles: ["circuit.spi", "models.inc"],
  entry: "circuit.spi",
  documentName: "mixed_mos_cell",
  outputDocumentName: "Two-Stage CMOS Buffer",
  projectName: "SKY130 Two-Stage CMOS Buffer - Razavi Style",
  outputBase: "razavi-mos-buffer",
  exportMargin: 25,
  exportScale: 4,

  prepareModel({ document }) {
    const portPositions = {
      BIT: { x: 100, y: 230 },
      NBIT: { x: 320, y: 230 },
      BOT: { x: 600, y: 230 },
      VSS: { x: 520, y: 360 },
      VDD: { x: 520, y: 100 },
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

    for (const instance of document.instances) {
      const bulkNet = document.nets.find((net) =>
        net.terminals.some(
          (candidate) =>
            candidate.instanceId === instance.id && candidate.pinName === "B",
        ),
      );
      const expectedBulk = instance.symbolId === "pmos" ? "VDD" : "VSS";
      if (bulkNet?.name !== expectedBulk) {
        throw new Error(
          `Refusing hidden-bulk presentation for ${instance.id}: expected ${expectedBulk}, found ${bulkNet?.name ?? "missing"}`,
        );
      }
      structure.push({
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: instance.symbolId,
        symbolVariantId: "textbook-3terminal",
      });
    }

    const placements = {
      XDP: [220, 160, 180, "x"],
      XDN: [220, 300, 0, "none"],
      XSP: [460, 160, 180, "x"],
      XSN: [460, 300, 0, "none"],
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

    for (const [id, netName, x, y] of [
      ["bit", "BIT", 160, 230],
      ["nbit-left", "NBIT", 240, 230],
      ["nbit-right", "NBIT", 400, 230],
      ["bot", "BOT", 480, 230],
      ["vdd-left", "VDD", 240, 100],
      ["vdd-right", "VDD", 480, 100],
      ["vss-left", "VSS", 240, 360],
      ["vss-right", "VSS", 480, 360],
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
        routeId: `route-buffer-${String(routeIndex).padStart(3, "0")}`,
        netId: netId(netName),
        from,
        to,
        waypoints,
        segmentModes: Array.from({ length: waypoints.length + 1 }, () => mode),
      });
    };

    // Input drives both gates of the first inverter.
    addRoute("BIT", port("BIT"), junction("junction-bit"), [], "trunk");
    addRoute("BIT", junction("junction-bit"), terminal("XDP", "G"), [
      { x: 160, y: 160 },
    ]);
    addRoute("BIT", junction("junction-bit"), terminal("XDN", "G"), [
      { x: 160, y: 300 },
    ]);

    // First inverter output is both an exposed node and the second-stage input.
    addRoute("NBIT", terminal("XDP", "D"), junction("junction-nbit-left"));
    addRoute("NBIT", terminal("XDN", "D"), junction("junction-nbit-left"));
    addRoute("NBIT", junction("junction-nbit-left"), port("NBIT"), [], "trunk");
    addRoute(
      "NBIT",
      port("NBIT"),
      junction("junction-nbit-right"),
      [],
      "trunk",
    );
    addRoute("NBIT", junction("junction-nbit-right"), terminal("XSP", "G"), [
      { x: 400, y: 160 },
    ]);
    addRoute("NBIT", junction("junction-nbit-right"), terminal("XSN", "G"), [
      { x: 400, y: 300 },
    ]);

    // Second inverter output.
    addRoute("BOT", terminal("XSP", "D"), junction("junction-bot"));
    addRoute("BOT", terminal("XSN", "D"), junction("junction-bot"));
    addRoute("BOT", junction("junction-bot"), port("BOT"), [], "trunk");

    // Shared supply rails. Bulk memberships remain electrically explicit but
    // are intentionally hidden by the reviewed three-terminal presentation.
    addRoute("VDD", port("VDD"), junction("junction-vdd-right"), [], "trunk");
    addRoute(
      "VDD",
      junction("junction-vdd-right"),
      junction("junction-vdd-left"),
      [],
      "trunk",
    );
    addRoute("VDD", junction("junction-vdd-left"), terminal("XDP", "S"));
    addRoute("VDD", junction("junction-vdd-right"), terminal("XSP", "S"));

    addRoute("VSS", port("VSS"), junction("junction-vss-right"), [], "trunk");
    addRoute(
      "VSS",
      junction("junction-vss-right"),
      junction("junction-vss-left"),
      [],
      "trunk",
    );
    addRoute("VSS", terminal("XDN", "S"), junction("junction-vss-left"));
    addRoute("VSS", terminal("XSN", "S"), junction("junction-vss-right"));

    labels.push(
      annotation({
        id: "label-vdd",
        kind: "power-label",
        text: "VDD",
        position: { x: 545, y: 92 },
        attachedObjectId: port("VDD").portId,
        alignment: "start",
      }),
      annotation({
        id: "label-vss",
        kind: "power-label",
        text: "VSS",
        position: { x: 545, y: 352 },
        attachedObjectId: port("VSS").portId,
        alignment: "start",
      }),
      annotation({
        id: "label-bit",
        kind: "net-label",
        text: "BIT",
        position: { x: 85, y: 222 },
        attachedObjectId: netId("BIT"),
        alignment: "end",
      }),
      annotation({
        id: "label-nbit",
        kind: "net-label",
        text: "NBIT",
        position: { x: 320, y: 212 },
        attachedObjectId: netId("NBIT"),
        alignment: "middle",
      }),
      annotation({
        id: "label-bot",
        kind: "net-label",
        text: "BOT",
        position: { x: 615, y: 222 },
        attachedObjectId: netId("BOT"),
        alignment: "start",
      }),
    );

    for (const [instanceId, text, x, y] of [
      ["XDP", "MP1", 275, 160],
      ["XDN", "MN1", 275, 300],
      ["XSP", "MP2", 515, 160],
      ["XSN", "MN2", 515, 300],
    ]) {
      labels.push(
        annotation({
          id: `instance-label-${instanceId}`,
          kind: "instance-label",
          text,
          position: { x, y },
          attachedObjectId: instanceId,
          alignment: "start",
        }),
      );
    }

    if (document.instances.length !== 4) {
      throw new Error(
        `Expected 4 CMOS-buffer devices, found ${document.instances.length}`,
      );
    }
    return [
      { id: "buffer-structure", edits: structure },
      { id: "buffer-routes", edits: routes },
      { id: "buffer-labels", edits: labels },
    ];
  },
};
