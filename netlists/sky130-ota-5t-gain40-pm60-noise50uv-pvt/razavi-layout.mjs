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
  id: "sky130-ota-5t-razavi-live-v1",
  agentId: "codex-ota-live-layout",
  sourceRoot: "netlists/sky130-ota-5t-gain40-pm60-noise50uv-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "ota_5t",
  outputDocumentName: "Five-Transistor OTA",
  projectName: "SKY130 Five-Transistor OTA — Razavi Style",
  outputBase: "razavi-ota-5t-live",
  exportMargin: 35,

  prepareModel({ document }) {
    const portPositions = {
      vdd: { x: 80, y: 70 },
      vss: { x: 80, y: 590 },
      vinp: { x: 105, y: 340 },
      vinn: { x: 735, y: 340 },
      vout: { x: 735, y: 255 },
      ibias: { x: 800, y: 470 },
    };
    document.ports = document.ports.map((port) => ({
      ...port,
      position: portPositions[port.name] ?? port.position,
    }));
  },

  buildEditPhases({ document, netId, port, terminal, junction }) {
    const structure = [];
    const routes = [];
    const labels = [];
    const placements = {
      XM3: [340, 170, "x"],
      XM4: [500, 170, "none"],
      XM1: [300, 340, "none"],
      XM2: [540, 340, "x"],
      XM5: [400, 470, "none"],
      XM6: [660, 470, "none"],
    };
    for (const [instanceId, [x, y, mirror]] of Object.entries(placements)) {
      structure.push({
        kind: "place_instance",
        instanceId,
        placement: { position: { x, y }, rotation: 0, mirror },
      });
    }

    const junctions = [
      ["vdd-left", "vdd", 320, 70],
      ["vdd-right", "vdd", 520, 70],
      ["vout", "vout", 520, 255],
      ["tail-left", "tail", 320, 410],
      ["tail-mid", "tail", 420, 410],
      ["tail-right", "tail", 520, 410],
      ["bias-left", "ibias", 610, 470],
      ["bias-right", "ibias", 680, 470],
      ["vss-left", "vss", 320, 590],
      ["vss-tail", "vss", 420, 590],
      ["vss-pair-right", "vss", 520, 590],
      ["vss-right", "vss", 680, 590],
    ];
    for (const [id, netName, x, y] of junctions) {
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

    addRoute("vdd", port("vdd"), junction("junction-vdd-left"), [], "trunk");
    addRoute(
      "vdd",
      junction("junction-vdd-left"),
      junction("junction-vdd-right"),
      [],
      "trunk",
    );
    addRoute("vdd", junction("junction-vdd-left"), terminal("XM3", "S"));
    addRoute("vdd", junction("junction-vdd-right"), terminal("XM4", "S"));
    addRoute("nleft", terminal("XM3", "D"), terminal("XM1", "D"));
    addRoute("nleft", terminal("XM3", "G"), terminal("XM4", "G"));
    addRoute("nleft", terminal("XM3", "D"), terminal("XM3", "G"), [
      { x: 320, y: 170 },
    ]);

    addRoute("vout", terminal("XM4", "D"), junction("junction-vout"));
    addRoute("vout", junction("junction-vout"), terminal("XM2", "D"));
    addRoute("vout", junction("junction-vout"), port("vout"), [], "trunk");
    addRoute("vinp", port("vinp"), terminal("XM1", "G"));
    addRoute("vinn", terminal("XM2", "G"), port("vinn"));

    addRoute("tail", terminal("XM1", "S"), junction("junction-tail-left"));
    addRoute(
      "tail",
      junction("junction-tail-left"),
      junction("junction-tail-mid"),
      [],
      "trunk",
    );
    addRoute(
      "tail",
      junction("junction-tail-mid"),
      junction("junction-tail-right"),
      [],
      "trunk",
    );
    addRoute("tail", junction("junction-tail-right"), terminal("XM2", "S"));
    addRoute("tail", junction("junction-tail-mid"), terminal("XM5", "D"));

    addRoute("ibias", terminal("XM5", "G"), junction("junction-bias-left"));
    addRoute(
      "ibias",
      junction("junction-bias-left"),
      junction("junction-bias-right"),
      [],
      "trunk",
    );
    addRoute(
      "ibias",
      junction("junction-bias-right"),
      port("ibias"),
      [],
      "trunk",
    );
    addRoute("ibias", terminal("XM6", "D"), junction("junction-bias-right"));
    addRoute("ibias", terminal("XM6", "G"), junction("junction-bias-right"));

    addRoute("vss", port("vss"), junction("junction-vss-left"), [], "trunk");
    addRoute(
      "vss",
      junction("junction-vss-left"),
      junction("junction-vss-tail"),
      [],
      "trunk",
    );
    addRoute(
      "vss",
      junction("junction-vss-tail"),
      junction("junction-vss-pair-right"),
      [],
      "trunk",
    );
    addRoute(
      "vss",
      junction("junction-vss-pair-right"),
      junction("junction-vss-right"),
      [],
      "trunk",
    );
    addRoute("vss", terminal("XM5", "S"), junction("junction-vss-tail"));
    addRoute("vss", terminal("XM6", "S"), junction("junction-vss-right"));
    labels.push(
      annotation({
        id: "title-ota",
        kind: "plain-text",
        text: "SKY130 FIVE-TRANSISTOR OTA",
        position: { x: 410, y: 20 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "caption-ota",
        kind: "figure-caption",
        text: "NMOS differential pair, PMOS mirror load, 3:1 tail-bias mirror; bulk Nets preserved",
        position: { x: 410, y: 655 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "label-vdd",
        kind: "power-label",
        text: "VDD",
        position: { x: 65, y: 62 },
        attachedObjectId: port("vdd").portId,
        alignment: "end",
      }),
      annotation({
        id: "label-vss",
        kind: "power-label",
        text: "VSS",
        position: { x: 65, y: 582 },
        attachedObjectId: port("vss").portId,
        alignment: "end",
      }),
      annotation({
        id: "label-vinp",
        kind: "net-label",
        text: "VIN+",
        position: { x: 90, y: 332 },
        attachedObjectId: netId("vinp"),
        alignment: "end",
      }),
      annotation({
        id: "label-vinn",
        kind: "net-label",
        text: "VIN−",
        position: { x: 730, y: 332 },
        attachedObjectId: netId("vinn"),
        alignment: "start",
      }),
      annotation({
        id: "label-vout",
        kind: "net-label",
        text: "VOUT",
        position: { x: 730, y: 247 },
        attachedObjectId: netId("vout"),
        alignment: "start",
      }),
      annotation({
        id: "label-ibias",
        kind: "net-label",
        text: "IBIAS",
        position: { x: 815, y: 462 },
        attachedObjectId: netId("ibias"),
        alignment: "start",
      }),
    );
    for (const [instanceId, x, y] of [
      ["XM3", 275, 185],
      ["XM4", 535, 185],
      ["XM1", 330, 355],
      ["XM2", 475, 355],
      ["XM5", 435, 485],
      ["XM6", 695, 485],
    ]) {
      labels.push(
        annotation({
          id: `instance-label-${instanceId}`,
          kind: "instance-label",
          text: instanceId,
          position: { x, y },
          attachedObjectId: instanceId,
          alignment: "start",
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
