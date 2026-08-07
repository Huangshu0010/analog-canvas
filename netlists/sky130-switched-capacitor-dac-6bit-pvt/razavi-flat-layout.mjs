const cellOrigins = Array.from({ length: 6 }, (_, index) => 220 + index * 300);
const capacitorXs = cellOrigins.map((origin) => origin + 240);
const unitIds = capacitorXs.map((_, index) => `XU${index}`);
const VOUT_Y = 70;
const CAP_Y = 140;
const PMOS_Y = 300;
const LOGIC_Y = 345;
const NMOS_Y = 390;
const LOCAL_VDD_SYMBOL_Y = 230;
const LOCAL_VDD_JUNCTION_Y = 270;
const LOCAL_GROUND_JUNCTION_Y = 420;
const LOCAL_GROUND_SYMBOL_Y = 460;
const RESET_X = 2140;
const RESET_NET_X = RESET_X + 20;

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

function remapMos(document, instanceId, symbolId) {
  const instance = document.instances.find(
    (candidate) => candidate.id === instanceId,
  );
  if (!instance) throw new Error(`${instanceId} is missing`);
  instance.symbolId = symbolId;
  instance.symbolVariantId = "textbook-3terminal";
  instance.properties = {
    ...instance.properties,
    "spice.pin.D": "D",
    "spice.pin.G": "G",
    "spice.pin.S": "S",
    "spice.pin.B": "B",
  };
  const pinMap = { P1: "D", P2: "G", P3: "S", P4: "B" };
  document.nets = document.nets.map((net) => ({
    ...net,
    terminals: net.terminals.map((terminal) =>
      terminal.instanceId === instanceId
        ? { ...terminal, pinName: pinMap[terminal.pinName] ?? terminal.pinName }
        : terminal,
    ),
  }));
}

function flattenUnits(project, document, unitDocument) {
  const hierarchyDocument = structuredClone(document);
  hierarchyDocument.id = `${document.id}-hierarchical-source`;
  hierarchyDocument.name = "Hierarchical CDAC Source View";
  project.documents.push(hierarchyDocument);

  const unitSet = new Set(unitIds);
  const flattenedNets = document.nets.map((net) => ({
    ...net,
    terminals: net.terminals.filter(
      (terminal) => !unitSet.has(terminal.instanceId),
    ),
  }));
  const parentNetById = new Map(flattenedNets.map((net) => [net.id, net]));
  const parentNetIdByUnitPort = new Map();
  for (const net of document.nets) {
    for (const terminal of net.terminals) {
      if (unitSet.has(terminal.instanceId)) {
        parentNetIdByUnitPort.set(
          `${terminal.instanceId}:${terminal.pinName}`,
          net.id,
        );
      }
    }
  }
  const unitPortNameById = new Map(
    unitDocument.ports.map((port) => [port.id, port.name]),
  );
  const flattenedInstances = document.instances.filter(
    (instance) => !unitSet.has(instance.id),
  );

  for (const unitId of unitIds) {
    for (const childInstance of unitDocument.instances) {
      flattenedInstances.push({
        ...structuredClone(childInstance),
        id: `${unitId}/${childInstance.id}`,
        placement: null,
        properties: {
          ...childInstance.properties,
          "hierarchy.parent": unitId,
          "hierarchy.child": childInstance.id,
        },
      });
    }
    for (const childNet of unitDocument.nets) {
      const childPortNames = childNet.ports
        .map((portId) => unitPortNameById.get(portId))
        .filter(Boolean);
      if (childPortNames.length !== 1) {
        throw new Error(
          `Expected one formal port for ${unitId}/${childNet.name}, found ${childPortNames.length}`,
        );
      }
      const parentNetId = parentNetIdByUnitPort.get(
        `${unitId}:${childPortNames[0]}`,
      );
      const parentNet = parentNetById.get(parentNetId);
      if (!parentNet) {
        throw new Error(
          `Missing parent Net for ${unitId}.${childPortNames[0]}`,
        );
      }
      parentNet.terminals.push(
        ...childNet.terminals.map((terminal) => ({
          instanceId: `${unitId}/${terminal.instanceId}`,
          pinName: terminal.pinName,
        })),
      );
    }
  }

  document.instances = flattenedInstances;
  document.nets = flattenedNets;
  document.routes = [];
  document.junctions = [];
  document.annotations = [];
  document.layoutGroups = [];
  document.constraints = [];
  delete document.sourceBinding;
  document.sourceStatus = "connectivity-modified";
}

