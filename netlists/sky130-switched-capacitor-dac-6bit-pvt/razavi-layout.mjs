const capacitorXs = [200, 340, 480, 620, 760, 900];
const bitNames = capacitorXs.map((_, index) => `b${index}`);
const unitIds = capacitorXs.map((_, index) => `XU${index}`);
const capacitorIds = capacitorXs.map((_, index) => `C${index}`);

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
  id: "sky130-cdac-6bit-razavi-v1",
  agentId: "codex-cdac-layout",
  sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "switched_capacitor_dac_6bit",
  outputDocumentName: "6-bit Bottom-Plate CDAC",
  projectName: "SKY130 6-bit Bottom-Plate CDAC — Razavi Style",
  outputBase: "razavi-6bit-cdac",
  exportMargin: 30,

  prepareModel({ project, document }) {
    const portPositions = {
      vout: { x: 50, y: 120 },
      vdd: { x: 50, y: 430 },
      vss: { x: 50, y: 500 },
      reset: { x: 970, y: 330 },
      ...Object.fromEntries(
        bitNames.map((name, index) => [
          name,
          { x: capacitorXs[index] + 40, y: 250 },
        ]),
      ),
    };
    document.ports = document.ports.map((port) => ({
      ...port,
      position: portPositions[port.name] ?? port.position,
    }));

    const resetPinMap = { P1: "D", P2: "G", P3: "S", P4: "B" };
    const remapMos = (targetDocument, instanceId, symbolId) => {
      const instance = targetDocument.instances.find(
        (candidate) => candidate.id === instanceId,
      );
      if (!instance) throw new Error(`${instanceId} is missing`);
      instance.symbolId = symbolId;
      delete instance.symbolVariantId;
      instance.properties = {
        ...instance.properties,
        "spice.pin.D": "D",
        "spice.pin.G": "G",
        "spice.pin.S": "S",
        "spice.pin.B": "B",
      };
      targetDocument.nets = targetDocument.nets.map((net) => ({
        ...net,
        terminals: net.terminals.map((terminal) =>
          terminal.instanceId === instanceId
            ? { ...terminal, pinName: resetPinMap[terminal.pinName] }
            : terminal,
        ),
      }));
    };
    remapMos(document, "XRESET", "nmos");
    const unitDocument = project.documents.find(
      (candidate) => candidate.name === "scdac_unit",
    );
    if (!unitDocument) throw new Error("scdac_unit Document is missing");
    remapMos(unitDocument, "XDP", "pmos");
    remapMos(unitDocument, "XDN", "nmos");
    remapMos(unitDocument, "XSP", "pmos");
    remapMos(unitDocument, "XSN", "nmos");
    const unitPortPositions = {
      bit: { x: 50, y: 205 },
      nbit: { x: 350, y: 205 },
      bot: { x: 650, y: 205 },
      vdd: { x: 50, y: 70 },
      vss: { x: 50, y: 350 },
    };
    unitDocument.ports = unitDocument.ports.map((port) => ({
      ...port,
      position: unitPortPositions[port.name] ?? port.position,
    }));
  },

  buildEditPhases({ document, netId, port, terminal, junction }) {
    const structure = [];
    const routes = [];
    const labels = [];
    const placements = {
      CDUMMY: [80, 200, 90],
      XRESET: [1070, 330, 0],
    };
    capacitorXs.forEach((x, index) => {
      placements[`C${index}`] = [x, 200, 90];
      placements[`XU${index}`] = [x + 20, 330, 90];
    });
    for (const [instanceId, [x, y, rotation]] of Object.entries(placements)) {
      structure.push({
        kind: "place_instance",
        instanceId,
        placement: { position: { x, y }, rotation, mirror: "none" },
      });
    }

    const voutXs = [80, ...capacitorXs, 1090];
    const vddXs = capacitorXs.map((x) => x + 20);
    const vssXs = [80, ...capacitorXs.map((x) => x + 40), 1090];
    for (const x of voutXs) {
      structure.push({
        kind: "add_junction",
        junctionId: `junction-vout-${x}`,
        netId: netId("vout"),
        position: { x, y: 120 },
      });
    }
    for (const x of vddXs) {
      structure.push({
        kind: "add_junction",
        junctionId: `junction-vdd-${x}`,
        netId: netId("vdd"),
        position: { x, y: 430 },
      });
    }
    for (const x of vssXs) {
      structure.push({
        kind: "add_junction",
        junctionId: `junction-vss-${x}`,
        netId: netId("vss"),
        position: { x, y: 500 },
      });
    }

    let routeIndex = 0;
    const addRoute = (netName, from, to, waypoints = [], mode = "manual") => {
      routeIndex += 1;
      routes.push({
        kind: "set_route_points",
        routeId: `route-cdac-${String(routeIndex).padStart(3, "0")}`,
        netId: netId(netName),
        from,
        to,
        waypoints,
        segmentModes: Array.from({ length: waypoints.length + 1 }, () => mode),
      });
    };

    addRoute("vout", port("vout"), junction("junction-vout-80"), [], "trunk");
    for (let index = 0; index < voutXs.length - 1; index += 1) {
      addRoute(
        "vout",
        junction(`junction-vout-${voutXs[index]}`),
        junction(`junction-vout-${voutXs[index + 1]}`),
        [],
        "trunk",
      );
    }
    addRoute("vout", junction("junction-vout-80"), terminal("CDUMMY", "1"));
    capacitorXs.forEach((x, index) => {
      addRoute(
        "vout",
        junction(`junction-vout-${x}`),
        terminal(`C${index}`, "1"),
      );
    });
    addRoute("vout", junction("junction-vout-1090"), terminal("XRESET", "D"));

    capacitorXs.forEach((x, index) => {
      addRoute(
        `bot${index}`,
        terminal(`C${index}`, "2"),
        terminal(`XU${index}`, "bot"),
      );
      addRoute(`b${index}`, port(`b${index}`), terminal(`XU${index}`, "bit"));
    });
    addRoute("reset", port("reset"), terminal("XRESET", "G"));

    addRoute(
      "vdd",
      port("vdd"),
      junction(`junction-vdd-${vddXs[0]}`),
      [],
      "trunk",
    );
    for (let index = 0; index < vddXs.length - 1; index += 1) {
      addRoute(
        "vdd",
        junction(`junction-vdd-${vddXs[index]}`),
        junction(`junction-vdd-${vddXs[index + 1]}`),
        [],
        "trunk",
      );
    }
    capacitorXs.forEach((x, index) => {
      addRoute(
        "vdd",
        terminal(`XU${index}`, "vdd"),
        junction(`junction-vdd-${x + 20}`),
      );
    });

    addRoute("vss", port("vss"), junction("junction-vss-80"), [], "trunk");
    for (let index = 0; index < vssXs.length - 1; index += 1) {
      addRoute(
        "vss",
        junction(`junction-vss-${vssXs[index]}`),
        junction(`junction-vss-${vssXs[index + 1]}`),
        [],
        "trunk",
      );
    }
    addRoute("vss", terminal("CDUMMY", "2"), junction("junction-vss-80"));
    capacitorXs.forEach((x, index) => {
      addRoute(
        "vss",
        terminal(`XU${index}`, "vss"),
        junction(`junction-vss-${x + 40}`),
      );
    });
    addRoute("vss", terminal("XRESET", "S"), junction("junction-vss-1090"));
    addRoute("vss", terminal("XRESET", "B"), terminal("XRESET", "S"), [
      { x: 1120, y: 330 },
      { x: 1120, y: 360 },
    ]);

    labels.push(
      annotation({
        id: "title-cdac",
        kind: "plain-text",
        text: "6-BIT BOTTOM-PLATE SWITCHED-CAPACITOR DAC",
        position: { x: 575, y: 45 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "caption-cdac",
        kind: "figure-caption",
        text: "Binary-weighted CDAC: 16, 32, 64, 128, 256, 512 fF + 16 fF dummy",
        position: { x: 575, y: 570 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "label-vout",
        kind: "net-label",
        text: "VOUT",
        position: { x: 42, y: 112 },
        attachedObjectId: netId("vout"),
        alignment: "end",
      }),
      annotation({
        id: "label-vdd",
        kind: "power-label",
        text: "VDD",
        position: { x: 42, y: 422 },
        attachedObjectId: netId("vdd"),
        alignment: "end",
      }),
      annotation({
        id: "label-vss",
        kind: "power-label",
        text: "VSS",
        position: { x: 42, y: 492 },
        attachedObjectId: netId("vss"),
        alignment: "end",
      }),
      annotation({
        id: "label-reset",
        kind: "net-label",
        text: "RESET",
        position: { x: 980, y: 322 },
        attachedObjectId: netId("reset"),
        alignment: "start",
      }),
      annotation({
        id: "instance-label-CDUMMY",
        kind: "instance-label",
        text: "CDUMMY  16 fF",
        position: { x: 70, y: 205 },
        attachedObjectId: "CDUMMY",
        offset: { x: -10, y: 5 },
        alignment: "end",
      }),
      annotation({
        id: "instance-label-XRESET",
        kind: "instance-label",
        text: "XRESET",
        position: { x: 1040, y: 390 },
        attachedObjectId: "XRESET",
        offset: { x: -30, y: 60 },
        alignment: "end",
      }),
    );

    const capacitorValues = [
      "16 fF",
      "32 fF",
      "64 fF",
      "128 fF",
      "256 fF",
      "512 fF",
    ];
    capacitorXs.forEach((x, index) => {
      labels.push(
        annotation({
          id: `instance-label-C${index}`,
          kind: "instance-label",
          text: `C${index}  ${capacitorValues[index]}`,
          position: { x: x + 12, y: 205 },
          attachedObjectId: `C${index}`,
          offset: { x: 12, y: 5 },
          alignment: "start",
        }),
        annotation({
          id: `instance-label-XU${index}`,
          kind: "instance-label",
          text: `XU${index}  SW[${index}]`,
          position: { x: x + 20, y: 334 },
          attachedObjectId: `XU${index}`,
          offset: { x: 0, y: 4 },
          alignment: "middle",
        }),
        annotation({
          id: `label-b${index}`,
          kind: "net-label",
          text: `B${index}`,
          position: { x: x + 40, y: 242 },
          attachedObjectId: netId(`b${index}`),
          alignment: "middle",
        }),
        annotation({
          id: `label-nb${index}`,
          kind: "net-label",
          text: `NB${index}`,
          position: { x: x + 20, y: 280 },
          attachedObjectId: netId(`nb${index}`),
          alignment: "middle",
        }),
      );
    });

    if (document.instances.length !== 14) {
      throw new Error(
        `Expected 14 top-level instances, found ${document.instances.length}`,
      );
    }
    return [
      { id: "structure", edits: structure },
      { id: "routes", edits: routes },
      { id: "labels", edits: labels },
    ];
  },

  additionalDocuments: [
    {
      documentName: "scdac_unit",
      outputDocumentName: "CDAC Bottom-Plate Driver",
      outputBase: "razavi-6bit-cdac-unit",
      buildEditPhases({ document, netId, port, terminal, junction }) {
        const structure = [];
        const routes = [];
        const labels = [];
        const placements = {
          XDP: [240, 130, 180, "x"],
          XDN: [240, 280, 0, "none"],
          XSP: [470, 130, 180, "x"],
          XSN: [470, 280, 0, "none"],
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

        const junctions = [
          ["junction-bit", "bit", 140, 205],
          ["junction-nbit-output", "nbit", 260, 205],
          ["junction-nbit-branch", "nbit", 370, 205],
          ["junction-bot", "bot", 490, 205],
          ["junction-vdd-left", "vdd", 260, 70],
          ["junction-vdd-right", "vdd", 490, 70],
          ["junction-vss-left", "vss", 260, 350],
          ["junction-vss-right", "vss", 490, 350],
        ];
        for (const [junctionId, netName, x, y] of junctions) {
          structure.push({
            kind: "add_junction",
            junctionId,
            netId: netId(netName),
            position: { x, y },
          });
        }

        let routeIndex = 0;
        const addRoute = (
          netName,
          from,
          to,
          waypoints = [],
          mode = "manual",
        ) => {
          routeIndex += 1;
          routes.push({
            kind: "set_route_points",
            routeId: `route-unit-${String(routeIndex).padStart(3, "0")}`,
            netId: netId(netName),
            from,
            to,
            waypoints,
            segmentModes: Array.from(
              { length: waypoints.length + 1 },
              () => mode,
            ),
          });
        };

        addRoute("bit", port("bit"), junction("junction-bit"), [], "trunk");
        addRoute("bit", junction("junction-bit"), terminal("XDP", "G"), [
          { x: 140, y: 130 },
        ]);
        addRoute("bit", junction("junction-bit"), terminal("XDN", "G"), [
          { x: 140, y: 280 },
        ]);

        addRoute(
          "nbit",
          terminal("XDP", "D"),
          junction("junction-nbit-output"),
        );
        addRoute(
          "nbit",
          terminal("XDN", "D"),
          junction("junction-nbit-output"),
        );
        addRoute(
          "nbit",
          junction("junction-nbit-output"),
          port("nbit"),
          [],
          "trunk",
        );
        addRoute(
          "nbit",
          port("nbit"),
          junction("junction-nbit-branch"),
          [],
          "trunk",
        );
        addRoute(
          "nbit",
          junction("junction-nbit-branch"),
          terminal("XSP", "G"),
          [{ x: 370, y: 130 }],
        );
        addRoute(
          "nbit",
          junction("junction-nbit-branch"),
          terminal("XSN", "G"),
          [{ x: 370, y: 280 }],
        );

        addRoute("bot", terminal("XSP", "D"), junction("junction-bot"));
        addRoute("bot", terminal("XSN", "D"), junction("junction-bot"));
        addRoute("bot", junction("junction-bot"), port("bot"), [], "trunk");

        addRoute(
          "vdd",
          port("vdd"),
          junction("junction-vdd-left"),
          [],
          "trunk",
        );
        addRoute(
          "vdd",
          junction("junction-vdd-left"),
          junction("junction-vdd-right"),
          [],
          "trunk",
        );
        addRoute("vdd", junction("junction-vdd-left"), terminal("XDP", "S"));
        addRoute("vdd", terminal("XDP", "B"), terminal("XDP", "S"), [
          { x: 290, y: 130 },
          { x: 290, y: 100 },
        ]);
        addRoute("vdd", junction("junction-vdd-right"), terminal("XSP", "S"));
        addRoute("vdd", terminal("XSP", "B"), terminal("XSP", "S"), [
          { x: 520, y: 130 },
          { x: 520, y: 100 },
        ]);

        addRoute(
          "vss",
          port("vss"),
          junction("junction-vss-left"),
          [],
          "trunk",
        );
        addRoute(
          "vss",
          junction("junction-vss-left"),
          junction("junction-vss-right"),
          [],
          "trunk",
        );
        addRoute("vss", terminal("XDN", "S"), junction("junction-vss-left"));
        addRoute("vss", terminal("XDN", "B"), terminal("XDN", "S"), [
          { x: 300, y: 280 },
          { x: 300, y: 310 },
        ]);
        addRoute("vss", terminal("XSN", "S"), junction("junction-vss-right"));
        addRoute("vss", terminal("XSN", "B"), terminal("XSN", "S"), [
          { x: 530, y: 280 },
          { x: 530, y: 310 },
        ]);

        labels.push(
          annotation({
            id: "title-unit",
            kind: "plain-text",
            text: "CDAC BOTTOM-PLATE DRIVER",
            position: { x: 350, y: 25 },
            alignment: "middle",
            locked: true,
          }),
          annotation({
            id: "caption-unit",
            kind: "figure-caption",
            text: "Two cascaded CMOS inverters: BIT → NBIT → BOT",
            position: { x: 350, y: 405 },
            alignment: "middle",
            locked: true,
          }),
          annotation({
            id: "label-unit-bit",
            kind: "net-label",
            text: "BIT",
            position: { x: 42, y: 197 },
            attachedObjectId: netId("bit"),
            alignment: "end",
          }),
          annotation({
            id: "label-unit-nbit",
            kind: "net-label",
            text: "NBIT",
            position: { x: 350, y: 197 },
            attachedObjectId: netId("nbit"),
            alignment: "middle",
          }),
          annotation({
            id: "label-unit-bot",
            kind: "net-label",
            text: "BOT",
            position: { x: 658, y: 197 },
            attachedObjectId: netId("bot"),
            alignment: "start",
          }),
          annotation({
            id: "label-unit-vdd",
            kind: "power-label",
            text: "VDD",
            position: { x: 42, y: 62 },
            attachedObjectId: netId("vdd"),
            alignment: "end",
          }),
          annotation({
            id: "label-unit-vss",
            kind: "power-label",
            text: "VSS",
            position: { x: 42, y: 342 },
            attachedObjectId: netId("vss"),
            alignment: "end",
          }),
        );
        for (const [instanceId, text, x, y] of [
          ["XDP", "XDP", 320, 145],
          ["XDN", "XDN", 320, 295],
          ["XSP", "XSP", 550, 145],
          ["XSN", "XSN", 550, 295],
        ]) {
          labels.push(
            annotation({
              id: `instance-label-${instanceId}`,
              kind: "instance-label",
              text,
              position: { x, y },
              attachedObjectId: instanceId,
              alignment: "middle",
            }),
          );
        }

        if (document.instances.length !== 4) {
          throw new Error(
            `Expected 4 driver instances, found ${document.instances.length}`,
          );
        }
        return [
          { id: "unit-structure", edits: structure },
          { id: "unit-routes", edits: routes },
          { id: "unit-labels", edits: labels },
        ];
      },
    },
  ],
};
