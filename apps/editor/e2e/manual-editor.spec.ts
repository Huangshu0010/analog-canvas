import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { resolve } from "node:path";

async function dragInstance(
  page: Page,
  instanceId: string,
  x: number,
  y: number,
): Promise<void> {
  await page
    .getByTestId(`unplaced-${instanceId}`)
    .dragTo(page.getByTestId("schematic-canvas"), {
      targetPosition: { x, y },
    });
  await expect(page.getByTestId(`hit-${instanceId}`)).toBeVisible();
}

async function clickRoute(
  page: Page,
  routeId: string,
  position = 0.5,
  segmentIndex = 0,
): Promise<void> {
  const route = page.getByTestId(`route-hit-${routeId}`);
  const point = await route.evaluate(
    (element, options) => {
      const polyline = element as SVGPolylineElement;
      const first = polyline.points.getItem(options.segmentIndex);
      const second = polyline.points.getItem(options.segmentIndex + 1);
      const matrix = polyline.getScreenCTM();
      if (!first || !second || !matrix) return null;
      const local = new DOMPoint(
        first.x + (second.x - first.x) * options.position,
        first.y + (second.y - first.y) * options.position,
      );
      const screen = local.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    },
    { position, segmentIndex },
  );
  if (!point) throw new Error(`Route ${routeId} is not measurable`);
  await page.mouse.click(point.x, point.y);
}

test("manual place, transform, history, save, reopen, and export closure", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Interactive Circuit Maker" }),
  ).toBeVisible();
  await expect(page.getByTestId("revision")).toHaveText("0");

  await dragInstance(page, "M1", 320, 180);
  await expect(page.getByTestId("revision")).toHaveText("1");
  await dragInstance(page, "M2", 520, 180);
  await expect(page.getByTestId("revision")).toHaveText("2");
  await dragInstance(page, "R1", 420, 360);
  await expect(page.getByTestId("revision")).toHaveText("3");
  await expect(page.getByText("All instances placed")).toBeVisible();

  await page.getByTestId("hit-R1").click();
  await page.getByRole("button", { name: "Rotate" }).click();
  await page.getByRole("button", { name: "Mirror" }).click();
  await expect(page.getByTestId("revision")).toHaveText("5");

  const hit = page.getByTestId("hit-M1");
  const canvas = page.getByTestId("schematic-canvas");
  const hitBox = await hit.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!hitBox || !canvasBox) {
    throw new Error("Editor geometry is not measurable");
  }
  await page.mouse.move(
    hitBox.x + hitBox.width / 2,
    hitBox.y + hitBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 650, canvasBox.y + 300, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("revision")).toHaveText("6");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("revision")).toHaveText("7");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByTestId("revision")).toHaveText("8");

  await page.getByRole("button", { name: "Save snapshot" }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("icm.phase1.snapshot"),
  );
  expect(saved).not.toBeNull();
  expect(saved).not.toMatch(/selection|viewport|dragPreview|editor-overlay/u);

  const movedHitBox = await page.getByTestId("hit-M1").boundingBox();
  if (!movedHitBox) {
    throw new Error("Moved instance is not measurable");
  }
  await page.mouse.move(
    movedHitBox.x + movedHitBox.width / 2,
    movedHitBox.y + movedHitBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 720, canvasBox.y + 380, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("revision")).toHaveText("9");

  await page.getByRole("button", { name: "Reopen snapshot" }).click();
  await expect(page.getByTestId("revision")).toHaveText("8");
  await expect(page.getByTestId("status")).toHaveText("Reopened revision 8");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const svg = Buffer.concat(chunks).toString("utf8");
  expect(svg).toContain('data-layer="formal"');
  expect(svg).not.toMatch(/selection|hit-target|editor-overlay/u);
});

test("imports a selected SPICE source set into unplaced Documents", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("spice-files")
    .setInputFiles([
      resolve(process.cwd(), "netlists/mixed-device-acceptance/circuit.spi"),
      resolve(process.cwd(), "netlists/mixed-device-acceptance/models.inc"),
    ]);

  await expect(page.getByTestId("status")).toHaveText(
    "Imported 8 Documents and 32 instances; 17 generic symbols",
  );
  await expect(
    page.getByText("mixed_device_acceptance (SPICE Import)"),
  ).toBeVisible();
  await expect(page.getByTestId("document-count")).toHaveText("8");
  await expect(page.getByTestId("instance-count")).toHaveText("32");
  await expect(page.getByTestId("revision")).toHaveText("0");
  await expect(page.getByTestId("unplaced-XFILTER")).toBeVisible();
  await expect(page.getByTestId("unplaced-XCONTROL")).toBeVisible();

  await page.getByRole("button", { name: "Save snapshot" }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("icm.phase1.snapshot"),
  );
  const project = JSON.parse(saved!);
  expect(project.documents).toHaveLength(8);
  expect(
    project.source.files.map((file: { path: string }) => file.path),
  ).toEqual(["circuit.spi", "models.inc"]);
  expect(saved).not.toMatch(
    /rawText|logicalLines|syntaxFiles|unresolvedStatements|diagnostics/u,
  );
});

