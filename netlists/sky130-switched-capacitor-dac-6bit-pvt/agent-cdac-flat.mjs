// Agent-generated 6-bit switched-capacitor DAC, top-level hierarchical view.
//
// ROUTE-GRAPH HELPER: the Agent gives an explicit Route graph (nodes + edges
// with roles) per Net; the @icm/agent-routing helper only projects each edge
// onto legal coordinates. Every edge is a set_route_points with explicit
// waypoints — the helper NEVER calls route_orthogonal or guesses bends. If an
// edge is not axis-aligned, it returns MISALIGNED_EDGE; the Agent must add
// bend nodes.
//
// Per-Net sequencing: each Net's expansion sees the accumulated geometry from
// all previously committed Nets, so wire-through-symbol and overlap detection
// works across Nets.
//
// Per ADR 0008: the helper detects conflicts but never reroutes.

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
  id: "sky130-scdac-6bit-agent-route-graph-v2",
  agentId: "codex-scdac-route-graph-v2",
  sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "switched_capacitor_dac_6bit",
  projectName: "SKY130 6-bit Switched-Capacitor DAC (route-graph v2)",
  outputBase: "agent-scdac-newarch",
  exportMargin: 30,
  exportScale: 3,

  prepareModel({ document }) {
    // Port positions aligned with pin y-coordinates so direct edges are
    // axis-aligned (no bend nodes needed).
    const unitY = (i) => 200 + i * 160;
    const portPositions = {
      b0: { x: 60, y: unitY(0) - 20 }, // aligned with XU0.bit (180,180)
      b1: { x: 60, y: unitY(1) - 20 },
      b2: { x: 60, y: unitY(2) - 20 },
      b3: { x: 60, y: unitY(3) - 20 },
      b4: { x: 60, y: unitY(4) - 20 },
      b5: { x: 60, y: unitY(5) - 20 },
      reset: { x: 60, y: 640 }, // aligned with XRESET.G (760,640)
      vdd: { x: 300, y: 60 }, // same x as vdd rail top
      vss: { x: 300, y: 1280 },
      vout: { x: 900, y: 680 }, // aligned with vout trunk tap
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
    // Units at x=220, pitch 160. Caps at x=520 aligned so cap.2 shares y
    // with unit.bot (enabling a straight horizontal bot wire).
    const unitY = (i) => 200 + i * 160;
    const placements = {};
    for (let i = 0; i < 6; i += 1) {
      placements[`XU${i}`] = [220, unitY(i), 0, "none"];
    }
    // Caps at (520, unitY(i)) so:
    //   cap.1 at (520, unitY-20), cap.2 at (520, unitY+20)
    //   cap.2 shares y with unit.bot (180, unitY+20) → straight wire.
    for (let i = 0; i < 6; i += 1) {
      placements[`C${i}`] = [520, unitY(i), 0, "none"];
    }
    placements.CDUMMY = [520, unitY(5) + 160, 0, "none"];
    placements.XRESET = [780, 640, 0, "none"];

    const routingDocument = structuredClone(document);
    for (const instance of document.instances) {
      const p = placements[instance.id];
      const [x, y, rotation, mirror] = p;
      const planned = routingDocument.instances.find(
        (c) => c.id === instance.id,
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
        const ep = { kind: "terminal", instanceId: term.instanceId, pinName: term.pinName };
        const point = resolveEndpointPoint(routingDocument, resolver, ep);
        if (!point) continue;
        const outward = resolveEndpointOutwardDirection(routingDocument, resolver, ep);
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

    // Instance silhouettes for wire-through-symbol detection.
    const instanceBoxes = [];
    for (const instance of routingDocument.instances) {
      if (!instance.placement) continue;
      const resolved = resolver.resolve(instance.symbolId, instance.symbolVariantId);
      if (!resolved) continue;
      const box = resolved.definition.viewBox;
      const corners = [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x, y: box.y + box.height },
        { x: box.x + box.width, y: box.y + box.height },
      ].map((point) => transformPoint(point, instance.placement.position, instance.placement));
      instanceBoxes.push({
        instanceId: instance.id,
        min: { x: Math.min(...corners.map((c) => c.x)), y: Math.min(...corners.map((c) => c.y)) },
        max: { x: Math.max(...corners.map((c) => c.x)), y: Math.max(...corners.map((c) => c.y)) },
      });
    }

    // --- Sequential per-Net graph expansion --------------------------------
    // Each Net sees accumulated geometry from all previously committed Nets.
    const accumulatedPolylines = [];
    const routes = [];
    let conflictCount = 0;

    function expandAndCollect(graph) {
      const expansion = expandRouteGraph(graph, {
        endpoints,
        existingRoutePolylines: accumulatedPolylines,
        instanceBoxes,
      });
      // Report conflicts (do not silently ignore).
      for (const conflict of expansion.conflicts) {
        conflictCount += 1;
        labels.push(
          annotation({
            id: `conflict-${graph.netId}-${conflict.code}-${conflictCount}`,
            kind: "plain-text",
            text: `${conflict.code}: ${conflict.message}`,
            position: { x: 60, y: 1320 + conflictCount * 20 },
            alignment: "start",
          }),
        );
      }
      // Collect resolved geometry for the next Net's overlap detection.
      for (const geom of expansion.resolvedGeometry) {
        accumulatedPolylines.push({ routeId: geom.routeId, points: geom.points });
      }
      routes.push(...expansion.edits);
      return expansion;
    }

    // --- vout: vertical common-plate trunk at x=600 -----------------------
    // All cap.1 + CDUMMY.1 + XRESET.D + vout port link to taps on the trunk.
    // Each tap is axis-aligned with its endpoint (same y).
    {
      const voutPortId = endpointId("vout", document.ports.find((p) => p.name === "vout").id, "");
      const capIds = [0, 1, 2, 3, 4, 5].map((i) => ({
        epId: endpointId("vout", `C${i}`, "1"),
        y: unitY(i) - 20,
      }));
      const dummyId = endpointId("vout", "CDUMMY", "1");
      const resetDId = endpointId("vout", "XRESET", "D");

      // Taps on the trunk at x=600, sorted by y.
      const taps = [
        ...capIds.map((c, i) => ({ id: `vout-tapC${i}`, y: c.y, epId: c.epId })),
        { id: "vout-tapReset", y: 620, epId: resetDId }, // XRESET.D at (790,620)
        { id: "vout-tapPort", y: 680, epId: voutPortId }, // vout port at (900,680)
        { id: "vout-tapDummy", y: 1140, epId: dummyId }, // CDUMMY.1 at (520,1140)
      ].sort((a, b) => a.y - b.y);

      const nodes = [];
      const edges = [];
      // Endpoint nodes + tap nodes + link edges.
      for (const tap of taps) {
        nodes.push({ id: tap.epId, role: "endpoint", endpoint: endpoints.get(tap.epId).endpoint });
        nodes.push({ id: tap.id, role: "tap", at: { x: 600, y: tap.y } });
        // Link (not escape) — cap.1 faces north but tap is east.
        edges.push({ id: `vout-link-${tap.id}`, from: tap.epId, to: tap.id, role: "link" });
      }
      // Trunk edges between consecutive taps (vertical, same x=600).
      for (let i = 1; i < taps.length; i += 1) {
        edges.push({ id: `vout-trunk-${i - 1}`, from: taps[i - 1].id, to: taps[i].id, role: "trunk" });
      }
      expandAndCollect({ documentId: document.id, revision: 0, netId: netId("vout"), nodes, edges });
    }

    // --- vdd: vertical rail at x=300 ---------------------------------------
    // Each unit.vdd escapes east to a tap on the rail.
    {
      const vddPortId = endpointId("vdd", document.ports.find((p) => p.name === "vdd").id, "");
      const unitIds = [0, 1, 2, 3, 4, 5].map((i) => ({
        epId: endpointId("vdd", `XU${i}`, "vdd"),
        y: unitY(i),
      }));

      const nodes = [];
      const edges = [];
      // Port → top of rail (same x=300, vertical).
      nodes.push({ id: vddPortId, role: "endpoint", endpoint: endpoints.get(vddPortId).endpoint });
      nodes.push({ id: "vdd-tapPort", role: "tap", at: { x: 300, y: 100 } });
      edges.push({ id: "vdd-link-port", from: vddPortId, to: "vdd-tapPort", role: "link" });

      // Unit escapes: vdd faces east, tap is east → escape ✓.
      for (let i = 0; i < unitIds.length; i += 1) {
        const u = unitIds[i];
        nodes.push({ id: u.epId, role: "endpoint", endpoint: endpoints.get(u.epId).endpoint });
        nodes.push({ id: `vdd-tap${i}`, role: "tap", at: { x: 300, y: u.y } });
        edges.push({ id: `vdd-esc-${i}`, from: u.epId, to: `vdd-tap${i}`, role: "escape" });
      }
      // Trunk: tapPort(60) → tap0(unitY0) → tap1 → ... → tap5.
      edges.push({ id: "vdd-trunk-port", from: "vdd-tapPort", to: "vdd-tap0", role: "trunk" });
      for (let i = 1; i < unitIds.length; i += 1) {
        edges.push({ id: `vdd-trunk-${i - 1}`, from: `vdd-tap${i - 1}`, to: `vdd-tap${i}`, role: "trunk" });
      }
      expandAndCollect({ documentId: document.id, revision: 0, netId: netId("vdd"), nodes, edges });
    }

    // --- vss: labeled islands (no cross-island wire) -----------------------
    // Each unit.vss gets a local junction + VSS label.
    // XRESET.S, CDUMMY.2, and vss port each get their own local junction + label.
    {
      const vssPortId = endpointId("vss", document.ports.find((p) => p.name === "vss").id, "");
      const nodes = [];
      const edges = [];
      let islIdx = 0;

      function addIsland(epId, junctionId, junctionPoint, useEscape) {
        nodes.push({ id: epId, role: "endpoint", endpoint: endpoints.get(epId).endpoint });
        nodes.push({ id: junctionId, role: "junction", at: junctionPoint });
        edges.push({
          id: `vss-esc-${islIdx}`,
          from: epId,
          to: junctionId,
          role: useEscape ? "escape" : "link",
        });
        edges.push({
          id: `vss-label-${islIdx}`,
          from: junctionId,
          to: junctionId,
          role: "label",
          label: { text: "VSS", attachedObjectId: junctionId },
        });
        islIdx += 1;
      }

      // Unit vss islands: vss faces east, junction east → escape ✓.
      for (let i = 0; i < 6; i += 1) {
        addIsland(
          endpointId("vss", `XU${i}`, "vss"),
          `vss-j-${i}`,
          { x: 320, y: unitY(i) - 20 },
          true,
        );
      }
      // XRESET.S: faces south, junction south → escape ✓.
      addIsland(endpointId("vss", "XRESET", "S"), "vss-j-reset", { x: 790, y: 680 }, true);
      // CDUMMY.2: faces south, junction south → escape ✓.
      addIsland(endpointId("vss", "CDUMMY", "2"), "vss-j-dummy", { x: 520, y: 1200 }, true);
      // VSS port: no outward → use link.
      addIsland(vssPortId, "vss-j-port", { x: 300, y: 1270 }, false);

      expandAndCollect({ documentId: document.id, revision: 0, netId: netId("vss"), nodes, edges });
    }

    // --- bot0-5: unit.bot → cap.2 (straight horizontal) --------------------
    // With caps at (520, unitY(i)):
    //   unit.bot at (180, unitY+20), cap.2 at (520, unitY+20) → same y ✓.
    for (let i = 0; i < 6; i += 1) {
      const aId = endpointId(`bot${i}`, `XU${i}`, "bot");
      const bId = endpointId(`bot${i}`, `C${i}`, "2");
      expandAndCollect({
        documentId: document.id,
        revision: 0,
        netId: netId(`bot${i}`),
        nodes: [
          { id: aId, role: "endpoint", endpoint: endpoints.get(aId).endpoint },
          { id: bId, role: "endpoint", endpoint: endpoints.get(bId).endpoint },
        ],
        edges: [{ id: `bot${i}-link`, from: aId, to: bId, role: "link" }],
      });
    }

    // --- b0-5: port → unit.bit (straight horizontal) -----------------------
    // Port at (60, unitY-20), unit.bit at (180, unitY-20) → same y ✓.
    for (let i = 0; i < 6; i += 1) {
      const portEpId = endpointId(`b${i}`, document.ports.find((p) => p.name === `b${i}`).id, "");
      const bitEpId = endpointId(`b${i}`, `XU${i}`, "bit");
      expandAndCollect({
        documentId: document.id,
        revision: 0,
        netId: netId(`b${i}`),
        nodes: [
          { id: portEpId, role: "endpoint", endpoint: endpoints.get(portEpId).endpoint },
          { id: bitEpId, role: "endpoint", endpoint: endpoints.get(bitEpId).endpoint },
        ],
        edges: [{ id: `b${i}-link`, from: portEpId, to: bitEpId, role: "link" }],
      });
    }

    // --- reset: port → XRESET.G (straight horizontal) ---------------------
    // Port at (60,640), XRESET.G at (760,640) → same y ✓.
    {
      const portEpId = endpointId("reset", document.ports.find((p) => p.name === "reset").id, "");
      const gEpId = endpointId("reset", "XRESET", "G");
      expandAndCollect({
        documentId: document.id,
        revision: 0,
        netId: netId("reset"),
        nodes: [
          { id: portEpId, role: "endpoint", endpoint: endpoints.get(portEpId).endpoint },
          { id: gEpId, role: "endpoint", endpoint: endpoints.get(gEpId).endpoint },
        ],
        edges: [{ id: "reset-link", from: portEpId, to: gEpId, role: "link" }],
      });
    }

    // --- Instance + port labels -------------------------------------------
    for (const instance of document.instances) {
      labels.push(
        annotation({
          id: `label-${instance.id}`,
          kind: "instance-label",
          text: instance.id,
          attachedObjectId: instance.id,
          position: { x: placements[instance.id][0], y: placements[instance.id][1] + 50 },
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
