// Agent-authored 6-bit switched-capacitor DAC, flat transistor-level view.
//
// The Agent explicitly defines every visible Net endpoint, branch, bend and
// shared segment. @icm/agent-routing only validates and expands that Route
// graph into typed edits. No shape enum or automatic waypoint choice is used.

import {
  isVisibleEndpoint,
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "../../packages/derived/dist/index.js";
import { expandRouteGraph } from "../../packages/agent-routing/dist/index.js";
import { transformPoint } from "../../packages/model/dist/index.js";
import { appendFlattenedDocument } from "../../tools/agent-layout/flatten-project.mjs";

const CELL_ORIGINS = Array.from({ length: 6 }, (_, index) => 220 + index * 300);
const CAPACITOR_XS = CELL_ORIGINS.map((origin) => origin + 240);
const VOUT_Y = 70;
const CAP_Y = 90;
const PMOS_Y = 310;
const LOGIC_Y = 350;
const NMOS_Y = 390;
const LOCAL_VDD_Y = 230;
const LOCAL_VSS_Y = 460;
const RESET_X = 2140;
const RESET_Y = 90;

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
  id: "sky130-scdac-6bit-flat-route-graph",
  agentId: "codex-scdac-flat-route-graph",
  sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "Flat CDAC (transistor-level)",
  projectName: "SKY130 6-bit Switched-Capacitor DAC (flat transistor-level)",
  outputBase: "agent-scdac-newarch",
  exportMargin: 30,
  exportScale: 3,
  requireComplete: true,
  maxCrossings: 0,
  blockingVisualDiagnosticCodes: [
    "VISUAL_LABEL_OVERLAP",
    "VISUAL_ROUTE_OVERLAP",
    "VISUAL_SYMBOL_OVERLAP",
    "VISUAL_WIRE_THROUGH_SYMBOL",
  ],

  prepareProject({ project }) {
    const sourceName = "switched_capacitor_dac_6bit";
    const flatName = "Flat CDAC (transistor-level)";
    project.documents = project.documents.filter(
      (document) => document.name !== flatName,
    );
    const flat = appendFlattenedDocument(project, sourceName, flatName);
    for (const instance of flat.instances) {
      if (instance.symbolId === "nmos" || instance.symbolId === "pmos") {
        instance.symbolVariantId = "textbook-3terminal";
      }
    }
    project.topDocumentId = flat.id;
  },

  prepareModel({ document }) {
    document.presentation = {
      ...document.presentation,
      styleProfileId: "razavi-textbook-v1",
      compactness: "compact",
      flow: { power: "top", ground: "bottom", input: "left", output: "right" },
    };
  },

  buildEditPhases({ document, resolver, netId }) {
    const structure = [];
    const labels = [];

    // One reasoned unit is repeated by translation: inverter pair on the left,
    // VDD/VSS switch pair on the right, and its binary-weighted capacitor above.
    const placements = {
      CDUMMY: [100, CAP_Y, 0, "none"],
      XRESET: [RESET_X, RESET_Y, 0, "none"],
    };
    for (let index = 0; index < 6; index += 1) {
      const origin = CELL_ORIGINS[index];
      placements[`C${index}`] = [CAPACITOR_XS[index], CAP_Y, 0, "none"];
      placements[`XU${index}__XDP`] = [origin + 50, PMOS_Y, 180, "x"];
      placements[`XU${index}__XDN`] = [origin + 50, NMOS_Y, 0, "none"];
      placements[`XU${index}__XSP`] = [origin + 150, PMOS_Y, 180, "x"];
      placements[`XU${index}__XSN`] = [origin + 150, NMOS_Y, 0, "none"];
    }

    const portPositions = {
      vout: { x: 70, y: VOUT_Y },
      vdd: { x: 70, y: LOCAL_VDD_Y },
      vss: { x: 70, y: LOCAL_VSS_Y },
      reset: { x: RESET_X - 90, y: RESET_Y },
      ...Object.fromEntries(
        CELL_ORIGINS.map((origin, index) => [
          `b${index}`,
          { x: origin - 30, y: LOGIC_Y },
        ]),
      ),
    };

    const routingDocument = structuredClone(document);
    for (const instance of document.instances) {
      const placement = placements[instance.id];
      if (!placement) throw new Error(`No placement for ${instance.id}`);
      const [x, y, rotation, mirror] = placement;
      const planned = routingDocument.instances.find(
        (candidate) => candidate.id === instance.id,
      );
      planned.placement = { position: { x, y }, rotation, mirror };
      structure.push({
        kind: "place_instance",
        instanceId: instance.id,
        placement: { position: { x, y }, rotation, mirror },
      });
    }
    for (const port of document.ports) {
      const position = portPositions[port.name];
      if (!position) throw new Error(`No port placement for ${port.name}`);
      const planned = routingDocument.ports.find(
        (candidate) => candidate.id === port.id,
      );
      planned.position = position;
      structure.push({ kind: "place_port", portId: port.id, position });
    }

    const endpointId = (netName, instanceId, pinName) =>
      `${netName}:${instanceId}.${pinName}`;
    const portEndpointId = (netName) => {
      const port = document.ports.find(
        (candidate) => candidate.name === netName,
      );
      if (!port) throw new Error(`Missing port ${netName}`);
      return endpointId(netName, port.id, "");
    };

    // Build the complete visible endpoint map. Hidden bulk pins remain in the
    // electrical Net but are intentionally not Route endpoints for the
    // textbook three-terminal symbol.
    const endpoints = new Map();
    const endpointIdsByNet = new Map();
    for (const net of document.nets) {
      const ids = [];
      for (const item of net.terminals ?? []) {
        const endpoint = {
          kind: "terminal",
          instanceId: item.instanceId,
          pinName: item.pinName,
        };
        if (!isVisibleEndpoint(routingDocument, resolver, endpoint)) continue;
        const point = resolveEndpointPoint(routingDocument, resolver, endpoint);
        if (!point)
          throw new Error(
            `Unresolved endpoint ${item.instanceId}.${item.pinName}`,
          );
        const id = endpointId(net.name, item.instanceId, item.pinName);
        endpoints.set(id, {
          id,
          endpoint,
          point,
          outward: resolveEndpointOutwardDirection(
            routingDocument,
            resolver,
            endpoint,
          ),
        });
        ids.push(id);
      }
      for (const portId of net.ports ?? []) {
        const port = routingDocument.ports.find(
          (candidate) => candidate.id === portId,
        );
        if (!port?.position) throw new Error(`Unplaced port ${portId}`);
        const id = endpointId(net.name, port.id, "");
        endpoints.set(id, {
          id,
          endpoint: { kind: "port", portId },
          point: port.position,
          outward: null,
        });
        ids.push(id);
      }
      endpointIdsByNet.set(net.name, ids);
    }

    const instanceBoxes = [];
    for (const instance of routingDocument.instances) {
      if (!instance.placement) continue;
      const resolved = resolver.resolve(
        instance.symbolId,
        instance.symbolVariantId,
      );
      if (!resolved) continue;
      const box = resolved.definition.viewBox;
      const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x, y: box.y + box.height },
        { x: box.x + box.width, y: box.y + box.height },
      ].map((point) =>
        transformPoint(point, instance.placement.position, instance.placement),
      );
      instanceBoxes.push({
        instanceId: instance.id,
        min: {
          x: Math.min(...corners.map((corner) => corner.x)),
          y: Math.min(...corners.map((corner) => corner.y)),
        },
        max: {
          x: Math.max(...corners.map((corner) => corner.x)),
          y: Math.max(...corners.map((corner) => corner.y)),
        },
      });
    }

    const graphs = new Map();
    const graphFor = (name) => {
      const graph = {
        documentId: document.id,
        revision: 0,
        netId: netId(name),
        nodes: [],
        edges: [],
      };
      graphs.set(name, graph);
      return graph;
    };
    const addEndpoint = (graph, id) => {
      const resolved = endpoints.get(id);
      if (!resolved) throw new Error(`Missing visible endpoint ${id}`);
      graph.nodes.push({ id, role: "endpoint", endpoint: resolved.endpoint });
      return id;
    };
    const addNode = (graph, id, role, x, y) => {
      graph.nodes.push({ id, role, at: { x, y } });
      return id;
    };
    const addEdge = (graph, id, from, to, role = "link") => {
      graph.edges.push({ id, from, to, role });
    };
    const term = (netName, instanceId, pinName) =>
      endpointId(netName, instanceId, pinName);

    // VOUT common plate: every capacitor top plate, reset drain and output
    // port lie on one explicit horizontal chain.
    {
      const graph = graphFor("vout");
      const ordered = [
        portEndpointId("vout"),
        term("vout", "CDUMMY", "1"),
        ...Array.from({ length: 6 }, (_, index) =>
          term("vout", `C${index}`, "1"),
        ),
        term("vout", "XRESET", "D"),
      ].map((id) => addEndpoint(graph, id));
      for (let index = 1; index < ordered.length; index += 1) {
        addEdge(
          graph,
          `vout-segment-${index - 1}`,
          ordered[index - 1],
          ordered[index],
          "link",
        );
      }
    }

    // Reset control is a direct horizontal connection.
    {
      const graph = graphFor("reset");
      const port = addEndpoint(graph, portEndpointId("reset"));
      const gate = addEndpoint(graph, term("reset", "XRESET", "G"));
      addEdge(graph, "reset-control", port, gate);
    }

    // VDD/VSS are explicit local islands joined by equal power labels. This
    // avoids unreadable full-page rails while preserving visible connectivity.
    const vdd = graphFor("vdd");
    const vddPort = addEndpoint(vdd, portEndpointId("vdd"));
    const vddPortAnchor = addNode(
      vdd,
      "vdd-label-port",
      "label-anchor",
      100,
      LOCAL_VDD_Y,
    );
    addEdge(vdd, "vdd-port-link", vddPort, vddPortAnchor);
    labels.push(
      annotation({
        id: "power-vdd-port",
        kind: "power-label",
        text: "VDD",
        attachedObjectId: vddPortAnchor,
        position: { x: 100, y: LOCAL_VDD_Y - 10 },
        alignment: "middle",
      }),
    );

    const vss = graphFor("vss");
    const vssPort = addEndpoint(vss, portEndpointId("vss"));
    const vssPortAnchor = addNode(
      vss,
      "vss-label-port",
      "label-anchor",
      100,
      LOCAL_VSS_Y,
    );
    addEdge(vss, "vss-port-link", vssPort, vssPortAnchor);
    labels.push(
      annotation({
        id: "power-vss-port",
        kind: "power-label",
        text: "VSS",
        attachedObjectId: vssPortAnchor,
        position: { x: 100, y: LOCAL_VSS_Y + 18 },
        alignment: "middle",
      }),
    );

    for (let index = 0; index < 6; index += 1) {
      const origin = CELL_ORIGINS[index];

      // Local VDD rail for the two PMOS source pins.
      const dpSource = addEndpoint(vdd, term("vdd", `XU${index}__XDP`, "S"));
      const spSource = addEndpoint(vdd, term("vdd", `XU${index}__XSP`, "S"));
      const vddLeft = addNode(
        vdd,
        `vdd-${index}-left`,
        "bend",
        origin + 60,
        LOCAL_VDD_Y,
      );
      const vddLabel = addNode(
        vdd,
        `vdd-${index}-label`,
        "label-anchor",
        origin + 110,
        LOCAL_VDD_Y,
      );
      const vddRight = addNode(
        vdd,
        `vdd-${index}-right`,
        "bend",
        origin + 160,
        LOCAL_VDD_Y,
      );
      addEdge(vdd, `vdd-${index}-dp`, dpSource, vddLeft, "escape");
      addEdge(vdd, `vdd-${index}-left-label`, vddLeft, vddLabel, "trunk");
      addEdge(vdd, `vdd-${index}-label-right`, vddLabel, vddRight, "trunk");
      addEdge(vdd, `vdd-${index}-sp`, spSource, vddRight, "escape");
      labels.push(
        annotation({
          id: `power-vdd-${index}`,
          kind: "power-label",
          text: "VDD",
          attachedObjectId: vddLabel,
          position: { x: origin + 110, y: LOCAL_VDD_Y - 10 },
          alignment: "middle",
        }),
      );

      // Local VSS rail for the two NMOS source pins.
      const dnSource = addEndpoint(vss, term("vss", `XU${index}__XDN`, "S"));
      const snSource = addEndpoint(vss, term("vss", `XU${index}__XSN`, "S"));
      const vssLeft = addNode(
        vss,
        `vss-${index}-left`,
        "bend",
        origin + 60,
        LOCAL_VSS_Y,
      );
      const vssLabel = addNode(
        vss,
        `vss-${index}-label`,
        "label-anchor",
        origin + 110,
        LOCAL_VSS_Y,
      );
      const vssRight = addNode(
        vss,
        `vss-${index}-right`,
        "bend",
        origin + 160,
        LOCAL_VSS_Y,
      );
      addEdge(vss, `vss-${index}-dn`, dnSource, vssLeft, "escape");
      addEdge(vss, `vss-${index}-left-label`, vssLeft, vssLabel, "trunk");
      addEdge(vss, `vss-${index}-label-right`, vssLabel, vssRight, "trunk");
      addEdge(vss, `vss-${index}-sn`, snSource, vssRight, "escape");
      labels.push(
        annotation({
          id: `power-vss-${index}`,
          kind: "power-label",
          text: "VSS",
          attachedObjectId: vssLabel,
          position: { x: origin + 110, y: LOCAL_VSS_Y + 18 },
          alignment: "middle",
        }),
      );

      // B: one branch point feeds both inverter gates.
      const bit = graphFor(`b${index}`);
      const bitPort = addEndpoint(bit, portEndpointId(`b${index}`));
      const dpGate = addEndpoint(
        bit,
        term(`b${index}`, `XU${index}__XDP`, "G"),
      );
      const dnGate = addEndpoint(
        bit,
        term(`b${index}`, `XU${index}__XDN`, "G"),
      );
      const bitTop = addNode(bit, `b${index}-top`, "bend", origin, PMOS_Y);
      const bitBranch = addNode(
        bit,
        `b${index}-branch`,
        "tap",
        origin,
        LOGIC_Y,
      );
      const bitBottom = addNode(
        bit,
        `b${index}-bottom`,
        "bend",
        origin,
        NMOS_Y,
      );
      addEdge(bit, `b${index}-port`, bitPort, bitBranch);
      addEdge(bit, `b${index}-dp`, dpGate, bitTop, "escape");
      addEdge(bit, `b${index}-upper`, bitTop, bitBranch, "trunk");
      addEdge(bit, `b${index}-lower`, bitBranch, bitBottom, "trunk");
      addEdge(bit, `b${index}-dn`, dnGate, bitBottom, "escape");

      // NB: DP/DN drains meet at one inverter-output branch. A short
      // horizontal handoff feeds one vertical SP/SN gate fanout.
      const nb = graphFor(`nb${index}`);
      const dpDrain = addEndpoint(
        nb,
        term(`nb${index}`, `XU${index}__XDP`, "D"),
      );
      const dnDrain = addEndpoint(
        nb,
        term(`nb${index}`, `XU${index}__XDN`, "D"),
      );
      const spGate = addEndpoint(
        nb,
        term(`nb${index}`, `XU${index}__XSP`, "G"),
      );
      const snGate = addEndpoint(
        nb,
        term(`nb${index}`, `XU${index}__XSN`, "G"),
      );
      const nbOutput = addNode(
        nb,
        `nb${index}-output`,
        "tap",
        origin + 60,
        LOGIC_Y,
      );
      const nbGateBranch = addNode(
        nb,
        `nb${index}-gate-branch`,
        "tap",
        origin + 110,
        LOGIC_Y,
      );
      const nbSpEscape = addNode(
        nb,
        `nb${index}-sp-escape`,
        "bend",
        origin + 110,
        PMOS_Y,
      );
      const nbSnEscape = addNode(
        nb,
        `nb${index}-sn-escape`,
        "bend",
        origin + 110,
        NMOS_Y,
      );
      addEdge(nb, `nb${index}-dp`, dpDrain, nbOutput, "escape");
      addEdge(nb, `nb${index}-dn`, dnDrain, nbOutput, "escape");
      addEdge(nb, `nb${index}-handoff`, nbOutput, nbGateBranch, "link");
      addEdge(nb, `nb${index}-sp-escape`, spGate, nbSpEscape, "escape");
      addEdge(nb, `nb${index}-sp-down`, nbSpEscape, nbGateBranch, "trunk");
      addEdge(nb, `nb${index}-sn-escape`, snGate, nbSnEscape, "escape");
      addEdge(nb, `nb${index}-sn-up`, nbGateBranch, nbSnEscape, "trunk");

      // BOT: switch drains share a short trunk; capacitor bottom approaches
      // vertically in a clear corridor to the right of the switch pair.
      const bot = graphFor(`bot${index}`);
      const spDrain = addEndpoint(
        bot,
        term(`bot${index}`, `XU${index}__XSP`, "D"),
      );
      const snDrain = addEndpoint(
        bot,
        term(`bot${index}`, `XU${index}__XSN`, "D"),
      );
      const capBottom = addEndpoint(bot, term(`bot${index}`, `C${index}`, "2"));
      const botBranch = addNode(
        bot,
        `bot${index}-branch`,
        "tap",
        origin + 160,
        LOGIC_Y,
      );
      const capTurn = addNode(
        bot,
        `bot${index}-cap-turn`,
        "bend",
        CAPACITOR_XS[index],
        LOGIC_Y,
      );
      addEdge(bot, `bot${index}-sp`, spDrain, botBranch, "escape");
      addEdge(bot, `bot${index}-sn`, snDrain, botBranch, "escape");
      addEdge(bot, `bot${index}-cap-escape`, capBottom, capTurn, "escape");
      addEdge(bot, `bot${index}-cap-link`, capTurn, botBranch);
    }

    // Remaining VSS islands: dummy capacitor and reset transistor.
    const dummyGround = addEndpoint(vss, term("vss", "CDUMMY", "2"));
    const dummyAnchor = addNode(
      vss,
      "vss-dummy-label",
      "label-anchor",
      100,
      170,
    );
    addEdge(vss, "vss-dummy", dummyGround, dummyAnchor, "escape");
    labels.push(
      annotation({
        id: "power-vss-dummy",
        kind: "power-label",
        text: "VSS",
        attachedObjectId: dummyAnchor,
        position: { x: 100, y: 188 },
        alignment: "middle",
      }),
    );

    const resetGround = addEndpoint(vss, term("vss", "XRESET", "S"));
    const resetAnchor = addNode(
      vss,
      "vss-reset-label",
      "label-anchor",
      RESET_X + 10,
      170,
    );
    addEdge(vss, "vss-reset", resetGround, resetAnchor, "escape");
    labels.push(
      annotation({
        id: "power-vss-reset",
        kind: "power-label",
        text: "VSS",
        attachedObjectId: resetAnchor,
        position: { x: RESET_X + 10, y: 188 },
        alignment: "middle",
      }),
    );

    // Structural proof: every visible terminal/port from the flattened SPICE
    // topology must appear exactly once in its Net graph.
    for (const [name, expectedIds] of endpointIdsByNet) {
      const graph = graphs.get(name);
      if (!graph) throw new Error(`No Route graph for Net ${name}`);
      const actualIds = graph.nodes
        .filter((node) => node.role === "endpoint")
        .map((node) => node.id);
      const expected = [...expectedIds].sort();
      const actual = [...actualIds].sort();
      if (
        expected.length !== actual.length ||
        expected.some((id, index) => id !== actual[index])
      ) {
        throw new Error(
          `Endpoint coverage mismatch for ${name}: expected ${expected.join(", ")}; got ${actual.join(", ")}`,
        );
      }
    }

    const routes = [];
    const accumulatedPolylines = [];
    for (const [name, graph] of graphs) {
      const expansion = expandRouteGraph(graph, {
        endpoints,
        existingRoutePolylines: accumulatedPolylines,
        instanceBoxes,
      });
      if (expansion.conflicts.length > 0) {
        throw new Error(
          `Route graph ${name} rejected: ${expansion.conflicts
            .map((conflict) => `${conflict.code}: ${conflict.message}`)
            .join("; ")}`,
        );
      }
      routes.push(...expansion.edits);
      accumulatedPolylines.push(
        ...expansion.resolvedGeometry.map((geometry) => ({
          routeId: geometry.routeId,
          points: geometry.points,
        })),
      );
    }

    labels.push(
      annotation({
        id: "title-cdac-flat",
        kind: "plain-text",
        text: "6-BIT SWITCHED-CAPACITOR DAC - FLAT TRANSISTOR VIEW",
        position: { x: 1100, y: 18 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "label-vout",
        kind: "net-label",
        text: "VOUT",
        attachedObjectId: document.ports.find((port) => port.name === "vout")
          .id,
        position: { x: 60, y: VOUT_Y - 10 },
        alignment: "end",
      }),
      annotation({
        id: "label-reset",
        kind: "net-label",
        text: "RESET",
        attachedObjectId: document.ports.find((port) => port.name === "reset")
          .id,
        position: { x: RESET_X - 100, y: RESET_Y - 10 },
        alignment: "end",
      }),
      annotation({
        id: "label-reset-instance",
        kind: "instance-label",
        text: "MRESET",
        attachedObjectId: "XRESET",
        position: { x: RESET_X + 45, y: RESET_Y + 8 },
        alignment: "start",
      }),
      annotation({
        id: "label-dummy",
        kind: "instance-label",
        text: "CDUMMY 16 fF",
        attachedObjectId: "CDUMMY",
        position: { x: 90, y: CAP_Y + 5 },
        alignment: "end",
      }),
    );

    const capacitorValues = [16, 32, 64, 128, 256, 512];
    for (let index = 0; index < 6; index += 1) {
      const origin = CELL_ORIGINS[index];
      labels.push(
        annotation({
          id: `label-b${index}`,
          kind: "net-label",
          text: `B${index}`,
          attachedObjectId: document.ports.find(
            (port) => port.name === `b${index}`,
          ).id,
          position: { x: origin - 40, y: LOGIC_Y - 10 },
          alignment: "end",
        }),
        annotation({
          id: `label-nb${index}`,
          kind: "net-label",
          text: `NB${index}`,
          position: { x: origin + 85, y: LOGIC_Y - 10 },
          alignment: "middle",
        }),
        annotation({
          id: `label-C${index}`,
          kind: "instance-label",
          text: `C${index} ${capacitorValues[index]} fF`,
          attachedObjectId: `C${index}`,
          position: { x: CAPACITOR_XS[index] + 12, y: CAP_Y + 5 },
          alignment: "start",
        }),
      );
      for (const [child, text, x, y] of [
        ["XDP", `DP${index}`, origin + 50, PMOS_Y - 28],
        ["XDN", `DN${index}`, origin + 50, NMOS_Y + 32],
        ["XSP", `SP${index}`, origin + 150, PMOS_Y - 28],
        ["XSN", `SN${index}`, origin + 150, NMOS_Y + 32],
      ]) {
        labels.push(
          annotation({
            id: `label-XU${index}-${child}`,
            kind: "instance-label",
            text,
            attachedObjectId: `XU${index}__${child}`,
            position: { x, y },
            alignment: "middle",
          }),
        );
      }
    }

    return [
      { id: "structure", edits: structure },
      { id: "routes", edits: routes },
      { id: "labels", edits: labels },
    ];
  },
};
