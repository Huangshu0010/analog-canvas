import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { builtInSymbols } from "../../packages/symbols/dist/index.js";

const outputPath = resolve(
  process.cwd(),
  "fixtures/visual-golden/phase-5-symbol-review.svg",
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
const primitive = (item) => {
  switch (item.kind) {
    case "line":
      return `<line x1="${item.from.x}" y1="${item.from.y}" x2="${item.to.x}" y2="${item.to.y}"/>`;
    case "polyline":
      return `<polyline points="${points(item.points)}"/>`;
    case "polygon":
      return `<polygon points="${points(item.points)}" fill="${item.fill === "foreground" ? "#000" : "none"}"/>`;
    case "circle":
      return `<circle cx="${item.center.x}" cy="${item.center.y}" r="${item.radius}"/>`;
    case "path":
      return `<path d="${escape(item.data)}"/>`;
  }
};

const reviewed = builtInSymbols.filter(
  (symbol) => symbol.id !== "generic-block",
);
const cells = reviewed
  .map((symbol, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 80 + column * 150;
    const y = 65 + row * 125;
    const geometry = symbol.primitives.map(primitive).join("");
    return `<g data-symbol-id="${escape(symbol.id)}" transform="translate(${x} ${y})"><g fill="none" stroke="#000" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter">${geometry}</g><text y="50" text-anchor="middle">${escape(symbol.id)}</text></g>`;
  })
  .join("");
const rows = Math.ceil(reviewed.length / 4);
const height = rows * 125 + 20;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" data-review-source="circuit.vss"><rect width="640" height="${height}" fill="#fff"/><style>text{fill:#000;font-family:Georgia,'Times New Roman',serif;font-size:12px}path,polyline,polygon,line,circle{vector-effect:non-scaling-stroke}</style><g data-layer="reviewed-symbols">${cells}</g></svg>\n`;

if (check) {
  const existing = readFileSync(outputPath, "utf8");
  if (existing !== svg) {
    throw new Error("Phase 5 symbol review golden is stale");
  }
  console.log(`Validated ${reviewed.length} reviewed symbol previews`);
} else {
  writeFileSync(outputPath, svg, "utf8");
  console.log(
    `Wrote ${reviewed.length} reviewed symbol previews to ${outputPath}`,
  );
}
