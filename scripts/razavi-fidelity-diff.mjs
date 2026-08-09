#!/usr/bin/env node
// Razavi visual fidelity diff harness.
//
// Rasterizes each raster-owned Razavi symbol at the reference scale and
// compares it against a crop of razavi-six-panel.png centered on the device's
// originPx. Outputs IoU scores, miss/extra counts, and side-by-side diff PNGs.
//
// Usage:
//   node scripts/razavi-fidelity-diff.mjs [device...] [--threshold 160] [--out dir]
//
//   device: nmos | pmos | nmos3 | pmos3 | voltage-source | current-source | current-source-compact | formal-port | formal-route-current-arrow | vdd | ground | resistor | capacitor-vertical | capacitor-horizontal
//           (default: all raster-owned devices)
//
// This tool is read-only: it never edits source configs. Use its report to
// guide manual edits to mos-geometry.json / peripheral-geometry.json /
// style-profile.ts, then re-run generate-razavi-*-assets.mjs and this script.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createEmptyProject } from "../packages/model/dist/index.js";
import {
  builtInSymbols,
  getRazaviCatalogSymbol,
  InMemorySymbolResolver,
} from "../packages/symbols/dist/index.js";
import { renderDocumentSvg } from "../packages/render-svg/dist/index.js";
import { rasterizeSvgBytes } from "../packages/exporters/dist/node.js";
import {
  compareDevice,
  loadReferenceRaster,
  encodeReportRasters,
} from "./lib/razavi-fidelity.mjs";
import { decodePng } from "./lib/png-io.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = resolve(
  root,
  "fixtures/visual-reference/razavi-reference-v1",
);

// Parse args.
const args = process.argv.slice(2);
const devices = args.filter((a) => !a.startsWith("--"));
const thresholdIdx = args.indexOf("--threshold");
const threshold =
  thresholdIdx >= 0 ? Number(args[thresholdIdx + 1]) : undefined;
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : resolve(referenceRoot, "diff");

// Device → where its geometry lives + variant flag.
// The reference six-panel renders MOS in their 3-terminal form (source arrow,
// no bulk lead), so the default MOS comparison uses the 3-terminal variant.
// nmos4/pmos4 entries compare the full 4-terminal bulk presentation instead.
const DEVICE_GEOMETRY = {
  nmos: {
    file: "mos-geometry.json",
    key: "nmos",
    useVariant: true,
    label: "nmos (3-term)",
  },
  pmos: {
    file: "mos-geometry.json",
    key: "pmos",
    useVariant: true,
    label: "pmos (3-term)",
  },
  nmos4: {
    file: "mos-geometry.json",
    key: "nmos",
    useVariant: false,
    label: "nmos (4-term)",
  },
  pmos4: {
    file: "mos-geometry.json",
    key: "pmos",
    useVariant: false,
    label: "pmos (4-term)",
  },
  "voltage-source": {
    file: "peripheral-geometry.json",
    key: "voltage-source",
    useVariant: false,
  },
  "current-source": {
    file: "peripheral-geometry.json",
    key: "current-source",
    useVariant: false,
  },
  "current-source-compact": {
    file: "current-port-geometry.json",
    key: "current-source",
    symbolId: "current-source",
    useVariant: false,
  },
  vdd: {
    file: "vdd-geometry.json",
    key: "vdd",
    useVariant: false,
  },
  "formal-port": {
    file: "current-port-geometry.json",
    collection: "ports",
    key: "hollowOrigin",
    formal: "port",
  },
  "formal-route-current-arrow": {
    file: "current-port-geometry.json",
    collection: "formal",
    key: "route-current-arrow",
    formal: "route-current-arrow",
  },
  ground: {
    file: "peripheral-geometry.json",
    key: "ground",
    useVariant: false,
  },
  resistor: {
    file: "passive-geometry.json",
    key: "resistor",
    useVariant: false,
  },
  "capacitor-vertical": {
    file: "capacitor-geometry.json",
    key: "capacitor-vertical",
    symbolId: "capacitor",
    useVariant: false,
  },
  "capacitor-horizontal": {
    file: "capacitor-geometry.json",
    key: "capacitor-horizontal",
    symbolId: "capacitor",
    useVariant: false,
  },
};

const ALL_DEVICES = Object.keys(DEVICE_GEOMETRY);
const targets = devices.length ? devices : ALL_DEVICES;