function addLocalPowerHelpers(document) {
  const vdd = document.nets.find((net) => net.name === "vdd");
  const vss = document.nets.find((net) => net.name === "vss");
  if (!vdd || !vss) throw new Error("VDD/VSS Nets are missing");

  const helpers = cellOrigins.flatMap((_, index) => [
    {
      instance: {
        id: `PVDD${index}`,
        symbolId: "vdd",
        placement: null,
        properties: { "presentation.role": "local-vdd" },
      },
      net: vdd,
      pinName: "P",
    },
    {
      instance: {
        id: `PGND${index}`,
        symbolId: "ground",
        placement: null,
        properties: { "presentation.role": "local-ground" },
      },
      net: vss,
      pinName: "0",
    },
  ]);
  helpers.push(
    {
      instance: {
        id: "PGND-DUMMY",
        symbolId: "ground",
        placement: null,
        properties: { "presentation.role": "local-ground" },
      },
      net: vss,
      pinName: "0",
    },
    {
      instance: {
        id: "PGND-RESET",
        symbolId: "ground",
        placement: null,
        properties: { "presentation.role": "local-ground" },
      },
      net: vss,
      pinName: "0",
    },
  );
  for (const helper of helpers) {
    document.instances.push(helper.instance);
    helper.net.terminals.push({
      instanceId: helper.instance.id,
      pinName: helper.pinName,
    });
  }
}

