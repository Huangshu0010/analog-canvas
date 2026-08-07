import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { builtInSymbols } from "../../packages/symbols/dist/index.js";

const outputPath = resolve(
  process.cwd(),
  "fixtures/visual-golden/phase-5-symbol-review.svg",
);
const candidateOutputPath = resolve(
  process.cwd(),
  "fixtures/visual-golden/vss-migration-candidates.svg",
);
const check = process.argv.includes("--check");
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const points = (value) =>
  value.map((point) => `${point.x},${point.y}`).join(" ");
const legacyStrokeRoles = {
  normal: 1.2,
  emphasis: 2.16,
  supply: 2.16,
  annotation: 0.8,
};
const primitiveStyle = (item) => {
  if (!item.style) return "";
  const strokeWidth = item.style.strokeRole
    ? legacyStrokeRoles[item.style.strokeRole]
    : item.style.strokeWidth;
  if (item.style.strokeRole && strokeWidth === undefined) {
    throw new Error(`Unknown symbol stroke role: ${item.style.strokeRole}`);
  }
  return [
    strokeWidth === undefined ? "" : ` stroke-width="${strokeWidth}"`,
    item.style.lineCap === undefined
      ? ""
      : ` stroke-linecap="${item.style.lineCap}"`,
    item.style.lineJoin === undefined
      ? ""
      : ` stroke-linejoin="${item.style.lineJoin}"`,
  ].join("");
};
const primitive = (item) => {
  const style = primitiveStyle(item);
  switch (item.kind) {
    case "line":
      return `<line x1="${item.from.x}" y1="${item.from.y}" x2="${item.to.x}" y2="${item.to.y}"${style}/>`;
    case "polyline":
      return `<polyline points="${points(item.points)}"${style}/>`;
    case "polygon":
      return `<polygon points="${points(item.points)}" fill="${item.fill === "foreground" ? "#000" : "none"}"${style}/>`;
    case "circle":
      return `<circle cx="${item.center.x}" cy="${item.center.y}" r="${item.radius}"${style}/>`;
    case "path":
      return `<path d="${escape(item.data)}"${style}/>`;
  }
};

const reviewManifest = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "fixtures/symbols/circuit-vss-review.json"),
    "utf8",
  ),
);
const reviewedIds = new Set(
  reviewManifest.mappings.map((mapping) => mapping.symbolId),
);
const reviewed = builtInSymbols.filter((symbol) => reviewedIds.has(symbol.id));
const candidateIds = new Set(
  reviewManifest.migrationCandidates.map((mapping) => mapping.symbolId),
);
const candidates = builtInSymbols.filter((symbol) =>
  candidateIds.has(symbol.id),
);
const catalog = (symbols, layer, status) => {
  const cells = symbols
    .map((symbol, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 80 + column * 150;
      const y = 65 + row * 125;
      const geometry = symbol.primitives.map(primitive).join("");
      return `<g data-symbol-id="${escape(symbol.id)}" transform="translate(${x} ${y})"><g fill="none" stroke="#000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter">${geometry}</g><text y="50" text-anchor="middle">${escape(symbol.id)}</text></g>`;
    })
    .join("");
  const rows = Math.ceil(symbols.length / 4);
  const height = rows * 125 + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" data-review-source="circuit.vss" data-pin-status="${status}"><rect width="640" height="${height}" fill="#fff"/><style>text{fill:#000;font-family:Georgia,'Times New Roman',serif;font-size:12px}path,polyline,polygon,line,circle{vector-effect:non-scaling-stroke}</style><g data-layer="${layer}">${cells}</g></svg>\n`;
};
const svg = catalog(reviewed, "reviewed-symbols", "reviewed");
const candidateSvg = catalog(
  candidates,
  "migration-candidates",
  "review-required",
);

if (check) {
  const existing = readFileSync(outputPath, "utf8");
  const existingCandidates = readFileSync(candidateOutputPath, "utf8");
  if (existing !== svg || existingCandidates !== candidateSvg) {
    throw new Error("Phase 5 symbol review golden is stale");
  }
  console.log(
    `Validated ${reviewed.length} reviewed and ${candidates.length} migration-candidate symbol previews`,
  );
} else {
  writeFileSync(outputPath, svg, "utf8");
  writeFileSync(candidateOutputPath, candidateSvg, "utf8");
  console.log(
    `Wrote ${reviewed.length} reviewed and ${candidates.length} migration-candidate symbol previews`,
  );
}
