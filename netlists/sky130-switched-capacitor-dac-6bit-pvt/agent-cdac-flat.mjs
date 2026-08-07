// Agent-generated 6-bit switched-capacitor DAC, FLAT transistor-level view.
//
// ROUTE-GRAPH HELPER: the Agent gives an explicit Route graph per Net;
// the helper projects edges onto legal coordinates. Every edge is
// set_route_points with explicit waypoints — no route_orthogonal.
//
// The hierarchical top is flattened into individual transistor instances
// (XU0__XDP, XU0__XDN, etc.) before routing. Port positions are aligned
// with pin coordinates so all edges are axis-aligned.
//
// Per ADR 0008: the helper detects conflicts but never reroutes.

import {
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "../../packages/derived/dist/index.js";
import { expandRouteGraph } from "../../packages/agent-routing/dist/index.js";
import { transformPoint } from "../../packages/model/dist/index.js";
import { appendFlattenedDocument } from "../../tools/agent-layout/flatten-project.mjs";

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
  id: "sky130-scdac-6bit-flat-transistor",
  agentId: "codex-scdac-flat-transistor",
  sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "Flat CDAC (transistor-level)",
  projectName: "SKY130 6-bit Switched-Capacitor DAC (flat transistor-level)",
  outputBase: "agent-scdac-newarch",
  exportMargin: 30,
  exportScale: 3,

  prepareProject({ project }) {
    const sourceName = "switched_capacitor_dac_6bit";
    const flatName = "Flat CDAC (transistor-level)";
    project.documents = project.documents.filter((d) => d.name !== flatName);
    const flat = appendFlattenedDocument(project, sourceName, flatName);
    for (const inst of flat.instances) {
      if (inst.symbolId === "nmos" || inst.symbolId === "pmos") {
        inst.symbolVariantId = "textbook-3terminal";
      }
    }
    project.topDocumentId = flat.id;
  },

  prepareModel({ document }) {
    // Port positions will be set in buildEditPhases after we know pin coords.
    // For now just set the profile.
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

    // --- Placement of flat transistor-level instances -------------------
    // Each scdac_unit (XU{i}) contains 4 MOS: XDP(pmos), XDN(nmos),
    // XSP(pmos), XSN(nmos). In the flat doc they become
    // XU{i}__XDP, XU{i}__XDN, XU{i}__XSP, XU{i}__XSN.
    //
    // Layout: each unit occupies a column at x=220, pitch 160.
    //   XDP (pmos, inverter P) at top of unit
    //   XDN (nmos, inverter N) below XDP
    //   XSP (pmos, switch P) below XDN
    //   XSN (nmos, switch N) at bottom
    // Capacitors at x=520.
    // XRESET at x=780.

    const unitX = 220;
    const unitPitch = 160;
    const unitY = (i) => 200 + i * unitPitch;
    const mosPitch = 40; // vertical pitch within a unit

    const placements = {};
    for (let i = 0; i < 6; i += 1) {
      const baseY = unitY(i);
      placements[`XU${i}__XDP`] = [unitX, baseY, 0, "none"];
      placements[`XU${i}__XDN`] = [unitX, baseY + mosPitch, 0, "none"];
      placements[`XU${i}__XSP`] = [unitX, baseY + 2 * mosPitch, 0, "none"];
      placements[`XU${i}__XSN`] = [unitX, baseY + 3 * mosPitch, 0, "none"];
    }
    for (let i = 0; i < 6; i += 1) {
      placements[`C${i}`] = [520, unitY(i) + 20, 0, "none"];
    }
    placements.CDUMMY = [520, unitY(5) + 160, 0, "none"];
    placements.XRESET = [780, 640, 0, "none"];

    const routingDocument = structuredClone(document);
    for (const instance of document.instances) {
      const p = placements[instance.id];
      if (!p) continue;
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
    }

    // Set port positions aligned with the flat instance pin coordinates.
    // We need to resolve pin positions after placement to find the right y.
    // b0-b5 ports align with the first MOS's bit pin (which is the gate of XDN).
    // For flat: the "bit" net connects to XU{i}__XDN.G and XU{i}__XDP.G.
    // We'll align b{i} port with XU{i}__XDN.G pin y.
    const portPositions = {};
    for (let i = 0; i < 6; i += 1) {
      const ep = { kind: "terminal", instanceId: `XU${i}__XDN`, pinName: "G" };
      const pt = resolveEndpointPoint(routingDocument, resolver, ep);
      if (pt) portPositions[`b${i}`] = { x: 60, y: pt.y };
    }
    // reset port aligns with XRESET.G
    {
      const ep = { kind: "terminal", instanceId: "XRESET", pinName: "G" };
      const pt = resolveEndpointPoint(routingDocument, resolver, ep);
      if (pt) portPositions.reset = { x: 60, y: pt.y };
    }
    // vdd, vss, vout ports
    portPositions.vdd = { x: 300, y: 100 };
    portPositions.vss = { x: 300, y: 1280 };
    portPositions.vout = { x: 900, y: 700 };
    for (const port of routingDocument.ports) {
      const pp = portPositions[port.name];
      if (pp) port.position = pp;
    }
    // Also apply port positions to the original document's ports for later use.
    for (const port of document.ports) {
      const pp = portPositions[port.name];
      if (pp) port.position = pp;
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

    // Instance silhouettes for wire-through-symbol detection.
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

    // --- Sequential per-Net graph expansion --------------------------------
    const accumulatedPolylines = [];
    const routes = [];
    let conflictCount = 0;

    function expandAndCollect(graph) {
      const expansion = expandRouteGraph(graph, {
        endpoints,
        existingRoutePolylines: accumulatedPolylines,
        instanceBoxes,
      });
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
      for (const geom of expansion.resolvedGeometry) {
        accumulatedPolylines.push({
          routeId: geom.routeId,
          points: geom.points,
        });
      }
      routes.push(...expansion.edits);
    }

    // --- Helper: build a Net graph from its terminals ------------------
    function buildNetGraph(netName, shape) {
      const net = document.nets.find((n) => n.name === netName);
      if (!net) return null;
      const terms = (net.terminals ?? []).map((t) =>
        endpointId(netName, t.instanceId, t.pinName),
      );
      const portEps = (net.ports ?? []).map((pid) => {
        const p = document.ports.find((port) => port.id === pid);
        return endpointId(netName, p.id, "");
      });
      const allEps = [...terms, ...portEps];

      if (shape === "direct" && allEps.length === 2) {
        return {
          documentId: document.id,
          revision: 0,
          netId: netId(netName),
          nodes: allEps.map((id) => ({
            id,
            role: "endpoint",
            endpoint: endpoints.get(id).endpoint,
          })),
          edges: [
            {
              id: `${netName}-direct`,
              from: allEps[0],
              to: allEps[1],
              role: "link",
            },
          ],
        };
      }

      if (shape === "shared-trunk" && allEps.length >= 2) {
        const trunkX = 600;
        const nodes = [];
        const edges = [];
        const taps = allEps
          .map((epId) => ({ epId, y: endpoints.get(epId).point.y }))
          .sort((a, b) => a.y - b.y);
        for (const tap of taps) {
          nodes.push({
            id: tap.epId,
            role: "endpoint",
            endpoint: endpoints.get(tap.epId).endpoint,
          });
          const tapId = `${netName}-tap-${tap.epId}`;
          nodes.push({ id: tapId, role: "tap", at: { x: trunkX, y: tap.y } });
          edges.push({
            id: `${netName}-link-${tap.epId}`,
            from: tap.epId,
            to: tapId,
            role: "link",
          });
        }
        for (let i = 1; i < taps.length; i += 1) {
          const prev = `${netName}-tap-${taps[i - 1].epId}`;
          const curr = `${netName}-tap-${taps[i].epId}`;
          edges.push({
            id: `${netName}-trunk-${i - 1}`,
            from: prev,
            to: curr,
            role: "trunk",
          });
        }
        return {
          documentId: document.id,
          revision: 0,
          netId: netId(netName),
          nodes,
          edges,
        };
      }

      if (shape === "labeled-islands") {
        const nodes = [];
        const edges = [];
        for (const epId of allEps) {
          const ep = endpoints.get(epId);
          if (!ep) continue;
          const jId = `${netName}-j-${epId}`;
          // Place junction near the endpoint, offset to avoid trunk.
          const offset = netName === "vss" ? 60 : 80;
          const jPoint = { x: snap(ep.point.x + offset), y: snap(ep.point.y) };
          nodes.push({ id: epId, role: "endpoint", endpoint: ep.endpoint });
          nodes.push({ id: jId, role: "junction", at: jPoint });
          edges.push({
            id: `${netName}-esc-${epId}`,
            from: epId,
            to: jId,
            role: "link",
          });
          edges.push({
            id: `${netName}-label-${epId}`,
            from: jId,
            to: jId,
            role: "label",
            label: { text: netName.toUpperCase(), attachedObjectId: jId },
          });
        }
        return {
          documentId: document.id,
          revision: 0,
          netId: netId(netName),
          nodes,
          edges,
        };
      }

      return null;
    }

    // --- vout: shared-trunk at x=600 -----------------------------------
    {
      const graph = buildNetGraph("vout", "shared-trunk");
      if (graph) expandAndCollect(graph);
    }

    // --- vdd: shared-trunk at x=300 -----------------------------------
    {
      const graph = buildNetGraph("vdd", "shared-trunk");
      if (graph) {
        for (const node of graph.nodes) {
          if (node.role === "tap" && node.at) node.at.x = 300;
        }
        expandAndCollect(graph);
      }
    }

    // --- vss: labeled-islands -------------------------------------------
    {
      const graph = buildNetGraph("vss", "labeled-islands");
      if (graph) expandAndCollect(graph);
    }

    // --- bot0-5: direct (2-endpoint) --------------------------------
    // bot{i} connects XU{i}__XSN.D to C{i}.2 (same y).
    for (const netName of ["bot0", "bot1", "bot2", "bot3", "bot4", "bot5"]) {
      const graph = buildNetGraph(netName, "direct");
      if (graph) expandAndCollect(graph);
    }

    // --- b0-5: shared-trunk (3-endpoint: port + 2 MOS gates) ---------
    // b{i} connects port → XU{i}__XDP.G + XU{i}__XDN.G.
    for (const netName of ["b0", "b1", "b2", "b3", "b4", "b5"]) {
      const graph = buildNetGraph(netName, "shared-trunk");
      if (graph) {
        // Override trunk X to 120 (between port at 60 and MOS gates at ~200).
        for (const node of graph.nodes) {
          if (node.role === "tap" && node.at) node.at.x = 120;
        }
        expandAndCollect(graph);
      }
    }

    // --- reset: direct (2-endpoint) --------------------------------
    {
      const graph = buildNetGraph("reset", "direct");
      if (graph) expandAndCollect(graph);
    }

    // --- nb0-5: internal net labels (single terminal each) -------------
    // These are internal to the flattened units and have only one terminal
    // (the inverter output). They need a visible net label but no route.
    for (let i = 0; i < 6; i += 1) {
      const netName = `nb${i}`;
      const net = document.nets.find((n) => n.name === netName);
      if (!net) continue;
      const terms = net.terminals ?? [];
      if (terms.length === 0) continue;
      const term = terms[0];
      const point = resolveEndpointPoint(routingDocument, resolver, {
        kind: "terminal",
        instanceId: term.instanceId,
        pinName: term.pinName,
      });
      if (!point) continue;
      labels.push(
        annotation({
          id: `label-${netName}`,
          kind: "net-label",
          text: netName.toUpperCase(),
          position: { x: snap(point.x + 30), y: snap(point.y - 10) },
          alignment: "start",
        }),
      );
    }

    // --- Instance labels ----------------------------------------------
    for (const instance of document.instances) {
      const p = placements[instance.id];
      if (!p) continue;
      labels.push(
        annotation({
          id: `label-${instance.id}`,
          kind: "instance-label",
          text: instance.id,
          attachedObjectId: instance.id,
          position: { x: p[0], y: p[1] + 30 },
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
