import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { rasterizeSvgBytes } from "../packages/exporters/dist/node.js";

const check = process.argv.includes("--check");
const publicRoot = resolve("apps/editor/public");
const svg = await readFile(resolve(publicRoot, "icon.svg"), "utf8");
for (const size of [192, 512]) {
  const path = resolve(publicRoot, `icon-${size}.png`);
  const bytes = Buffer.from(rasterizeSvgBytes(svg, size));
  if (check) {
    const expected = await readFile(path);
    if (!expected.equals(bytes)) throw new Error(`PWA icon differs: ${size}`);
  } else {
    await writeFile(path, bytes);
  }
}
process.stdout.write(`PWA icons ${check ? "match" : "written"}.\n`);
