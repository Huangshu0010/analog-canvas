import {
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "../../packages/derived/dist/index.js";
import { appendFlattenedDocument } from "../../tools/agent-layout/flatten-project.mjs";

const COLUMN_COUNT = 4;
const CELL_WIDTH = 620;
const CELL_HEIGHT = 500;
const FIRST_CELL_X = 140;
const FIRST_CELL_Y = 280;

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

function safeId(value) {
  return value.replace(/[^A-Za-z0-9_-]/gu, "-");
}

function cellOrigin(index) {
  return {
    x: FIRST_CELL_X + (index % COLUMN_COUNT) * CELL_WIDTH,
    y: FIRST_CELL_Y + Math.floor(index / COLUMN_COUNT) * CELL_HEIGHT,
  };
}

export default {
  id: "sky130-thermometer-trim-resistor-flat-refined-v1",
  agentId: "codex-thermometer-trim-resistor-flat-layout",
  sourceRoot: "netlists/sky130-thermometer-trim-resistor",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "Thermometer Trim Resistor (Flat)",
  projectName: "SKY130 16-Segment Thermometer Trim Resistor - Flat Refined",
  outputBase: "thermometer-trim-resistor-flat-refined",
  exportMargin: 30,
  exportScale: 2,

  prepareProject({ project }) {
    appendFlattenedDocument(
      project,
      "thermometer_trim_resistor",
      "Thermometer Trim Resistor (Flat)",
    );
  },

  prepareModel({ document }) {
    const fixedPortPositions = {
      top: { x: 40, y: 90 },
      bot: { x: 40, y: 130 },
      vdd: { x: 40, y: 170 },
      vss: { x: 40, y: 210 },
    };
    for (let index = 0; index < 16; index += 1) {
      const origin = cellOrigin(index);
      fixedPortPositions[`trim${index}`] = {
        x: origin.x + 10,
        y: origin.y + 400,
      };
    }
    document.ports = document.ports.map((port) => ({
      ...port,
      position: fixedPortPositions[port.name] ?? port.position,
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

  buildEditPhases({ document, resolver, netId, port }) {
    const structure = [];
    const routes = [];
    const labels = [];
    const placements = {};

    for (let index = 0; index < 16; index += 1) {
      const { x, y } = cellOrigin(index);
      const prefix = `XSEG${index}`;
      Object.assign(placements, {
        [`${prefix}__XRA`]: [x + 180, y + 90, 270, "none"],
        [`${prefix}__XTGA__XSN`]: [x + 390, y + 70, 270, "x"],
        [`${prefix}__XTGA__XSP`]: [x + 390, y + 130, 270, "none"],
        [`${prefix}__XTGB__XSN`]: [x + 180, y + 230, 270, "x"],
        [`${prefix}__XTGB__XSP`]: [x + 180, y + 290, 270, "none"],
        [`${prefix}__XRB`]: [x + 390, y + 260, 270, "none"],
        [`${prefix}__XINV__XIP`]: [x + 80, y + 350, 180, "x"],
        [`${prefix}__XINV__XIN`]: [x + 80, y + 430, 0, "none"],
      });
    }

    const routingDocument = structuredClone(document);
    for (const instance of document.instances) {
      const placement = placements[instance.id];
      if (!placement) throw new Error(`Missing placement for ${instance.id}`);
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

      if (instance.symbolId === "nmos" || instance.symbolId === "pmos") {
        const expectedBulk = instance.symbolId === "pmos" ? "vdd" : "vss";
        const bulkNet = document.nets.find((net) =>
          net.terminals.some(
            (terminal) =>
              terminal.instanceId === instance.id && terminal.pinName === "B",
          ),
        );
        if (bulkNet?.name !== expectedBulk) {
          throw new Error(
            `Unsafe hidden bulk for ${instance.id}: ${bulkNet?.name ?? "missing"}`,
          );
        }
        planned.symbolVariantId = "textbook-3terminal";
        structure.push({
          kind: "set_instance_symbol",
          instanceId: instance.id,
          symbolId: instance.symbolId,
          symbolVariantId: "textbook-3terminal",
        });
      } else if (instance.symbolId === "poly-resistor") {
        const bodyNet = document.nets.find((net) =>
          net.terminals.some(
            (terminal) =>
              terminal.instanceId === instance.id && terminal.pinName === "B",
          ),
        );
        if (bodyNet?.name !== "vss") {
          throw new Error(
            `Unsafe hidden resistor body for ${instance.id}: ${bodyNet?.name ?? "missing"}`,
          );
        }
        planned.symbolVariantId = "textbook-2terminal";
        structure.push({
          kind: "set_instance_symbol",
          instanceId: instance.id,
          symbolId: "poly-resistor",
          symbolVariantId: "textbook-2terminal",
        });
      } else {
        throw new Error(
          `Unexpected primitive symbol ${instance.symbolId} on ${instance.id}`,
        );
      }
    }

    const terminal = (instanceId, pinName) => ({
      kind: "terminal",
      instanceId,
      pinName,
    });
    const junction = (junctionId) => ({ kind: "junction", junctionId });
    const endpointGeometry = (endpoint) => {
      const point = resolveEndpointPoint(routingDocument, resolver, endpoint);
      if (!point)
        throw new Error(`Unresolved endpoint ${JSON.stringify(endpoint)}`);
      return {
        point,
        outward: resolveEndpointOutwardDirection(
          routingDocument,
          resolver,
          endpoint,
        ),
      };
    };

    let routeIndex = 0;
    const addOrthogonalRoute = (netName, from, to, escapeLength = 20) => {
      routeIndex += 1;
      routes.push({
        kind: "route_orthogonal",
        routeId: `route-flat-${String(routeIndex).padStart(4, "0")}`,
        netId: netId(netName),
        from,
        to,
        escapeLength,
      });
    };
    const addRoute = (netName, from, to, waypoints = [], mode = "trunk") => {
      routeIndex += 1;
      routes.push({
        kind: "set_route_points",
        routeId: `route-flat-${String(routeIndex).padStart(4, "0")}`,
        netId: netId(netName),
        from,
        to,
        waypoints,
        segmentModes: Array.from({ length: waypoints.length + 1 }, () => mode),
      });
    };
    const addJunction = (id, netName, position, role = "branch") => {
      structure.push({
        kind: "add_junction",
        junctionId: id,
        netId: netId(netName),
        position,
        role,
      });
    };
    const addAttachedLabel = (
      id,
      kind,
      text,
      junctionId,
      position,
      alignment = "start",
    ) => {
      labels.push(
        annotation({
          id,
          kind,
          text,
          position,
          attachedObjectId: junctionId,
          alignment,
        }),
      );
    };
    const addTerminalLabel = (
      netName,
      endpoint,
      text,
      id,
      kind = "net-label",
    ) => {
      const geometry = endpointGeometry(endpoint);
      if (!geometry.outward) {
        throw new Error(`No outward direction for ${JSON.stringify(endpoint)}`);
      }
      const anchor = {
        x: geometry.point.x + geometry.outward.x * 30,
        y: geometry.point.y + geometry.outward.y * 30,
      };
      const junctionId = `junction-label-${safeId(id)}`;
      addJunction(junctionId, netName, anchor, "label-anchor");
      addOrthogonalRoute(netName, endpoint, junction(junctionId));
      const horizontal = geometry.outward.x !== 0;
      addAttachedLabel(
        `label-${safeId(id)}`,
        kind,
        text,
        junctionId,
        {
          x: anchor.x + geometry.outward.x * 8,
          y: anchor.y + geometry.outward.y * 12 - (horizontal ? 7 : 0),
        },
        geometry.outward.x < 0
          ? "end"
          : geometry.outward.x > 0
            ? "start"
            : "middle",
      );
    };

    for (const [name, y, text] of [
      ["top", 90, "TOP"],
      ["bot", 130, "BOT"],
      ["vdd", 170, "VDD"],
      ["vss", 210, "VSS"],
    ]) {
      const junctionId = `junction-global-${name}`;
      addJunction(junctionId, name, { x: 100, y }, "label-anchor");
      addOrthogonalRoute(name, port(name), junction(junctionId));
      addAttachedLabel(
        `label-global-${name}`,
        name === "vdd" || name === "vss" ? "power-label" : "net-label",
        text,
        junctionId,
        { x: 112, y: y - 7 },
      );
    }

    for (let index = 0; index < 16; index += 1) {
      const { x, y } = cellOrigin(index);
      const prefix = `XSEG${index}`;
      const trimB = `${prefix}__trim_b`;
      const trimBJunction = `junction-seg-${index}-trim-b`;

      const addTreeNode = (
        suffix,
        netName,
        position,
        role = "route-anchor",
      ) => {
        const id = `junction-seg-${index}-${suffix}`;
        addJunction(id, netName, position, role);
        return id;
      };
      const topNodes = [
        addTreeNode("top-ra", "top", { x: x + 140, y: y + 90 }),
        addTreeNode("top-tgb-n", "top", { x: x + 140, y: y + 240 }, "branch"),
        addTreeNode("top-tgb-p", "top", { x: x + 140, y: y + 280 }),
      ];
      const botNodes = [
        addTreeNode("bot-tga-n", "bot", { x: x + 430, y: y + 80 }),
        addTreeNode("bot-tga-p", "bot", { x: x + 430, y: y + 120 }, "branch"),
        addTreeNode("bot-rb", "bot", { x: x + 430, y: y + 260 }),
      ];
      const naLeft = addTreeNode("na-left", `${prefix}__na`, {
        x: x + 220,
        y: y + 90,
      });
      const naRightTop = addTreeNode("na-right-top", `${prefix}__na`, {
        x: x + 350,
        y: y + 80,
      });
      const naRightCenter = addTreeNode(
        "na-right-center",
        `${prefix}__na`,
        { x: x + 350, y: y + 90 },
        "branch",
      );
      const naRightBottom = addTreeNode("na-right-bottom", `${prefix}__na`, {
        x: x + 350,
        y: y + 120,
      });
      const nbLeftTop = addTreeNode("nb-left-top", `${prefix}__nb`, {
        x: x + 220,
        y: y + 240,
      });
      const nbLeftCenter = addTreeNode(
        "nb-left-center",
        `${prefix}__nb`,
        { x: x + 220, y: y + 260 },
        "branch",
      );
      const nbLeftBottom = addTreeNode("nb-left-bottom", `${prefix}__nb`, {
        x: x + 220,
        y: y + 280,
      });
      const nbRight = addTreeNode("nb-right", `${prefix}__nb`, {
        x: x + 350,
        y: y + 260,
      });
      const trimNodes = [
        addTreeNode("trim-pgate", `trim${index}`, {
          x: x + 40,
          y: y + 350,
        }),
        addTreeNode(
          "trim-port",
          `trim${index}`,
          { x: x + 40, y: y + 400 },
          "branch",
        ),
        addTreeNode("trim-ngate", `trim${index}`, {
          x: x + 40,
          y: y + 430,
        }),
      ];
      addJunction(trimBJunction, trimB, { x: x + 90, y: y + 390 });

      for (const [endpoint, node] of [
        [terminal(`${prefix}__XRA`, "1"), topNodes[0]],
        [terminal(`${prefix}__XTGB__XSN`, "D"), topNodes[1]],
        [terminal(`${prefix}__XTGB__XSP`, "D"), topNodes[2]],
      ]) {
        addOrthogonalRoute("top", endpoint, junction(node));
      }
      addRoute("top", junction(topNodes[0]), junction(topNodes[1]));
      addRoute("top", junction(topNodes[1]), junction(topNodes[2]));

      for (const [endpoint, node] of [
        [terminal(`${prefix}__XTGA__XSN`, "S"), botNodes[0]],
        [terminal(`${prefix}__XTGA__XSP`, "S"), botNodes[1]],
        [terminal(`${prefix}__XRB`, "2"), botNodes[2]],
      ]) {
        addOrthogonalRoute("bot", endpoint, junction(node));
      }
      addRoute("bot", junction(botNodes[0]), junction(botNodes[1]));
      addRoute("bot", junction(botNodes[1]), junction(botNodes[2]));

      for (const [endpoint, node] of [
        [terminal(`${prefix}__XRA`, "2"), naLeft],
        [terminal(`${prefix}__XTGA__XSN`, "D"), naRightTop],
        [terminal(`${prefix}__XTGA__XSP`, "D"), naRightBottom],
      ]) {
        addOrthogonalRoute(`${prefix}__na`, endpoint, junction(node));
      }
      addRoute(`${prefix}__na`, junction(naRightTop), junction(naRightCenter));
      addRoute(
        `${prefix}__na`,
        junction(naRightCenter),
        junction(naRightBottom),
      );
      addRoute(`${prefix}__na`, junction(naLeft), junction(naRightCenter));

      for (const [endpoint, node] of [
        [terminal(`${prefix}__XTGB__XSN`, "S"), nbLeftTop],
        [terminal(`${prefix}__XTGB__XSP`, "S"), nbLeftBottom],
        [terminal(`${prefix}__XRB`, "1"), nbRight],
      ]) {
        addOrthogonalRoute(`${prefix}__nb`, endpoint, junction(node));
      }
      addRoute(`${prefix}__nb`, junction(nbLeftTop), junction(nbLeftCenter));
      addRoute(`${prefix}__nb`, junction(nbLeftCenter), junction(nbLeftBottom));
      addRoute(`${prefix}__nb`, junction(nbLeftCenter), junction(nbRight));

      for (const [endpoint, node] of [
        [terminal(`${prefix}__XINV__XIP`, "G"), trimNodes[0]],
        [port(`trim${index}`), trimNodes[1]],
        [terminal(`${prefix}__XINV__XIN`, "G"), trimNodes[2]],
      ]) {
        addOrthogonalRoute(`trim${index}`, endpoint, junction(node));
      }
      addRoute(`trim${index}`, junction(trimNodes[0]), junction(trimNodes[1]));
      addRoute(`trim${index}`, junction(trimNodes[1]), junction(trimNodes[2]));
      for (const endpoint of [
        terminal(`${prefix}__XINV__XIP`, "D"),
        terminal(`${prefix}__XINV__XIN`, "D"),
      ]) {
        addOrthogonalRoute(trimB, endpoint, junction(trimBJunction));
      }

      addTerminalLabel(
        `trim${index}`,
        terminal(`${prefix}__XTGA__XSN`, "G"),
        `T${index}`,
        `seg-${index}-tga-n`,
      );
      addTerminalLabel(
        trimB,
        terminal(`${prefix}__XTGA__XSP`, "G"),
        `T${index}B`,
        `seg-${index}-tga-p`,
      );
      addTerminalLabel(
        `trim${index}`,
        terminal(`${prefix}__XTGB__XSN`, "G"),
        `T${index}`,
        `seg-${index}-tgb-n`,
      );
      addTerminalLabel(
        trimB,
        terminal(`${prefix}__XTGB__XSP`, "G"),
        `T${index}B`,
        `seg-${index}-tgb-p`,
      );
      addTerminalLabel(
        "vdd",
        terminal(`${prefix}__XINV__XIP`, "S"),
        "VDD",
        `seg-${index}-vdd`,
        "power-label",
      );
      addTerminalLabel(
        "vss",
        terminal(`${prefix}__XINV__XIN`, "S"),
        "VSS",
        `seg-${index}-vss`,
        "power-label",
      );

      addAttachedLabel(
        `label-seg-${index}-top`,
        "net-label",
        "TOP",
        topNodes[1],
        { x: x + 128, y: y + 213 },
        "end",
      );
      addAttachedLabel(
        `label-seg-${index}-bot`,
        "net-label",
        "BOT",
        botNodes[1],
        { x: x + 442, y: y + 173 },
      );
      addAttachedLabel(
        `label-seg-${index}-trim`,
        "net-label",
        `T${index}`,
        trimNodes[1],
        { x: x + 28, y: y + 393 },
        "end",
      );
      addAttachedLabel(
        `label-seg-${index}-trim-b`,
        "net-label",
        `T${index}B`,
        trimBJunction,
        { x: x + 102, y: y + 383 },
      );

      labels.push(
        annotation({
          id: `title-seg-${index}`,
          kind: "plain-text",
          text: `SEGMENT ${String(index).padStart(2, "0")}`,
          position: { x: x + 290, y: y + 20 },
          alignment: "middle",
          locked: true,
        }),
      );

      const instanceLabels = [
        [`${prefix}__XRA`, `R${index}A`, x + 180, y + 58, "middle"],
        [`${prefix}__XRB`, `R${index}B`, x + 390, y + 292, "middle"],
        [`${prefix}__XINV__XIP`, `PI${index}`, x + 116, y + 345, "start"],
        [`${prefix}__XINV__XIN`, `NI${index}`, x + 116, y + 435, "start"],
      ];
      for (const [
        instanceId,
        text,
        labelX,
        labelY,
        alignment,
      ] of instanceLabels) {
        labels.push(
          annotation({
            id: `instance-label-${safeId(instanceId)}`,
            kind: "instance-label",
            text,
            position: { x: labelX, y: labelY },
            attachedObjectId: instanceId,
            alignment,
          }),
        );
      }
      for (const instanceId of [
        `${prefix}__XTGA__XSN`,
        `${prefix}__XTGA__XSP`,
        `${prefix}__XTGB__XSN`,
        `${prefix}__XTGB__XSP`,
      ]) {
        labels.push(
          annotation({
            id: `suppress-instance-label-${safeId(instanceId)}`,
            kind: "instance-label",
            text: "",
            position: { x, y },
            attachedObjectId: instanceId,
            alignment: "middle",
          }),
        );
      }
      labels.push(
        annotation({
          id: `label-seg-${index}-tga-group`,
          kind: "plain-text",
          text: `TGA${index}`,
          position: { x: x + 438, y: y + 103 },
          alignment: "start",
        }),
        annotation({
          id: `label-seg-${index}-tgb-group`,
          kind: "plain-text",
          text: `TGB${index}`,
          position: { x: x + 228, y: y + 263 },
          alignment: "start",
        }),
      );
    }

    labels.push(
      annotation({
        id: "title-flat",
        kind: "plain-text",
        text: "16-SEGMENT THERMOMETER TRIM RESISTOR - FLAT TRANSISTOR VIEW",
        position: { x: 1320, y: 55 },
        alignment: "middle",
        locked: true,
      }),
      annotation({
        id: "subtitle-flat",
        kind: "figure-caption",
        text: "Symmetric dual-branch high-poly cells; local net labels preserve common TOP/BOT and complementary gate control without long crossing wires",
        position: { x: 1320, y: 2350 },
        alignment: "middle",
        locked: true,
      }),
    );

    if (document.instances.length !== 128) {
      throw new Error(
        `Expected 128 primitive instances, found ${document.instances.length}`,
      );
    }
    if (
      document.instances.some(
        (instance) =>
          instance.symbolId.startsWith("generic-block-") ||
          instance.symbolId.startsWith("hierarchical-symbol-"),
      )
    ) {
      throw new Error(
        "Flat view still contains generic or hierarchical symbols",
      );
    }
    return [
      { id: "flat-structure", edits: structure },
      { id: "flat-routes", edits: routes },
      { id: "flat-labels", edits: labels },
    ];
  },
};