// Validate.
for (const d of targets) {
  if (!DEVICE_GEOMETRY[d]) {
    console.error(`Unknown device: ${d}\nValid: ${ALL_DEVICES.join(", ")}`);
    process.exit(1);
  }
}

// Load manifest + reference + geometry files.
const manifest = JSON.parse(
  await readFile(resolve(referenceRoot, "manifest.json"), "utf8"),
);
const referencePath = resolve(referenceRoot, manifest.assetPath);
const geometryFiles = new Map();
async function loadGeometry(file) {
  if (!geometryFiles.has(file)) {
    const path = resolve(referenceRoot, file);
    const raw = await readFile(path, "utf8");
    geometryFiles.set(file, JSON.parse(raw));
  }
  return geometryFiles.get(file);
}

const resolvedThreshold = threshold ?? manifest.pixelThreshold ?? 160;

console.log(`Razavi fidelity diff`);
console.log(
  `  reference: ${manifest.assetPath} (${manifest.pixels.width}x${manifest.pixels.height})`,
);
console.log(`  threshold: ${resolvedThreshold}`);
console.log(`  out:       ${resolve(outDir)}`);
console.log(`  devices:   ${targets.join(", ")}`);
console.log("");

const referenceRasters = new Map();
const formalResolver = new InMemorySymbolResolver(builtInSymbols);

function formalDocument(kind) {
  const document = createEmptyProject(`fidelity-${kind}`, `Fidelity ${kind}`)
    .documents[0];
  document.presentation.styleProfileId = "razavi-textbook-v1";

  if (kind === "port") {
    document.ports.push(
      {
        id: "port-origin",
        name: "P",
        direction: "passive",
        position: { x: 0, y: 0 },
      },
      {
        id: "port-wire",
        name: "W",
        direction: "passive",
        position: { x: 20, y: 0 },
      },
    );
    document.nets.push({
      id: "net-port",
      scope: "local",
      terminals: [],
      ports: ["port-origin", "port-wire"],
    });
    document.routes.push({
      id: "route-port",
      netId: "net-port",
      from: { kind: "port", portId: "port-origin" },
      to: { kind: "port", portId: "port-wire" },
      waypoints: [],
      segmentModes: ["manual"],
    });
    return document;
  }

  document.ports.push(
    {
      id: "port-top",
      name: "T",
      direction: "passive",
      position: { x: 0, y: -100 },
    },
    {
      id: "port-bottom",
      name: "B",
      direction: "passive",
      position: { x: 0, y: 100 },
    },
  );
  document.nets.push({
    id: "net-arrow",
    scope: "local",
    terminals: [],
    ports: ["port-top", "port-bottom"],
  });
  document.routes.push({
    id: "route-arrow",
    netId: "net-arrow",
    from: { kind: "port", portId: "port-top" },
    to: { kind: "port", portId: "port-bottom" },
    waypoints: [],
    segmentModes: ["manual"],
  });
  document.annotations.push({
    id: "marker-arrow",
    kind: "route-marker",
    markerKind: "current",
    text: " ",
    position: { x: 0, y: 0 },
    anchor: {
      kind: "route",
      routeId: "route-arrow",
      segmentIndex: 0,
      t: 0.5,
      direction: "forward",
      normalOffset: 16,
      orientation: "follow",
      fallbackPosition: { x: 0, y: 0 },
    },
    offset: { x: 0, y: 0 },
    alignment: "middle",
    rotation: 0,
    locked: false,
  });
  return document;
}

async function rasterizeFormal(kind, pixelsPerLogical, window, originInWindow) {
  const bounds = {
    x: -originInWindow.x / pixelsPerLogical,
    y: -originInWindow.y / pixelsPerLogical,
    width: window.width / pixelsPerLogical,
    height: window.height / pixelsPerLogical,
  };
  // `renderDocumentSvg` validates public export bounds as integer geometry.
  // Render the real formal scene through that path, then narrow only the test
  // SVG viewport to the fractional raster window required by the reference.
  const formalSvg = renderDocumentSvg(formalDocument(kind), formalResolver, {
    bounds: { x: -100, y: -100, width: 200, height: 200 },
    margin: 0,
  });
  const svg = formalSvg.replace(
    /viewBox="[^"]+"/u,
    `viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"`,
  );
  return decodePng(rasterizeSvgBytes(svg, window.width));
}

async function referenceForGeometry(geometry) {
  const path = resolve(referenceRoot, geometry.assetPath ?? manifest.assetPath);
  if (!referenceRasters.has(path)) {
    referenceRasters.set(path, await loadReferenceRaster(path));
  }
  return referenceRasters.get(path);
}