export default {
  id: "sky130-cdac-6bit-razavi-flat-v1",
  agentId: "codex-cdac-flat-layout",
  sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "switched_capacitor_dac_6bit",
  outputDocumentName: "6-bit CDAC — Flattened Transistor View",
  projectName: "SKY130 6-bit CDAC — Flattened Razavi View",
  outputBase: "razavi-6bit-cdac-flat",
  exportMargin: 30,

  prepareModel({ project, document }) {
    const unitDocument = project.documents.find(
      (candidate) => candidate.name === "scdac_unit",
    );
    if (!unitDocument) throw new Error("scdac_unit Document is missing");
    remapMos(document, "XRESET", "nmos");
    remapMos(unitDocument, "XDP", "pmos");
    remapMos(unitDocument, "XDN", "nmos");
    remapMos(unitDocument, "XSP", "pmos");
    remapMos(unitDocument, "XSN", "nmos");
    flattenUnits(project, document, unitDocument);
    addLocalPowerHelpers(document);

    const portPositions = {
      vout: { x: 30, y: VOUT_Y },
      vdd: { x: 30, y: LOCAL_VDD_SYMBOL_Y },
      vss: { x: 30, y: LOCAL_GROUND_SYMBOL_Y },
      reset: { x: 2060, y: LOGIC_Y },
      ...Object.fromEntries(
        cellOrigins.map((x, index) => [`b${index}`, { x: x - 25, y: LOGIC_Y }]),
      ),
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
      CDUMMY: [100, CAP_Y, 90, "none"],
      "PGND-DUMMY": [100, 210, 0, "none"],
      XRESET: [RESET_X, LOGIC_Y, 0, "none"],
      "PGND-RESET": [RESET_NET_X, 415, 0, "none"],
    };
    cellOrigins.forEach((origin, index) => {
      const stage1X = origin + 50;
      const stage2X = origin + 150;
      const supplyX = origin + 140;
      placements[`C${index}`] = [capacitorXs[index], CAP_Y, 90, "none"];
      placements[`XU${index}/XDP`] = [stage1X, PMOS_Y, 180, "x"];
      placements[`XU${index}/XDN`] = [stage1X, NMOS_Y, 0, "none"];
      placements[`XU${index}/XSP`] = [stage2X, PMOS_Y, 180, "x"];
      placements[`XU${index}/XSN`] = [stage2X, NMOS_Y, 0, "none"];
      placements[`PVDD${index}`] = [supplyX, LOCAL_VDD_SYMBOL_Y, 0, "none"];
      placements[`PGND${index}`] = [supplyX, LOCAL_GROUND_SYMBOL_Y, 0, "none"];
    });
    for (const [instanceId, [x, y, rotation, mirror]] of Object.entries(
      placements,
    )) {
      structure.push({
        kind: "place_instance",
        instanceId,
        placement: { position: { x, y }, rotation, mirror },
      });
    }

    const voutXs = [100, ...capacitorXs, RESET_NET_X];
    for (const x of voutXs) {
      structure.push({
        kind: "add_junction",
        junctionId: `junction-flat-vout-${x}`,
        netId: netId("vout"),
        position: { x, y: VOUT_Y },
      });
    }
    cellOrigins.forEach((origin, index) => {
      for (const [suffix, netName, pointX] of [
        ["bit", `b${index}`, origin + 10],
        ["nbit-out", `nb${index}`, origin + 70],
        ["nbit-branch", `nb${index}`, origin + 110],
        ["bot-out", `bot${index}`, origin + 170],
        ["bot-cap", `bot${index}`, origin + 240],
      ]) {
        structure.push({
          kind: "add_junction",
          junctionId: `junction-flat-${suffix}-${index}`,
          netId: netId(netName),
          position: { x: pointX, y: LOGIC_Y },
        });
      }
      structure.push(
        {
          kind: "add_junction",
          junctionId: `junction-flat-vdd-local-${index}`,
          netId: netId("vdd"),
          position: { x: origin + 140, y: LOCAL_VDD_JUNCTION_Y },
        },
        {
          kind: "add_junction",
          junctionId: `junction-flat-vss-local-${index}`,
          netId: netId("vss"),
          position: { x: origin + 140, y: LOCAL_GROUND_JUNCTION_Y },
        },
      );
    });

    let routeIndex = 0;
    const addRoute = (netName, from, to, waypoints = [], mode = "manual") => {
      routeIndex += 1;
      routes.push({
        kind: "set_route_points",
        routeId: `route-flat-${String(routeIndex).padStart(3, "0")}`,
        netId: netId(netName),
        from,
        to,
        waypoints,
        segmentModes: Array.from({ length: waypoints.length + 1 }, () => mode),
      });
    };
    const addTrunk = (netName, xs, y, prefix) => {
      for (let index = 0; index < xs.length - 1; index += 1) {
        addRoute(
          netName,
          junction(`${prefix}-${xs[index]}`),
          junction(`${prefix}-${xs[index + 1]}`),
          [],
          "trunk",
        );
      }
    };

    addRoute(
      "vout",
      port("vout"),
      junction("junction-flat-vout-100"),
      [],
      "trunk",
    );
    addTrunk("vout", voutXs, VOUT_Y, "junction-flat-vout");
    addRoute(
      "vout",
      junction("junction-flat-vout-100"),
      terminal("CDUMMY", "1"),
    );
    capacitorXs.forEach((x, index) => {
      addRoute(
        "vout",
        junction(`junction-flat-vout-${x}`),
        terminal(`C${index}`, "1"),
      );
    });
    addRoute(
      "vout",
      junction(`junction-flat-vout-${RESET_NET_X}`),
      terminal("XRESET", "D"),
    );

    addRoute("vss", terminal("CDUMMY", "2"), terminal("PGND-DUMMY", "0"));

    cellOrigins.forEach((origin, index) => {
      const unit = `XU${index}`;
      const bitJunction = junction(`junction-flat-bit-${index}`);
      const nbitOutput = junction(`junction-flat-nbit-out-${index}`);
      const nbitBranch = junction(`junction-flat-nbit-branch-${index}`);
      const botOutput = junction(`junction-flat-bot-out-${index}`);
      const botCap = junction(`junction-flat-bot-cap-${index}`);
      const vddLocal = junction(`junction-flat-vdd-local-${index}`);
      const vssLocal = junction(`junction-flat-vss-local-${index}`);

      addRoute(`b${index}`, port(`b${index}`), bitJunction, [], "trunk");
      addRoute(`b${index}`, bitJunction, terminal(`${unit}/XDP`, "G"), [
        { x: origin + 10, y: PMOS_Y },
      ]);
      addRoute(`b${index}`, bitJunction, terminal(`${unit}/XDN`, "G"), [
        { x: origin + 10, y: NMOS_Y },
      ]);

      addRoute(`nb${index}`, terminal(`${unit}/XDP`, "D"), nbitOutput);
      addRoute(`nb${index}`, terminal(`${unit}/XDN`, "D"), nbitOutput);
      addRoute(`nb${index}`, nbitOutput, nbitBranch, [], "trunk");
      addRoute(`nb${index}`, nbitBranch, terminal(`${unit}/XSP`, "G"), [
        { x: origin + 110, y: PMOS_Y },
      ]);
      addRoute(`nb${index}`, nbitBranch, terminal(`${unit}/XSN`, "G"), [
        { x: origin + 110, y: NMOS_Y },
      ]);

      addRoute(`bot${index}`, terminal(`C${index}`, "2"), botCap);
      addRoute(`bot${index}`, terminal(`${unit}/XSP`, "D"), botOutput);
      addRoute(`bot${index}`, terminal(`${unit}/XSN`, "D"), botOutput);
      addRoute(`bot${index}`, botOutput, botCap, [], "trunk");

      addRoute("vdd", terminal(`PVDD${index}`, "P"), vddLocal);
      addRoute("vdd", vddLocal, terminal(`${unit}/XDP`, "S"));
      addRoute("vdd", vddLocal, terminal(`${unit}/XSP`, "S"));
      addRoute("vss", terminal(`PGND${index}`, "0"), vssLocal);
      addRoute("vss", terminal(`${unit}/XDN`, "S"), vssLocal);
      addRoute("vss", terminal(`${unit}/XSN`, "S"), vssLocal);
    });

    addRoute("reset", port("reset"), terminal("XRESET", "G"));
    addRoute("vss", terminal("XRESET", "S"), terminal("PGND-RESET", "0"));

    labels.push(
      annotation({
        id: "title-flat",
        kind: "plain-text",
        text: "6-BIT CDAC - FLATTENED TRANSISTOR VIEW",
        position: { x: 1100, y: 18 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "caption-flat",
        kind: "figure-caption",
        text: "Six local-supply CMOS bottom-plate drivers; hidden bulk terminals preserve the SPICE connectivity",
        position: { x: 1100, y: 510 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "label-flat-vout",
        kind: "net-label",
        text: "VOUT",
        position: { x: 22, y: VOUT_Y - 8 },
        attachedObjectId: netId("vout"),
        alignment: "end",
      }),
      annotation({
        id: "label-flat-reset",
        kind: "net-label",
        text: "RESET",
        position: { x: 2050, y: LOGIC_Y - 8 },
        attachedObjectId: netId("reset"),
        alignment: "start",
      }),
      annotation({
        id: "instance-label-flat-reset",
        kind: "instance-label",
        text: "XRESET",
        position: { x: 2190, y: LOGIC_Y + 4 },
        attachedObjectId: "XRESET",
        alignment: "start",
      }),
      annotation({
        id: "instance-label-flat-dummy",
        kind: "instance-label",
        text: "CDUMMY  16 fF",
        position: { x: 90, y: CAP_Y + 5 },
        attachedObjectId: "CDUMMY",
        alignment: "end",
      }),
      annotation({
        id: "suppress-label-flat-ground-dummy",
        kind: "instance-label",
        text: "",
        position: { x: 100, y: 235 },
        attachedObjectId: "PGND-DUMMY",
        alignment: "middle",
      }),
      annotation({
        id: "suppress-label-flat-ground-reset",
        kind: "instance-label",
        text: "",
        position: { x: RESET_NET_X, y: 455 },
        attachedObjectId: "PGND-RESET",
        alignment: "middle",
      }),
    );

    const capacitorValues = ["16", "32", "64", "128", "256", "512"];
    cellOrigins.forEach((origin, index) => {
      const x = capacitorXs[index];
      const stage1X = origin + 50;
      const stage2X = origin + 150;
      labels.push(
        annotation({
          id: `instance-label-flat-C${index}`,
          kind: "instance-label",
          text: `C${index}  ${capacitorValues[index]} fF`,
          position: { x: x + 12, y: CAP_Y + 5 },
          attachedObjectId: `C${index}`,
          alignment: "start",
        }),
        annotation({
          id: `label-flat-b${index}`,
          kind: "net-label",
          text: `B${index}`,
          position: { x: origin - 35, y: LOGIC_Y - 8 },
          attachedObjectId: netId(`b${index}`),
          alignment: "end",
        }),
        annotation({
          id: `label-flat-nb${index}`,
          kind: "net-label",
          text: `NB${index}`,
          position: { x: origin + 90, y: LOGIC_Y - 8 },
          attachedObjectId: netId(`nb${index}`),
          alignment: "middle",
        }),
        annotation({
          id: `instance-label-flat-PVDD${index}`,
          kind: "instance-label",
          text: "VDD",
          position: { x: origin + 158, y: LOCAL_VDD_SYMBOL_Y - 17 },
          attachedObjectId: `PVDD${index}`,
          alignment: "start",
        }),
        annotation({
          id: `suppress-label-flat-PGND${index}`,
          kind: "instance-label",
          text: "",
          position: { x: origin + 140, y: LOCAL_GROUND_SYMBOL_Y + 35 },
          attachedObjectId: `PGND${index}`,
          alignment: "middle",
        }),
      );
      for (const [child, shortName, labelX, labelY] of [
        ["XDP", `DP${index}`, stage1X + 40, PMOS_Y - 10],
        ["XDN", `DN${index}`, stage1X + 40, NMOS_Y + 20],
        ["XSP", `SP${index}`, stage2X + 40, PMOS_Y - 10],
        ["XSN", `SN${index}`, stage2X + 40, NMOS_Y + 20],
      ]) {
        labels.push(
          annotation({
            id: `instance-label-flat-XU${index}-${child}`,
            kind: "instance-label",
            text: shortName,
            position: { x: labelX, y: labelY },
            attachedObjectId: `XU${index}/${child}`,
            alignment: "start",
          }),
        );
      }
    });

    if (document.instances.length !== 46) {
      throw new Error(
        `Expected 46 flattened top instances with local power helpers, found ${document.instances.length}`,
      );
    }
    if (document.instances.some((instance) => unitIds.includes(instance.id))) {
      throw new Error("Hierarchy block instances remain in flattened view");
    }
    return [
      { id: "flat-structure", edits: structure },
      { id: "flat-routes", edits: routes },
      { id: "flat-labels", edits: labels },
    ];
  },
};
