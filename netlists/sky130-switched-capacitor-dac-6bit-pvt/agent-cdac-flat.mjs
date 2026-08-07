// Agent-generated 6-bit switched-capacitor DAC, top-level hierarchical view.
//
// NEW ARCHITECTURE (route-graph helper): the Agent gives an explicit Route
// graph (nodes + edges with roles) per Net; the @icm/agent-routing helper only
// projects each edge onto legal coordinates. The Agent decides junction count,
// tap order, which edges are trunk vs escape vs link, and where labels go. The
// helper never decides topology, never reroutes. Per ADR 0008.
//
// This recipe does NOT read the directory's pre-existing generated assets.

import {
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "../../packages/derived/dist/index.js";
import { expandRouteGraph } from "../../packages/agent-routing/dist/index.js";
import { transformPoint } from "../../packages/model/dist/index.js";

const GRID = 10;
const snap = (value) => Math.round(value / GRID) * GRID;

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
  id: "sky130-scdac-6bit-agent-route-graph",
  agentId: "codex-scdac-route-graph",
  sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "switched_capacitor_dac_6bit",
  projectName: "SKY130 6-bit Switched-Capacitor DAC (route-graph)",
  outputBase: "agent-scdac-newarch",
  exportMargin: 30,
  exportScale: 3,

  prepareModel({ document }) {
    const portPositions = {
      b0: { x: 60, y: 200 },
      b1: { x: 60, y: 360 },
      b2: { x: 60, y: 520 },
      b3: { x: 60, y: 680 },
      b4: { x: 60, y: 840 },
      b5: { x: 60, y: 1000 },
      reset: { x: 60, y: 1180 },
      vdd: { x: 340, y: 60 },
      vss: { x: 340, y: 1280 },
      vout: { x: 900, y: 640 },
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

  buildEditPhases({ document, resolver, netId, port, terminal, junction }) {
    const structure = [];
    const labels = [];

    // --- Placement ----------------------------------------------------------
    const unitX = 220;
    const unitPitch = 160;
    const unitY = (index) => 200 + index * unitPitch;
    const placements = {};
    for (let index = 0; index < 6; index += 1) {
      placements[`XU${index}`] = [unitX, unitY(index), 0, "none"];
    }
    for (let index = 0; index < 6; index += 1) {
      placements[`C${index}`] = [520, unitY(index) + 20, 0, "none"];
    }
    placements.CDUMMY = [520, unitY(5) + 180, 0, "none"];
    placements.XRESET = [780, 640, 0, "none"];

    const routingDocument = structuredClone(document);
    for (const instance of document.instances) {
      const placement = placements[instance.id];
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
      if (instance.id === "XRESET") {
        planned.symbolVariantId = "textbook-3terminal";
        structure.push({
          kind: "set_instance_symbol",
          instanceId: instance.id,
          symbolId: instance.symbolId,
          symbolVariantId: "textbook-3terminal",
        });
      }
    }

    // --- Resolve endpoint geometry from the placed document ----------------
    const endpointId = (netName, instanceId, pinName) =>
      `${netName}:${instanceId}.${pinName}`;

    const endpoints = new Map();
    for (const n of document.nets) {
      for (const term of n.terminals ?? []) {
        const ep = {
          kind: "terminal",
          instanceId: term.instanceId,
          pinName: term.pinName,
        };
        const point = resolveEndpointPoint(routingDocument, resolver, ep);
        if (!point) continue;
        const outward = resolveEndpointOutwardDirection(
          routingDocument,
          resolver,
          ep,
        );
        endpoints.set(endpointId(n.name, term.instanceId, term.pinName), {
          id: endpointId(n.name, term.instanceId, term.pinName),
          endpoint: ep,
          point,
          outward,
        });
      }
      for (const portId of n.ports ?? []) {
        const portObj = document.ports.find((p) => p.id === portId);
        if (!portObj?.position) continue;
        const ep = { kind: "port", portId };
        endpoints.set(endpointId(n.name, portObj.id, ""), {
          id: endpointId(n.name, portObj.id, ""),
          endpoint: ep,
          point: portObj.position,
          outward: null,
        });
      }
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
          x: Math.min(...corners.map((c) => c.x)),
          y: Math.min(...corners.map((c) => c.y)),
        },
        max: {
          x: Math.max(...corners.map((c) => c.x)),
          y: Math.max(...corners.map((c) => c.y)),
        },
      });
    }

    const expansionInput = {
      endpoints,
      existingRoutePolylines: [],
      instanceBoxes,
    };

    // --- Per-Net RouteGraphs (explicit topology) ---------------------------
    const graphs = [];

    // vout: a vertical common-plate trunk at x=600, one tap per cap.1 pin
    // (aligned to the cap's y), escape edges, and trunk edges linking
    // consecutive taps. XRESET.D and the vout port link to the middle tap.
    const voutCapIds = [0, 1, 2, 3, 4, 5].map((i) =>
      endpointId("vout", `C${i}`, "1"),
    );
    const voutResetId = endpointId("vout", "XRESET", "D");
    const voutPortId = endpointId(
      "vout",
      document.ports.find((p) => p.name === "vout").id,
      "",
    );
    {
      const nodes = [];
      const edges = [];
      const tapIds = [];
      // cap pins are at (520, unitY(i)); tap aligned on y, x offset +80 -> 600.
      voutCapIds.forEach((capId, index) => {
        const tapId = `vout-tap-${index}`;
        tapIds.push(tapId);
        nodes.push({
          id: capId,
          role: "endpoint",
          endpoint: endpoints.get(capId).endpoint,
        });
        nodes.push({
          id: tapId,
          role: "tap",
          alignWith: capId,
          axis: "y",
          offset: 80,
        });
        edges.push({
          id: `vout-esc-${index}`,
          from: capId,
          to: tapId,
          role: "escape",
        });
      });
      // trunk edges between consecutive taps (segmented common plate).
      for (let index = 1; index < tapIds.length; index += 1) {
        edges.push({
          id: `vout-trunk-${index - 1}`,
          from: tapIds[index - 1],
          to: tapIds[index],
          role: "trunk",
        });
      }
      // XRESET.D links to the middle tap (tap index 3, ~y680).
      nodes.push({
        id: voutResetId,
        role: "endpoint",
        endpoint: endpoints.get(voutResetId).endpoint,
      });
      edges.push({
        id: "vout-reset-link",
        from: voutResetId,
        to: tapIds[3],
        role: "link",
      });
      // vout port links to the middle tap.
      nodes.push({
        id: voutPortId,
        role: "endpoint",
        endpoint: endpoints.get(voutPortId).endpoint,
      });
      edges.push({
        id: "vout-port-link",
        from: tapIds[3],
        to: voutPortId,
        role: "link",
      });
      graphs.push({
        documentId: document.id,
        revision: 0,
        netId: netId("vout"),
        nodes,
        edges,
      });
    }

    // vdd: a vertical rail at x=340 (east of units), one tap per unit.vdd,
    // escape + trunk + port link.
    const vddUnitIds = [0, 1, 2, 3, 4, 5].map((i) =>
      endpointId("vdd", `XU${i}`, "vdd"),
    );
    const vddPortId = endpointId(
      "vdd",
      document.ports.find((p) => p.name === "vdd").id,
      "",
    );
    {
      const nodes = [];
      const edges = [];
      const tapIds = [];
      // unit vdd pins are at (260, unitY(i)); tap aligned on y, x offset +80 -> 340.
      vddUnitIds.forEach((unitId, index) => {
        const tapId = `vdd-tap-${index}`;
        tapIds.push(tapId);
        nodes.push({
          id: unitId,
          role: "endpoint",
          endpoint: endpoints.get(unitId).endpoint,
        });
        nodes.push({
          id: tapId,
          role: "tap",
          alignWith: unitId,
          axis: "y",
          offset: 80,
        });
        edges.push({
          id: `vdd-esc-${index}`,
          from: unitId,
          to: tapId,
          role: "escape",
        });
      });
      for (let index = 1; index < tapIds.length; index += 1) {
        edges.push({
          id: `vdd-trunk-${index - 1}`,
          from: tapIds[index - 1],
          to: tapIds[index],
          role: "trunk",
        });
      }
      // vdd port links to the top tap.
      nodes.push({
        id: vddPortId,
        role: "endpoint",
        endpoint: endpoints.get(vddPortId).endpoint,
      });
      edges.push({
        id: "vdd-port-link",
        from: vddPortId,
        to: tapIds[0],
        role: "link",
      });
      graphs.push({
        documentId: document.id,
        revision: 0,
        netId: netId("vdd"),
        nodes,
        edges,
      });
    }

    // vss: labeled islands. Each unit.vss + nearby XRESET.S/B + CDUMMY.2 get a
    // local branch junction at a snap center; labels declare connectivity by
    // name. No cross-island wire.
    const vssUnitIds = [0, 1, 2, 3, 4, 5].map((i) =>
      endpointId("vss", `XU${i}`, "vss"),
    );
    const vssResetS = endpointId("vss", "XRESET", "S");
    const vssResetB = endpointId("vss", "XRESET", "B");
    const vssDummy = endpointId("vss", "CDUMMY", "2");
    const vssPortId = endpointId(
      "vss",
      document.ports.find((p) => p.name === "vss").id,
      "",
    );
    {
      const nodes = [];
      const edges = [];
      let nodeIdx = 0;
      const addIsland = (islandId, epIds, center) => {
        epIds.forEach((epId, i) => {
          nodes.push({
            id: epId,
            role: "endpoint",
            endpoint: endpoints.get(epId).endpoint,
          });
          edges.push({
            id: `vss-esc-${islandId}-${i}`,
            from: epId,
            to: islandId,
            role: "escape",
          });
        });
        nodes.push({ id: islandId, role: "junction", at: center });
        edges.push({
          id: `vss-label-${islandId}`,
          from: islandId,
          to: islandId,
          role: "label",
          label: { text: "VSS", attachedObjectId: islandId },
        });
      };
      // One island per unit (local vss at its vss pin y), plus a reset island.
      vssUnitIds.forEach((unitId, index) => {
        addIsland(`vss-j-${index}`, [unitId], { x: 320, y: unitY(index) - 20 });
        nodeIdx += 1;
      });
      // Reset island: XRESET.S + XRESET.B + CDUMMY.2 + vss port.
      addIsland("vss-j-reset", [vssResetS, vssResetB, vssDummy, vssPortId], {
        x: 320,
        y: 660,
      });
      graphs.push({
        documentId: document.id,
        revision: 0,
        netId: netId("vss"),
        nodes,
        edges,
      });
    }

    // bot/b/reset: direct escape edges (single edge each).
    const directGraph = (netName) => {
      const epIds = [
        ...(document.nets.find((n) => n.name === netName)?.terminals ?? []).map(
          (t) => endpointId(netName, t.instanceId, t.pinName),
        ),
      ];
      const portEpId = endpointId(
        netName,
        document.ports.find((p) => p.name === netName).id,
        "",
      );
      epIds.push(portEpId);
      if (epIds.length !== 2) return null;
      const [aId, bId] = epIds;
      return {
        documentId: document.id,
        revision: 0,
        netId: netId(netName),
        nodes: [
          { id: aId, role: "endpoint", endpoint: endpoints.get(aId).endpoint },
          { id: bId, role: "endpoint", endpoint: endpoints.get(bId).endpoint },
        ],
        edges: [{ id: `${netName}-direct`, from: aId, to: bId, role: "link" }],
      };
    };
    for (const name of ["reset", ...[0, 1, 2, 3, 4, 5].map((i) => `b${i}`)]) {
      const g = directGraph(name);
      if (g) graphs.push(g);
    }
    // bot0..5: unit.bot + cap.2 pair -> direct.
    for (let index = 0; index < 6; index += 1) {
      const aId = endpointId(`bot${index}`, `XU${index}`, "bot");
      const bId = endpointId(`bot${index}`, `C${index}`, "2");
      graphs.push({
        documentId: document.id,
        revision: 0,
        netId: netId(`bot${index}`),
        nodes: [
          { id: aId, role: "endpoint", endpoint: endpoints.get(aId).endpoint },
          { id: bId, role: "endpoint", endpoint: endpoints.get(bId).endpoint },
        ],
        edges: [{ id: `bot${index}-direct`, from: aId, to: bId, role: "link" }],
      });
    }

    // --- Expand each graph into typed edits --------------------------------
    const routes = [];
    let conflictCount = 0;
    for (const graph of graphs) {
      const expansion = expandRouteGraph(graph, expansionInput);
      if (expansion.conflicts.length > 0) {
        conflictCount += expansion.conflicts.length;
        for (const conflict of expansion.conflicts) {
          labels.push(
            annotation({
              id: `conflict-${graph.netId}-${conflict.code}`,
              kind: "plain-text",
              text: `${conflict.code}: ${conflict.message}`,
              position: { x: 60, y: 1380 + conflictCount * 20 },
              alignment: "start",
            }),
          );
        }
      }
      routes.push(...expansion.edits);
    }

    // --- Instance + port labels -------------------------------------------
    for (const instance of document.instances) {
      labels.push(
        annotation({
          id: `label-${instance.id}`,
          kind: "instance-label",
          text: instance.id,
          attachedObjectId: instance.id,
          position: {
            x: placements[instance.id][0],
            y: placements[instance.id][1] + 50,
          },
          alignment: "middle",
        }),
      );
    }

    return [
      { id: "structure", edits: structure },
      { id: "routes", edits: routes },
      { id: "labels", edits: labels },
    ];
  },
};