await mkdir(outDir, { recursive: true });

/** @type {object[]} */
const reports = [];

for (const deviceId of targets) {
  const meta = DEVICE_GEOMETRY[deviceId];
  const geometry = await loadGeometry(meta.file);
  const collection = meta.collection ?? "symbols";
  const measurement =
    geometry[collection]?.[meta.key] ?? geometry[collection]?.[deviceId];
  if (!measurement) {
    console.error(
      `No geometry entry for ${deviceId} (${meta.key}) in ${meta.file}`,
    );
    process.exit(1);
  }
  // The symbol definition id: nmos4/pmos4 map to the 4-terminal nmos/pmos
  // symbol; the 3-terminal default (nmos/pmos with useVariant) also resolves
  // to the same nmos/pmos definition but applies its textbook-3terminal variant.
  const definitionId =
    meta.symbolId ?? deviceId.replace(/^([np])mos4$/, "$1mos");
  const definition = meta.formal
    ? { id: deviceId, primitives: [] }
    : getRazaviCatalogSymbol(definitionId);
  if (!definition) {
    console.error(`No symbol definition for ${deviceId} (→ ${definitionId})`);
    process.exit(1);
  }

  const spec = {
    symbolId: meta.label ?? deviceId,
    pixelsPerLogical:
      measurement.pixelsPerLogical ?? geometry.pixelsPerLogical ?? 1.72,
    originPx: measurement.originPx ?? measurement.centerPx,
    threshold: resolvedThreshold,
    useVariant: meta.useVariant,
    rotation: measurement.rotation ?? 0,
    window: measurement.window ?? measurement.cropWindowPx,
    antiAliasSensitive: Boolean(meta.formal),
    rasterize: meta.formal
      ? (window, originInWindow) =>
          rasterizeFormal(
            meta.formal,
            measurement.pixelsPerLogical ?? geometry.pixelsPerLogical ?? 1.72,
            window,
            originInWindow,
          )
      : undefined,
  };

  const report = await compareDevice(
    spec,
    await referenceForGeometry(geometry),
    definition,
  );
  reports.push(report);

  // Write per-device rasters.
  const enc = await encodeReportRasters(report);
  await writeFile(resolve(outDir, `ref-${deviceId}.png`), enc.ref);
  await writeFile(resolve(outDir, `rendered-${deviceId}.png`), enc.rendered);
  await writeFile(resolve(outDir, `diff-${deviceId}.png`), enc.diff);
}

// Summary table.
const cols = [
  ["device", 16],
  ["IoU", 7],
  ["softIoU", 8],
  ["regLift", 8],
  ["edge%", 6],
  ["verdict", 11],
];
const header = cols.map(([h, w]) => h.padEnd(w)).join(" ");
const sep = cols.map(([, w]) => "-".repeat(w)).join(" ");
console.log(header);
console.log(sep);
for (const r of reports) {
  console.log(
    [
      r.symbolId.padEnd(16),
      r.iou.toFixed(4).padStart(7),
      r.softIou.toFixed(4).padStart(8),
      ("+" + r.regLift.toFixed(3)).padStart(8),
      (r.edgeShellRatio * 100).toFixed(0).padStart(5) + "%",
      r.verdict.padEnd(11),
    ].join(" "),
  );
}
console.log("");
console.log(`Columns:`);
console.log(
  `  IoU       binary (threshold ${resolvedThreshold}) — use as RELATIVE signal, not an absolute gate`,
);
console.log(`  softIoU   anti-alias-weighted — edges contribute fractionally`);
console.log(
  `  regLift   IoU gain from ±2px translation search — high = sub-pixel/edge dominates`,
);
console.log(
  `  edge%     of miss+extra pixels, % hugging the contour (≤2px) — high = anti-alias shell`,
);
console.log(
  `  verdict   anti-alias = don't gate on IoU; geometry = fix it; marginal = mixed`,
);
console.log(``);
console.log(
  `Devices flagged aa-sensitive (hollow circle / glyph): ${
    reports
      .filter((r) => r.aaSensitive)
      .map((r) => r.symbolId)
      .join(", ") || "none"
  }`,
);
console.log(``);
console.log(`Diff PNGs written to ${resolve(outDir)}/`);
console.log(`  red = reference-only ink (missed in render)`);
console.log(`  green = render-only ink (extra vs reference)`);
console.log(`  gray = overlap`);
