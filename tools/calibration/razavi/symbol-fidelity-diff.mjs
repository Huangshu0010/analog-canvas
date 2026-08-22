#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getRazaviCatalogSymbol } from "../../../packages/symbols/dist/index.js";
import {
  compareDevice,
  encodeReportRasters,
  loadReferenceRaster,
} from "../../../scripts/lib/razavi-fidelity.mjs";
import { loadRazaviReferenceAuthority } from "../../../scripts/lib/razavi-reference-authority.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const referenceRoot = resolve(
  root,
  "fixtures/visual-reference/razavi-reference-v1",
);
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outDir =
  outIndex >= 0
    ? resolve(args[outIndex + 1])
    : resolve(root, "output/calibration/razavi-symbols");
const optionValues = new Set(outIndex >= 0 ? [outIndex + 1] : []);
const requested = args.filter(
  (argument, index) => !argument.startsWith("--") && !optionValues.has(index),
);

const { manifest, files } = await loadRazaviReferenceAuthority(referenceRoot);
const registry = JSON.parse(
  files.get(manifest.fidelityTargetsPath).toString("utf8"),
);
const targets = registry.targets.filter(
  (target) => typeof target.symbolId === "string",
);
const selected = requested.length
  ? requested.map((id) => {
      const target = targets.find((candidate) => candidate.id === id);
      if (!target) {
        throw new Error(
          `Unknown symbol fidelity target ${id}; valid: ${targets.map((value) => value.id).join(", ")}`,
        );
      }
      return target;
    })
  : targets;

const geometryCache = new Map();
const rasterCache = new Map();
async function geometry(path) {
  if (!geometryCache.has(path)) {
    geometryCache.set(path, JSON.parse(files.get(path).toString("utf8")));
  }
  return geometryCache.get(path);
}

async function raster(path) {
  const absolute = resolve(referenceRoot, path);
  if (!rasterCache.has(absolute)) {
    rasterCache.set(absolute, await loadReferenceRaster(absolute));
  }
  return rasterCache.get(absolute);
}

await mkdir(outDir, { recursive: true });
const reports = [];
for (const target of selected) {
  const measurements = await geometry(target.measurementPath);
  const collection = target.measurementCollection ?? "symbols";
  const measurement = measurements[collection]?.[target.measurementKey];
  if (!measurement) {
    throw new Error(
      `Missing ${target.measurementKey} in ${target.measurementPath}`,
    );
  }
  const definition = getRazaviCatalogSymbol(target.symbolId);
  if (!definition) throw new Error(`Missing symbol ${target.symbolId}`);
  const referencePath = measurement.assetPath ?? manifest.assetPath;
  const report = await compareDevice(
    {
      symbolId: target.id,
      pixelsPerLogical: measurement.pixelsPerLogical,
      originPx: measurement.originPx,
      threshold: measurement.threshold ?? manifest.pixelThreshold ?? 160,
      useVariant: target.useVariant ?? false,
      rotation: target.rotation ?? measurement.rotation ?? 0,
      window: target.window ?? measurement.window,
    },
    await raster(referencePath),
    definition,
  );
  const encoded = await encodeReportRasters(report);
  await writeFile(resolve(outDir, `ref-${target.id}.png`), encoded.ref);
  await writeFile(
    resolve(outDir, `rendered-${target.id}.png`),
    encoded.rendered,
  );
  await writeFile(resolve(outDir, `diff-${target.id}.png`), encoded.diff);
  reports.push(report);
}

console.log("device              IoU softIoU regLift shift edge% verdict");
for (const report of reports) {
  console.log(
    [
      report.symbolId.padEnd(19),
      report.iou.toFixed(4),
      report.softIou.toFixed(4),
      `+${report.regLift.toFixed(3)}`,
      `${report.regBestShift.dx},${report.regBestShift.dy}`,
      `${Math.round(report.edgeShellRatio * 100)}%`,
      report.verdict,
    ].join(" "),
  );
}
console.log(`Diff PNGs written to ${outDir}`);
