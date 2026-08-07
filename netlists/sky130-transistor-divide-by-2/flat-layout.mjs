import {
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "../../packages/derived/dist/index.js";
import { appendFlattenedDocument } from "../../tools/agent-layout/flatten-project.mjs";

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

function safeId(value) {
  return value.replace(/[^A-Za-z0-9_-]/gu, "-");
}

export default {
  id: "sky130-divide-by-2-flat-agent-v1",
  agentId: "codex-divide-by-2-flat-layout",
  sourceRoot: "netlists/sky130-transistor-divide-by-2",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "Rising-Edge Divide-by-Two (Flat)",
  projectName: "SKY130 Transistor Divide-by-Two - Flat View",
  outputBase: "agent-divide-by-2-flat",
  exportMargin: 30,
  exportScale: 3,

  prepareProject({ project }) {
    appendFlattenedDocument(
      project,
      "divide_by_2",
      "Rising-Edge Divide-by-Two (Flat)",
    );
  },

  prepareModel({ document }) {
    const portPositions = {
      clk: { x: 70, y: 380 },
      reset: { x: 70, y: 800 },
      vdd: { x: 1760, y: 60 },
      vss: { x: 1760, y: 940 },
      clkout: { x: 1800, y: 380 },
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

  buildEditPhases({ document, resolver, netId }) {
    const structure = [];
    const routes = [];
    const labels = [];
    const placements = {};

    const inverter = (prefix, x) => {
      placements[`${prefix}__XP`] = [x, 280, 180, "x"];
      placements[`${prefix}__XN`] = [x, 520, 0, "none"];
    };
    inverter("XCLK0", 160);
    inverter("XCLK1", 290);
    inverter("XFF__XI0", 610);
    inverter("XFF__XI1", 740);
    inverter("XFF__XI2", 1180);
    inverter("XFB", 1310);
    inverter("XBUF0", 1440);
    inverter("XBUF1", 1570);

    Object.assign(placements, {
      XFF__XTGM__XN: [480, 350, 90, "none"],
      XFF__XTGM__XP: [480, 450, 270, "none"],
      XFF__XTGF__XN: [675, 600, 90, "none"],
      XFF__XTGF__XP: [675, 700, 270, "none"],
      XFF__XTGS__XN: [880, 350, 90, "none"],
      XFF__XTGS__XP: [880, 450, 270, "none"],
      XFF__XTGB__XN: [1110, 600, 90, "none"],
      XFF__XTGB__XP: [1110, 700, 270, "none"],
      XFF__XNQ__XP0: [1040, 220, 180, "x"],
      XFF__XNQ__XP1: [1040, 320, 180, "x"],
      XFF__XNQ__XN0: [1010, 520, 0, "none"],
      XFF__XNQ__XN1: [1080, 520, 0, "none"],
      CSTATE: [1060, 610, 90, "none"],
      XOUTRST: [1700, 520, 0, "none"],
    });

    const routingDocument = structuredClone(document);
    for (const instance of document.instances) {
      const placement = placements[instance.id];
      if (!placement)
        throw new Error(`Missing flat placement for ${instance.id}`);
      const [x, y, rotation, mirror] = placement;
      const plannedInstance = routingDocument.instances.find(
        (candidate) => candidate.id === instance.id,
      );
      plannedInstance.placement = {
        position: { x, y },
        rotation,
        mirror,
      };
      structure.push({
        kind: "place_instance",
        instanceId: instance.id,
        placement: { position: { x, y }, rotation, mirror },
      });
      if (instance.symbolId === "nmos" || instance.symbolId === "pmos") {
        plannedInstance.symbolVariantId = "textbook-3terminal";
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
        structure.push({
          kind: "set_instance_symbol",
          instanceId: instance.id,
          symbolId: instance.symbolId,
          symbolVariantId: "textbook-3terminal",
        });
      }
    }

    const geometryForEndpoint = (endpoint) => {
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
    const addRoute = (netName, from, to, waypoints = [], modes = "manual") => {
      routeIndex += 1;
      routes.push({
        kind: "set_route_points",
        routeId: `route-flat-${String(routeIndex).padStart(3, "0")}`,
        netId: netId(netName),
        from,
        to,
        waypoints,
        segmentModes: Array.isArray(modes)
          ? modes
          : Array.from({ length: waypoints.length + 1 }, () => modes),
      });
    };
    const addOrthogonalRoute = (netName, from, to) => {
      routeIndex += 1;
      routes.push({
        kind: "route_orthogonal",
        routeId: `route-flat-${String(routeIndex).padStart(3, "0")}`,
        netId: netId(netName),
        from,
        to,
        escapeLength: 20,
      });
    };

    const laneByNet = {
      clk: 400,
      ckb: 160,
      cki: 200,
      d: 760,
      qstate: 360,
      qb: 400,
      clkout: 400,
      reset: 820,
      vdd: 80,
      vss: 920,
      XFF__mm: 400,
      XFF__mmb: 400,
      XFF__mfb: 600,
      XFF__sm: 440,
      XFF__sfb: 640,
      XFF__XNQ__pmid: 270,
    };
    const electricallyLabeledNets = new Set([
      "ckb",
      "cki",
      "d",
      "reset",
      "vdd",
      "vss",
      "XFF__mm",
      "XFF__mmb",
      "XFF__mfb",
      "XFF__sm",
      "XFF__sfb",
    ]);
    const labelPositionOverrides = {
      "ckb:170": { x: 190, y: 392, alignment: "end" },
      "ckb:270": { x: 250, y: 392, alignment: "start" },
      "ckb:1110": { x: 1135, y: 550, alignment: "start" },
      "reset:1020": { x: 990, y: 300, alignment: "start" },
      "vss:750": { x: 770, y: 620, alignment: "start" },
      "vss:1020": { x: 1000, y: 600, alignment: "end" },
      "vss:1090": { x: 1080, y: 600, alignment: "end" },
      "vss:1190": { x: 1210, y: 600, alignment: "start" },
      "XFF__mmb:620": { x: 640, y: 392, alignment: "end" },
      "XFF__mmb:720": { x: 700, y: 392, alignment: "start" },
      "XFF__mmb:900": { x: 960, y: 380, alignment: "start" },
      "XFF__mfb:695": { x: 770, y: 580, alignment: "start" },
      "XFF__sm:1090": { x: 1030, y: 630, alignment: "end" },
      "XFF__sfb:1130": { x: 1200, y: 630, alignment: "start" },
    };
    for (const net of document.nets) {
      const laneY = laneByNet[net.name];
      if (laneY === undefined)
        throw new Error(`Missing routing lane for ${net.name}`);
      const endpoints = [
        ...net.terminals
          .filter((terminal) => terminal.pinName !== "B")
          .map((terminal) => {
            const endpoint = { kind: "terminal", ...terminal };
            return { endpoint, ...geometryForEndpoint(endpoint) };
          }),
        ...net.ports.map((portId) => {
          const port = document.ports.find(
            (candidate) => candidate.id === portId,
          );
          if (!port?.position) throw new Error(`Unplaced flat port ${portId}`);
          return {
            endpoint: { kind: "port", portId },
            point: port.position,
            outward: null,
          };
        }),
      ];
      const isElectricallyLabeled = electricallyLabeledNets.has(net.name);
      const byX = new Map();
      for (const item of endpoints) {
        const columnX =
          !isElectricallyLabeled && item.outward?.x
            ? item.point.x + item.outward.x * 20
            : item.point.x;
        const group = byX.get(columnX) ?? [];
        group.push(item);
        byX.set(columnX, group);
      }
      const columns = [...byX.entries()].sort(
        ([left], [right]) => left - right,
      );
      if (isElectricallyLabeled) {
        for (const [x, items] of columns) {
          const pointYs = items.map((item) => item.point.y);
          const isPower = net.name === "vdd" || net.name === "vss";
          const firstOutward = items[0].outward;
          const sharedOutward =
            firstOutward &&
            items.every(
              (item) =>
                item.outward?.x === firstOutward.x &&
                item.outward?.y === firstOutward.y,
            )
              ? firstOutward
              : null;
          const middleY =
            Math.round((Math.min(...pointYs) + Math.max(...pointYs)) / 20) * 10;
          let junctionPoint;
          if (sharedOutward?.x) {
            junctionPoint = {
              x: x + sharedOutward.x * 40,
              y: middleY,
            };
          } else if (sharedOutward?.y) {
            junctionPoint = {
              x,
              y:
                (sharedOutward.y < 0
                  ? Math.min(...pointYs)
                  : Math.max(...pointYs)) +
                sharedOutward.y * 40,
            };
          } else if (items[0].endpoint.kind === "port") {
            junctionPoint = {
              x: x + (x < 900 ? 40 : -40),
              y: items[0].point.y,
            };
          } else {
            junctionPoint = {
              x: x + 40,
              y: middleY,
            };
          }
          const junctionId = `junction-flat-label-${safeId(net.name)}-${x}`;
          structure.push({
            kind: "add_junction",
            junctionId,
            netId: net.id,
            position: junctionPoint,
            role: "label-anchor",
          });
          const branchPoint =
            items.length > 1 && sharedOutward
              ? sharedOutward.x
                ? { x: x + sharedOutward.x * 20, y: middleY }
                : {
                    x,
                    y:
                      (sharedOutward.y < 0
                        ? Math.min(...pointYs)
                        : Math.max(...pointYs)) +
                      sharedOutward.y * 20,
                  }
              : null;
          const branchJunctionId = branchPoint
            ? `junction-flat-branch-${safeId(net.name)}-${x}`
            : null;
          if (branchPoint && branchJunctionId) {
            structure.push({
              kind: "add_junction",
              junctionId: branchJunctionId,
              netId: net.id,
              position: branchPoint,
              role: "branch",
            });
          }
          for (const item of items) {
            addOrthogonalRoute(net.name, item.endpoint, {
              kind: "junction",
              junctionId: branchJunctionId ?? junctionId,
            });
          }
          if (branchPoint && branchJunctionId) {
            addOrthogonalRoute(
              net.name,
              { kind: "junction", junctionId: branchJunctionId },
              { kind: "junction", junctionId },
            );
          }
          const labelToLeft = sharedOutward?.x === -1;
          const labelPosition = labelPositionOverrides[`${net.name}:${x}`];
          labels.push(
            annotation({
              id: `electrical-label-${safeId(net.name)}-${x}`,
              kind: isPower ? "power-label" : "net-label",
              text: net.name.replace(/^XFF__/u, "").toUpperCase(),
              position: labelPosition
                ? { x: labelPosition.x, y: labelPosition.y }
                : {
                    x: junctionPoint.x + (labelToLeft ? -8 : 8),
                    y:
                      junctionPoint.y +
                      (sharedOutward?.y === 1 ||
                      net.name === "reset" ||
                      net.name === "vss"
                        ? 20
                        : -8),
                  },
              attachedObjectId: junctionId,
              alignment:
                labelPosition?.alignment ?? (labelToLeft ? "end" : "start"),
            }),
          );
        }
        continue;
      }
      for (const [columnIndex, [x, items]] of columns.entries()) {
        const junctionId = `junction-flat-${safeId(net.name)}-${x}`;
        const routeDegree =
          items.length +
          (columnIndex > 0 ? 1 : 0) +
          (columnIndex < columns.length - 1 ? 1 : 0);
        structure.push({
          kind: "add_junction",
          junctionId,
          netId: net.id,
          position: { x, y: laneY },
          role: routeDegree >= 3 ? "branch" : "route-anchor",
        });
        for (const item of items) {
          if (item.point.y === laneY) {
            throw new Error(
              `Routing lane collides with ${net.name} endpoint at ${x}`,
            );
          }
          addOrthogonalRoute(net.name, item.endpoint, {
            kind: "junction",
            junctionId,
          });
        }
      }
      for (let index = 1; index < columns.length; index += 1) {
        const leftX = columns[index - 1][0];
        const rightX = columns[index][0];
        addRoute(
          net.name,
          {
            kind: "junction",
            junctionId: `junction-flat-${safeId(net.name)}-${leftX}`,
          },
          {
            kind: "junction",
            junctionId: `junction-flat-${safeId(net.name)}-${rightX}`,
          },
          [],
          "trunk",
        );
      }
    }

    const designators = {
      XCLK0__XP: "M1",
      XCLK0__XN: "M2",
      XCLK1__XP: "M3",
      XCLK1__XN: "M4",
      XFF__XTGM__XN: "M5",
      XFF__XTGM__XP: "M6",
      XFF__XI0__XP: "M7",
      XFF__XI0__XN: "M8",
      XFF__XI1__XP: "M9",
      XFF__XI1__XN: "M10",
      XFF__XTGF__XN: "M11",
      XFF__XTGF__XP: "M12",
      XFF__XTGS__XN: "M13",
      XFF__XTGS__XP: "M14",
      XFF__XNQ__XP0: "M15",
      XFF__XNQ__XP1: "M16",
      XFF__XNQ__XN0: "M17",
      XFF__XNQ__XN1: "M18",
      XFF__XI2__XP: "M19",
      XFF__XI2__XN: "M20",
      XFF__XTGB__XN: "M21",
      XFF__XTGB__XP: "M22",
      XFB__XP: "M23",
      XFB__XN: "M24",
      XBUF0__XP: "M25",
      XBUF0__XN: "M26",
      XBUF1__XP: "M27",
      XBUF1__XN: "M28",
      XOUTRST: "M29",
      CSTATE: "C1",
    };
    for (const instance of document.instances) {
      const [x, y] = placements[instance.id];
      labels.push(
        annotation({
          id: `instance-label-${safeId(instance.id)}`,
          kind: "instance-label",
          text: designators[instance.id],
          position: { x: x + 50, y },
          attachedObjectId: instance.id,
          alignment: "start",
        }),
      );
    }

    for (const [id, text, x, y, alignment = "middle"] of [
      ["title-clock", "CLOCK PHASE GENERATOR", 225, 110],
      ["title-master", "MASTER LATCH", 650, 110],
      ["title-slave", "SLAVE / RESET", 990, 110],
      ["title-output", "FEEDBACK + OUTPUT", 1450, 110],
      ["label-clk", "CLK", 55, 372, "end"],
      ["label-q", "Q", 1130, 345, "middle"],
      ["label-out", "CLKOUT", 1815, 372, "start"],
    ]) {
      labels.push(
        annotation({
          id,
          kind: "plain-text",
          text,
          position: { x, y },
          alignment,
        }),
      );
    }

    if (
      document.instances.length !== 30 ||
      document.instances.some((instance) =>
        instance.symbolId.startsWith("hierarchical-symbol-"),
      )
    ) {
      throw new Error(
        "Flat Document must contain exactly 30 primitive instances",
      );
    }
    return [
      { id: "flat-structure", edits: structure },
      { id: "flat-routes", edits: routes },
      { id: "flat-labels", edits: labels },
    ];
  },
};
