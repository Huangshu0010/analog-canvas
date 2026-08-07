import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { importSpiceSources } from "../../packages/spice/dist/index.js";

import { flattenDocument } from "./flatten-project.mjs";

const bytes = await readFile(
  "netlists/sky130-transistor-divide-by-2/circuit.spi",
);
const imported = await importSpiceSources(
  [{ path: "circuit.spi", bytes }],
  "circuit.spi",
);
assert.equal(imported.successful, true);
const flat = flattenDocument(
  imported.project,
  "divide_by_2",
  "divide_by_2_flat",
);

assert.equal(flat.instances.length, 30);
assert.equal(
  flat.instances.filter((item) => item.symbolId === "nmos").length,
  15,
);
assert.equal(
  flat.instances.filter((item) => item.symbolId === "pmos").length,
  14,
);
assert.equal(
  flat.instances.filter((item) => item.symbolId === "capacitor").length,
  1,
);
assert.equal(
  flat.instances.some((item) =>
    item.symbolId.startsWith("hierarchical-symbol-"),
  ),
  false,
);
assert.deepEqual(flat.nets.map((net) => net.name).sort(), [
  "XFF__XNQ__pmid",
  "XFF__mfb",
  "XFF__mm",
  "XFF__mmb",
  "XFF__sfb",
  "XFF__sm",
  "ckb",
  "cki",
  "clk",
  "clkout",
  "d",
  "qb",
  "qstate",
  "reset",
  "vdd",
  "vss",
]);

const qstate = flat.nets.find((net) => net.name === "qstate");
for (const terminal of [
  { instanceId: "XFB__XP", pinName: "G" },
  { instanceId: "XFF__XNQ__XP1", pinName: "D" },
  { instanceId: "XFF__XI2__XP", pinName: "G" },
  { instanceId: "XBUF0__XP", pinName: "G" },
  { instanceId: "CSTATE", pinName: "1" },
]) {
  assert.equal(
    qstate?.terminals.some(
      (candidate) =>
        candidate.instanceId === terminal.instanceId &&
        candidate.pinName === terminal.pinName,
    ),
    true,
    `Missing qstate terminal ${terminal.instanceId}.${terminal.pinName}`,
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      instances: flat.instances.length,
      nmos: 15,
      pmos: 14,
      capacitors: 1,
      nets: flat.nets.length,
      hierarchicalInstances: 0,
    },
    null,
    2,
  )}\n`,
);
