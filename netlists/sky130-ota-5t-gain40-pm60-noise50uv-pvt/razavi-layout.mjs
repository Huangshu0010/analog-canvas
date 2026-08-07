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
  id: "sky130-ota-5t-razavi-live-v2",
  agentId: "codex-ota-live-layout",
  sourceRoot: "netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "ota_5t",
  outputDocumentName: "Five-Transistor OTA",
  projectName: "SKY130 Five-Transistor OTA - Razavi Style",
  outputBase: "razavi-ota-5t-redrawn",
  exportMargin: 25,
  exportScale: 4,

  prepareModel({ document }) {
    const portPositions = {
      vdd: { x: 540, y: 100 },
      vss: { x: 640, y: 470 },
      vinp: { x: 180, y: 270 },
      vinn: { x: 620, y: 270 },
      vout: { x: 620, y: 215 },
      ibias: { x: 680, y: 340 },
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

    const supplyBulkNets = new Set(["vdd", "vss"]);
    for (const instance of document.instances) {
      const bulkNet = document.nets.find((net) =>
        net.terminals.some(
          (candidate) =>
            candidate.instanceId === instance.id && candidate.pinName === "B",
        ),
      );
      if (!bulkNet || !supplyBulkNets.has(bulkNet.name)) {
        throw new Error(
          `Refusing three-terminal presentation for ${instance.id}: bulk Net is ${bulkNet?.name ?? "missing"}`,
        );
      }
      structure.push({
        kind: "set_instance_symbol",
        instanceId: instance.id,
        symbolId: instance.symbolId,
        symbolVariantId: "textbook-3terminal",
      });
    }

    // The Visio-derived MOS footprint places D/S 10 units from the instance
    // origin. Offset each origin so its channel pins land exactly on the
    // intended branch column instead of introducing one-grid routing jogs.
    const placements = {
      XM3: [310, 160, 180, "none"],
      XM4: [490, 160, 180, "x"],
      XM1: [290, 270, 0, "none"],
      XM2: [510, 270, 0, "x"],
      XM5: [410, 400, 0, "x"],
      XM6: [590, 400, 0, "none"],
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
      ["vdd-left", "vdd", 300, 100],
      ["vdd-right", "vdd", 500, 100],
      ["left-node", "nleft", 300, 215],
      ["vout", "vout", 500, 215],
      ["tail", "tail", 400, 300],
      ["bias", "ibias", 600, 340],
      ["vss-left", "vss", 400, 470],
      ["vss-right", "vss", 600, 470],
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
        routeId: `route-ota-${String(routeIndex).padStart(3, "0")}`,
        netId: netId(netName),
        from,
        to,
        waypoints,
        segmentModes: Array.from({ length: waypoints.length + 1 }, () => mode),
      });
    };

    // Compact top rail and vertically aligned PMOS load.
    addRoute("vdd", port("vdd"), junction("junction-vdd-right"), [], "trunk");
    addRoute(
      "vdd",
      junction("junction-vdd-right"),
      junction("junction-vdd-left"),
      [],
      "trunk",
    );
    addRoute("vdd", junction("junction-vdd-left"), terminal("XM3", "S"));
    addRoute("vdd", junction("junction-vdd-right"), terminal("XM4", "S"));

    // Diode-connected M3 and the short PMOS mirror-gate link.
    addRoute("nleft", terminal("XM3", "D"), junction("junction-left-node"));
    addRoute("nleft", junction("junction-left-node"), terminal("XM1", "D"));
    addRoute("nleft", terminal("XM3", "G"), terminal("XM4", "G"));
    addRoute("nleft", junction("junction-left-node"), terminal("XM3", "G"), [
      { x: 330, y: 215 },
    ]);

    // Right-hand output branch and symmetric differential inputs.
    addRoute("vout", terminal("XM4", "D"), junction("junction-vout"));
    addRoute("vout", junction("junction-vout"), terminal("XM2", "D"));
    addRoute("vout", junction("junction-vout"), port("vout"), [], "trunk");
    addRoute("vinp", port("vinp"), terminal("XM1", "G"));
    addRoute("vinn", terminal("XM2", "G"), port("vinn"));

    // One central tail node and a centered tail-current device.
    addRoute("tail", terminal("XM1", "S"), junction("junction-tail"), [
      { x: 300, y: 300 },
    ]);
    addRoute("tail", terminal("XM2", "S"), junction("junction-tail"), [
      { x: 500, y: 300 },
    ]);
    addRoute("tail", junction("junction-tail"), terminal("XM5", "D"));

    // Subordinate 3:1 bias mirror: short gate link and local diode closure.
    addRoute("ibias", terminal("XM5", "G"), terminal("XM6", "G"));
    addRoute("ibias", terminal("XM6", "G"), junction("junction-bias"), [
      { x: 570, y: 340 },
    ]);
    addRoute("ibias", terminal("XM6", "D"), junction("junction-bias"));
    addRoute("ibias", junction("junction-bias"), port("ibias"));

    // Compact bottom rail. Hidden B terminals retain these Net memberships
    // without becoming visible routing obligations.
    addRoute("vss", port("vss"), junction("junction-vss-right"), [], "trunk");
    addRoute(
      "vss",
      junction("junction-vss-right"),
      junction("junction-vss-left"),
      [],
      "trunk",
    );
    addRoute("vss", terminal("XM5", "S"), junction("junction-vss-left"));
    addRoute("vss", terminal("XM6", "S"), junction("junction-vss-right"));

    labels.push(
      annotation({
        id: "label-vdd",
        kind: "power-label",
        text: "VDD",
        position: { x: 565, y: 92 },
        attachedObjectId: port("vdd").portId,
        alignment: "start",
      }),
      annotation({
        id: "label-vss",
        kind: "power-label",
        text: "VSS",
        position: { x: 665, y: 462 },
        attachedObjectId: port("vss").portId,
        alignment: "start",
      }),
      annotation({
        id: "label-vinp",
        kind: "net-label",
        text: "VIN+",
        position: { x: 165, y: 262 },
        attachedObjectId: netId("vinp"),
        alignment: "end",
      }),
      annotation({
        id: "label-vinn",
        kind: "net-label",
        text: "VIN-",
        position: { x: 635, y: 262 },
        attachedObjectId: netId("vinn"),
        alignment: "start",
      }),
      annotation({
        id: "label-vout",
        kind: "net-label",
        text: "VOUT",
        position: { x: 635, y: 207 },
        attachedObjectId: netId("vout"),
        alignment: "start",
      }),
      annotation({
        id: "label-ibias",
        kind: "net-label",
        text: "IBIAS",
        position: { x: 695, y: 332 },
        attachedObjectId: netId("ibias"),
        alignment: "start",
      }),
      annotation({
        id: "label-node-a",
        kind: "net-label",
        text: "A",
        position: { x: 285, y: 207 },
        attachedObjectId: netId("nleft"),
        alignment: "end",
      }),
      annotation({
        id: "label-node-p",
        kind: "net-label",
        text: "P",
        position: { x: 385, y: 318 },
        attachedObjectId: netId("tail"),
        alignment: "end",
      }),
    );

    for (const [instanceId, text, x, y, alignment] of [
      ["XM3", "M3", 265, 160, "end"],
      ["XM4", "M4", 535, 160, "start"],
      ["XM1", "M1", 315, 270, "start"],
      ["XM2", "M2", 485, 270, "end"],
      ["XM5", "M5", 365, 400, "end"],
      ["XM6", "M6", 615, 400, "start"],
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

    if (document.instances.length !== 6) {
      throw new Error(
        `Expected 6 OTA devices, found ${document.instances.length}`,
      );
    }
    return [
      { id: "ota-structure", edits: structure },
      { id: "ota-routes", edits: routes },
      { id: "ota-labels", edits: labels },
    ];
  },
};