test("imports the ngspice 46 structural baseline through the browser", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("spice-files")
    .setInputFiles([
      resolve(process.cwd(), "fixtures/spice-baseline/core.cir"),
      resolve(process.cwd(), "fixtures/spice-baseline/models.lib"),
    ]);

  await expect(page.getByTestId("status")).toHaveText(
    "Imported 3 Documents and 27 instances; 16 generic symbols",
  );
  await expect(page.getByTestId("document-count")).toHaveText("3");
  await expect(page.getByTestId("instance-count")).toHaveText("27");
  await expect(page.getByTestId("unplaced-XTOP")).toBeVisible();
  await expect(page.getByTestId("revision")).toHaveText("0");
});

test("routes explicit connectivity without treating crossings as joins", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Routing demo" }).click();

  await expect(page.getByTestId("flightline-count")).toHaveText("3");
  await expect(page.getByTestId("crossing-count")).toHaveText("0");

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-A-P1").click();
  await page.getByTestId("terminal-B-P1").click();
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(page.getByTestId("flightline-count")).toHaveText("2");

  await page.getByTestId("terminal-C-P1").click();
  await page.getByTestId("terminal-D-P1").click();
  await expect(page.getByTestId("revision")).toHaveText("2");
  await expect(page.getByTestId("flightline-count")).toHaveText("1");
  await expect(page.getByTestId("crossing-count")).toHaveText("1");

  await page.getByRole("button", { name: "Junction" }).click();
  await clickRoute(page, "route-ui-1", 0.25);
  await expect(page.getByTestId("revision")).toHaveText("3");
  await expect(page.getByTestId("junction-junction-ui-3")).toBeVisible();

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-E-P1").click();
  await page.getByTestId("junction-junction-ui-3").click();
  await expect(page.getByTestId("revision")).toHaveText("4");
  await expect(page.getByTestId("flightline-count")).toHaveText("0");

  await page.getByRole("button", { name: "Select" }).click();
  await clickRoute(page, "route-ui-2");
  await page.getByRole("button", { name: "Stretch" }).click();
  await expect(page.getByTestId("revision")).toHaveText("5");

  const instanceA = page.getByTestId("hit-A");
  const canvas = page.getByTestId("schematic-canvas");
  const instanceBox = await instanceA.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!instanceBox || !canvasBox) {
    throw new Error("Routing demo geometry is not measurable");
  }
  await page.mouse.move(
    instanceBox.x + instanceBox.width / 2,
    instanceBox.y + instanceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 180, canvasBox.y + 340, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("revision")).toHaveText("6");

  await clickRoute(page, "route-ui-4", 0.5, 1);
  await page.getByRole("button", { name: "Detach" }).click();
  await expect(page.getByTestId("revision")).toHaveText("7");
  await expect(page.getByTestId("flightline-count")).toHaveText("1");

  await page.getByRole("button", { name: "Save snapshot" }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("icm.phase1.snapshot"),
  );
  expect(saved).not.toBeNull();
  expect(saved).toContain("junction-ui-3");
  expect(saved).not.toMatch(/flightline|crossing|wireSource/u);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const svg = Buffer.concat(chunks).toString("utf8");
  expect(svg).toContain('data-layer="routes"');
  expect(svg).toContain('data-layer="junctions"');
  expect(svg).toContain('data-object-id="junction-ui-3"');
  expect(svg).not.toMatch(/flightline|route-hit|editor-overlay/u);
});

test("loads and edits the reviewed textbook-monochrome visual demo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Visual demo" }).click();
  await expect(page.getByTestId("status")).toHaveText(
    "Loaded Phase 5 visual demo",
  );
  await expect(page.getByTestId("annotation-count")).toHaveText("13");
  await expect(page.getByTestId("crossing-count")).toHaveText("0");
  await expect(page.getByTestId("blocking-diagnostic-count")).toHaveText("0");
  await expect(
    page.locator('[data-layer="annotations"] [data-kind="current"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-layer="annotations"] [data-kind="figure-caption"]'),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByTestId("annotation-count")).toHaveText("14");
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(page.getByTestId("status")).toHaveText(
    "Added annotation note-1",
  );
});
