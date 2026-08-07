// Agent-generated 6-bit switched-capacitor DAC, top-level hierarchical view.
//
// NEW ARCHATURE: routing is produced by @icm/agent-routing expandRouteTree,
// not by hand-computed waypoints. The recipe decides placement and a
// RouteTreeDecision per Net (shape + endpoint groups); the expander computes
// coordinates. Per ADR 0008 the expander detects conflicts but never reroutes;
// per razavi-style-canon it snaps to the 10-unit grid.
//
// This recipe does NOT read the directory's pre-existing generated assets.

import {
  resolveEndpointOutwardDirection,
  resolveEndpointPoint,
} from "../../packages/derived/dist/index.js";
import { expandRouteTree } from "../../packages/agent-routing/dist/index.js";
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
  id: "sky130-scdac-6bit-agent-newarch",
  agentId: "codex-scdac-newarch",
  sourceRoot: "netlists/sky130-switched-capacitor-dac-6bit-pvt",
  sourceFiles: ["circuit.spi"],
  entry: "circuit.spi",
  documentName: "switched_capacitor_dac_6bit",
  projectName: "SKY130 6-bit Switched-Capacitor DAC (new architecture)",
  outputBase: "agent-scdac-newarch",
  exportMargin: 30,
  exportScale: 3,

  prepareModel({ document }) {
    // Port placement: inputs left, vdd top, vss bottom, vout right.
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
    // Six scdac_unit blocks stacked vertically at x=220, pitch 160.
    // Each block: bit/nbit/bot on west, vss/vdd on east.
    const unitX = 220;
    const unitPitch = 160;
    const unitY = (index) => 200 + index * unitPitch;
    const placements = {};
    for (let index = 0; index < 6; index += 1) {
      placements[`XU${index}`] = [unitX, unitY(index), 0, "none"];
    }
    // Capacitors at x=520, aligned with each unit's bot pin (y = unitY + 20).
    // The x=300-500 gap is a clear corridor for vertical power/output trunks.
    for (let index = 0; index < 6; index += 1) {
      placements[`C${index}`] = [520, unitY(index) + 20, 0, "none"];
    }
    // Dummy capacitor at bottom.
    placements.CDUMMY = [520, unitY(5) + 180, 0, "none"];
    // Reset NMOS to the right, driving vout.
    placements.XRESET = [780, 640, 0, "none"];

    // A working copy with placements applied, used to resolve endpoint geometry
    // for the expander input slice.
    const routingDocument = structuredClone(document);
    for (const instance of document.instances) {
      const placement = placements[instance.id];
      if (!placement) {
        throw new Error(`Missing placement for ${instance.id}`);
      }
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
      // Reset FET uses the textbook 3-terminal variant; bulk stays on vss.
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

    // --- Build the expander input slice from the placed document -----------
    // Each Net's terminals become ResolvedEndpoints keyed by a stable id.
    const endpointId = (netName, instanceId, pinName) =>
      `${netName}:${instanceId}.${pinName}`;

    const netByName = new Map(document.nets.map((net) => [net.name, net]));

    const endpoints = new Map();
    for (const net of document.nets) {
      for (const term of net.terminals ?? []) {
        const endpoint = {
          kind: "terminal",
          instanceId: term.instanceId,
          pinName: term.pinName,
        };
        const point = resolveEndpointPoint(routingDocument, resolver, endpoint);
        if (!point) continue;
        const outward = resolveEndpointOutwardDirection(
          routingDocument,
          resolver,
          endpoint,
        );
        endpoints.set(endpointId(net.name, term.instanceId, term.pinName), {
          id: endpointId(net.name, term.instanceId, term.pinName),
          endpoint,
          point,
          outward,
        });
      }
      for (const portId of net.ports ?? []) {
        const portObj = document.ports.find((p) => p.id === portId);
        if (!portObj?.position) continue;
        const endpoint = { kind: "port", portId };
        endpoints.set(endpointId(net.name, portObj.id, ""), {
          id: endpointId(net.name, portObj.id, ""),
          endpoint,
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

    const expansionInput = {
      endpoints,
      existingRoutePolylines: [],
      instanceBoxes,
    };

    // --- Per-Net RouteTreeDecisions ----------------------------------------
    // Decisions carry topology only; the expander computes coordinates.
    const directNet = (netName) => {
      const net = netByName.get(netName);
      if (!net) return null;
      const terms = (net.terminals ?? []).map((t) =>
        endpointId(netName, t.instanceId, t.pinName),
      );
      const portEps = (net.ports ?? []).map((pid) =>
        endpointId(netName, pid, ""),
      );
      return {
        documentId: document.id,
        revision: 0,
        netId: netId(netName),
        shape: "direct",
        endpointGroups: [
          {
            id: `${netName}-g`,
            endpointIds: [...terms, ...portEps],
            attachTo: "net",
          },
        ],
      };
    };

    // vdd: 6 unit vdd pins + vdd port -> shared trunk (vertical, x ~ 360).
    const vddTerms = [0, 1, 2, 3, 4, 5].map((i) =>
      endpointId("vdd", `XU${i}`, "vdd"),
    );
    const vddPort = endpointId(
      "vdd",
      document.ports.find((p) => p.name === "vdd").id,
      "",
    );
    const vddDecision = {
      documentId: document.id,
      revision: 0,
      netId: netId("vdd"),
      shape: "ordered-bus",
      endpointGroups: [
        { id: "vdd-units", endpointIds: vddTerms, attachTo: "net" },
        { id: "vdd-port", endpointIds: [vddPort], attachTo: "vdd-units" },
      ],
    };

    // vss: 6 unit vss + XRESET.S + XRESET.B + CDUMMY.2 + vss port.
    const vssTerms = [
      ...[0, 1, 2, 3, 4, 5].map((i) => endpointId("vss", `XU${i}`, "vss")),
      endpointId("vss", "XRESET", "S"),
      endpointId("vss", "XRESET", "B"),
      endpointId("vss", "CDUMMY", "2"),
    ];
    const vssPort = endpointId(
      "vss",
      document.ports.find((p) => p.name === "vss").id,
      "",
    );
    const vssDecision = {
      documentId: document.id,
      revision: 0,
      netId: netId("vss"),
      shape: "labeled-islands",
      endpointGroups: [
        { id: "vss-units", endpointIds: vssTerms, attachTo: "net" },
        { id: "vss-port", endpointIds: [vssPort], attachTo: "vss-units" },
      ],
    };

    // vout: 6 caps .1 + XRESET.D + vout port -> shared trunk (vertical).
    const voutTerms = [
      ...[0, 1, 2, 3, 4, 5].map((i) => endpointId("vout", `C${i}`, "1")),
      endpointId("vout", "XRESET", "D"),
    ];
    const voutPort = endpointId(
      "vout",
      document.ports.find((p) => p.name === "vout").id,
      "",
    );
    const voutDecision = {
      documentId: document.id,
      revision: 0,
      netId: netId("vout"),
      shape: "ordered-bus",
      endpointGroups: [
        { id: "vout-caps", endpointIds: voutTerms, attachTo: "net" },
        { id: "vout-port", endpointIds: [voutPort], attachTo: "vout-caps" },
      ],
    };

    const decisions = [
      vddDecision,
      vssDecision,
      voutDecision,
      // Each bot net is a unit.bot + cap.2 pair -> direct.
      ...[0, 1, 2, 3, 4, 5].map((i) => directNet(`bot${i}`)).filter(Boolean),
      // Each bit input is a port + unit.bit pair -> direct.
      ...[0, 1, 2, 3, 4, 5].map((i) => directNet(`b${i}`)).filter(Boolean),
      // reset port + XRESET.G -> direct.
      directNet("reset"),
    ];

    // --- Expand each decision into typed edits -----------------------------
    const routes = [];
    let conflictCount = 0;
    for (const decision of decisions) {
      const expansion = expandRouteTree(decision, expansionInput);
      if (expansion.conflicts.length > 0) {
        conflictCount += expansion.conflicts.length;
        // The expander never reroutes; record the conflict and still emit the
        // edits it produced (e.g. escapes), so the layout is reviewable.
        for (const conflict of expansion.conflicts) {
          labels.push(
            annotation({
              id: `conflict-${decision.netId}-${conflict.code}`,
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

    // --- Labels ------------------------------------------------------------
    // Name each placed instance and each port.
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
    for (const portObj of document.ports) {
      labels.push(
        annotation({
          id: `label-port-${portObj.name}`,
          kind: "net-label",
          text: portObj.name.toUpperCase(),
          attachedObjectId: portObj.id,
          position: {
            x:
              portObj.position.x +
              (portObj.name.startsWith("b") || portObj.name === "reset"
                ? -20
                : 0),
            y:
              portObj.position.y +
              (portObj.name === "vdd" ? -20 : portObj.name === "vss" ? 20 : 0),
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
