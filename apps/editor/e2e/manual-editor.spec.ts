import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { resolve } from "node:path";

async function openMenu(page: Page, name: string): Promise<Locator> {
  const summary = page.locator("summary", { hasText: name }).filter({
    hasText: new RegExp(`^${name}$`, "u"),
  });
  const details = summary.locator("..");
  if ((await details.getAttribute("open")) === null) await summary.click();
  return details;
}

async function clickCommand(
  page: Page,
  menu: string,
  button: string,
): Promise<void> {
  const details = await openMenu(page, menu);
  await details.getByRole("button", { name: button, exact: true }).click();
}

async function chooseComponent(page: Page, symbolId: string): Promise<void> {
  await page.getByRole("button", { name: "+ Component" }).click();
  await page.getByTestId(`add-component-${symbolId}`).click();
}

async function placeComponent(
  page: Page,
  symbolId: string,
  position: { x: number; y: number },
): Promise<void> {
  await chooseComponent(page, symbolId);
  await page.getByTestId("schematic-canvas").click({ position });
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

async function downloadBytes(
  page: Page,
  menu: string,
  buttonName: string,
): Promise<Buffer> {
  const downloadPromise = page.waitForEvent("download");
  await clickCommand(page, menu, buttonName);
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function readRoutePoints(page: Page, routeId: string) {
  return page.getByTestId(`route-hit-${routeId}`).evaluate((element) => {
    const polyline = element as SVGPolylineElement;
    return Array.from(polyline.points).map((point) => ({
      x: point.x,
      y: point.y,
    }));
  });
}

test("shows faithful symbol previews and the expanded VSS-derived palette", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Component" }).click();
  for (const symbolId of [
    "nmos",
    "pmos",
    "zener",
    "schottky",
    "led",
    "opamp",
    "transformer",
  ]) {
    const button = page.getByTestId(`add-component-${symbolId}`);
    await expect(button).toBeVisible();
    await expect(button.locator("svg.palette-symbol-preview")).toBeVisible();
  }
  await expect(
    page.getByTestId("add-component-pmos").locator("circle"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("add-component-pmos").locator("polygon"),
  ).toHaveCount(3);
  await expect(page.getByTestId("add-component-nmos3")).toHaveCount(0);
  await expect(page.getByTestId("add-component-pmos3")).toHaveCount(0);
});

test("authors components and connectivity manually from an empty canvas", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revision")).toHaveText("0");

  await placeComponent(page, "resistor", { x: 340, y: 220 });
  await placeComponent(page, "nmos", { x: 560, y: 220 });
  await expect(page.getByTestId("hit-R1")).toBeVisible();
  await expect(page.getByTestId("hit-M2")).toBeVisible();
  await expect(page.getByTestId("terminal-M2-B")).toHaveCount(0);
  await expect(page.getByTestId("revision")).toHaveText("2");
  await expect(page.getByTestId("source-status")).toHaveText(
    "connectivity-modified",
  );

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-R1-2").click();
  await page.getByTestId("terminal-M2-G").click();
  await expect(page.getByTestId("revision")).toHaveText("3");
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(1);

  await page.getByTestId("terminal-R1-2").click({ button: "right" });
  await expect(
    page.getByRole("button", { name: "Disconnect endpoint" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete connection" }).click();
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(0);
  await expect(page.getByTestId("status")).toHaveText(
    "Deleted endpoint connection",
  );

  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("revision")).toHaveText("6");
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(0);
});

test("places free wire bends and finishes at an arbitrary grid point", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "resistor", { x: 300, y: 200 });
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-R1-2").click();
  const canvas = page.getByTestId("schematic-canvas");
  await canvas.click({ position: { x: 500, y: 260 } });
  await expect(page.getByTestId("wire-preview")).toBeVisible();
  await canvas.dblclick({ position: { x: 650, y: 340 } });
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(1);
  await expect(
    page.locator('[data-testid^="junction-junction-ui-"]'),
  ).toHaveCount(1);
  const points = await page
    .locator('[data-testid^="route-hit-"]')
    .evaluate((element) =>
      Array.from((element as SVGPolylineElement).points).map((point) => ({
        x: point.x,
        y: point.y,
      })),
    );
  expect(points.length).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("active-tool")).toHaveText("pointer");
});

test("leaves device pins on their natural axis and deletes a selected junction", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "nmos", { x: 300, y: 260 });
  await placeComponent(page, "resistor", { x: 540, y: 160 });
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-M1-D").click();
  await page.getByTestId("terminal-R2-1").click();

  const terminalRoute = await readRoutePoints(page, "route-ui-1");
  expect(terminalRoute.length).toBeGreaterThanOrEqual(3);
  expect(terminalRoute[0]!.x).toBe(terminalRoute[1]!.x);
  expect(terminalRoute.at(-2)!.y).toBe(terminalRoute.at(-1)!.y);
  expect(
    terminalRoute.every(
      (point) => Math.abs(point.x % 10) === 0 && Math.abs(point.y % 10) === 0,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-M1-G").click();
  await page
    .getByTestId("schematic-canvas")
    .dblclick({ position: { x: 180, y: 390 } });
  const junction = page.locator('[data-testid^="junction-junction-ui-"]');
  await expect(junction).toHaveCount(1);

  await junction.click();
  await expect(
    page.getByRole("button", { name: "Delete junction and attached wires" }),
  ).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(junction).toHaveCount(0);
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(1);
  await expect(page.getByTestId("status")).toContainText(
    "Deleted junction and 1 attached routes",
  );

  await page.keyboard.press("Control+z");
  await expect(junction).toHaveCount(1);
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(2);
});

test("connects copied multi-pin groups through a manually bent wire", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "nmos", { x: 320, y: 180 });
  await placeComponent(page, "nmos", { x: 320, y: 360 });
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-M1-S").click();
  await page.getByTestId("terminal-M2-D").click();

  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(page.getByTestId("instance-count")).toHaveText("4");

  await page.reload();
  await openMenu(page, "File");
  await page.getByRole("button", { name: "Restore recovery" }).click();
  await expect(page.getByTestId("instance-count")).toHaveText("4");

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-M2-S").click();
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 460, y: 500 } });
  await page.getByTestId("terminal-M2-copy-1-S").click();

  await expect(page.getByTestId("status")).toContainText("Committed route");
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(3);
  await expect(page.getByTestId("active-tool")).toHaveText("pointer");
});

test("moves a selected wire segment and deletes a connected component safely", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "resistor", { x: 320, y: 220 });
  await placeComponent(page, "resistor", { x: 520, y: 220 });
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-R1-2").click();
  await page.getByTestId("terminal-R2-1").click();

  await clickRoute(page, "route-ui-1");
  const handle = page.getByTestId("route-handle-route-ui-1");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Route handle is not measurable");
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2 + 80,
  );
  await page.mouse.up();
  await expect(page.getByTestId("status")).toContainText("Moved route segment");
  expect((await readRoutePoints(page, "route-ui-1")).length).toBe(4);

  await page.getByTestId("hit-R1").click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("instance-count")).toHaveText("1");
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(1);
  await expect(
    page.locator('[data-testid^="junction-junction-delete-"]'),
  ).toHaveCount(1);
  await expect(page.getByTestId("status")).toContainText(
    "connected wires remain dangling",
  );
});

test("moves internal wiring with a selected group and copies the routed subgraph", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "resistor", { x: 320, y: 220 });
  await placeComponent(page, "resistor", { x: 520, y: 220 });
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-R1-2").click();
  await page.getByTestId("terminal-R2-1").click();

  await page.keyboard.press("Control+a");
  await expect(page.getByTestId("selected-internal-route-count")).toHaveText(
    "1",
  );
  const before = await readRoutePoints(page, "route-ui-1");
  await page
    .getByTestId("hit-R1")
    .dragTo(page.getByTestId("schematic-canvas"), {
      targetPosition: { x: 470, y: 350 },
    });
  const after = await readRoutePoints(page, "route-ui-1");
  const delta = {
    x: after[0]!.x - before[0]!.x,
    y: after[0]!.y - before[0]!.y,
  };
  expect(delta).not.toEqual({ x: 0, y: 0 });
  expect(
    after.map((point, index) => ({
      x: point.x - before[index]!.x,
      y: point.y - before[index]!.y,
    })),
  ).toEqual(after.map(() => delta));

  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(page.getByTestId("instance-count")).toHaveText("4");
  await expect(page.getByTestId("net-count")).toHaveText("2");
  await expect(page.locator('[data-layer="routes"] polyline')).toHaveCount(2);
  await expect(page.getByTestId("selected-internal-route-count")).toHaveText(
    "1",
  );
});

test("edits instance, electrical Net, and free text with bounded label handles", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "resistor", { x: 280, y: 180 });
  await placeComponent(page, "resistor", { x: 480, y: 180 });
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-R1-2").click();
  await page.getByTestId("terminal-R2-1").click();

  await page.getByTestId("hit-R1").click();
  await page
    .getByRole("textbox", { name: "Displayed instance name" })
    .fill("R_LOAD");
  await page.getByRole("button", { name: "Apply name" }).click();
  await expect(page.locator('[data-layer="annotations"]')).toContainText(
    "R_LOAD",
  );

  await clickRoute(page, "route-ui-1", 0.35);
  await page
    .getByRole("textbox", { name: "Electrical Net label" })
    .fill("SIGNAL");
  await page.getByRole("button", { name: "Apply Net label" }).click();
  await expect(page.locator('[data-layer="annotations"]')).toContainText(
    "SIGNAL",
  );
  await expect(
    page.getByTestId("annotation-hit-net-label-route-ui-1"),
  ).toBeVisible();

  await placeComponent(page, "resistor", { x: 280, y: 320 });
  await placeComponent(page, "resistor", { x: 480, y: 320 });
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-R3-2").click();
  await page.getByTestId("terminal-R4-1").click();
  await expect(page.getByTestId("net-count")).toHaveText("2");
  await clickRoute(page, "route-ui-2", 0.35);
  await page
    .getByRole("textbox", { name: "Electrical Net label" })
    .fill("SIGNAL");
  await page.getByRole("button", { name: "Apply Net label" }).click();
  await expect(page.getByTestId("net-count")).toHaveText("1");
  await expect(page.getByTestId("status")).toHaveText(
    "Connected Nets through label SIGNAL",
  );

  await clickCommand(page, "More", "Add text");
  const textInput = page.getByRole("textbox", {
    name: "Selected text content",
  });
  await textInput.fill("Matched pair");
  await page.getByRole("button", { name: "Apply text" }).click();
  await expect(page.locator('[data-layer="annotations"]')).toContainText(
    "Matched pair",
  );
  const noteHandle = page.locator('[data-testid^="annotation-hit-note-"]');
  const beforeBox = await noteHandle.boundingBox();
  if (!beforeBox) throw new Error("Text handle is not measurable");
  await noteHandle.dragTo(page.getByTestId("schematic-canvas"), {
    targetPosition: { x: 700, y: 300 },
  });
  const afterBox = await noteHandle.boundingBox();
  expect(afterBox?.x).not.toBe(beforeBox.x);
});

test("selects and moves multiple instances while viewport gestures stay transient", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "nmos", { x: 330, y: 180 });
  await placeComponent(page, "nmos", { x: 560, y: 180 });
  await expect(page.getByTestId("revision")).toHaveText("2");

  const first = await page.getByTestId("hit-M1").boundingBox();
  const second = await page.getByTestId("hit-M2").boundingBox();
  if (!first || !second) throw new Error("Instances are not measurable");
  await page.mouse.move(first.x - 15, first.y - 15);
  await page.mouse.down();
  await page.mouse.move(
    second.x + second.width + 15,
    second.y + second.height + 15,
    {
      steps: 5,
    },
  );
  await page.mouse.up();
  await expect(page.getByText("M1, M2", { exact: true })).toBeVisible();

  await page
    .getByTestId("hit-M1")
    .dragTo(page.getByTestId("schematic-canvas"), {
      targetPosition: { x: 450, y: 330 },
    });
  await expect(page.getByTestId("revision")).toHaveText("3");

  const canvas = page.getByTestId("schematic-canvas");
  const beforeViewBox = await canvas.getAttribute("viewBox");
  await canvas.dispatchEvent("wheel", {
    ctrlKey: true,
    deltaY: -120,
    clientX: 700,
    clientY: 350,
  });
  await expect(canvas).not.toHaveAttribute("viewBox", beforeViewBox!);
  await expect(page.getByTestId("revision")).toHaveText("3");

  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Canvas is not measurable");
  await page.mouse.move(canvasBox.x + 700, canvasBox.y + 350);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(canvasBox.x + 750, canvasBox.y + 390, { steps: 3 });
  await page.mouse.up({ button: "middle" });
  await expect(page.getByTestId("revision")).toHaveText("3");

  await page.keyboard.press("r");
  await expect(page.getByTestId("revision")).toHaveText("4");
});

test("derives crossings and creates junctions only when a wire ends on a route", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Open routing example");

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-A-P1").click();
  await page.getByTestId("terminal-B-P1").click();
  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-C-P1").click();
  await page.getByTestId("terminal-D-P1").click();
  await expect(page.getByTestId("crossing-count")).toHaveText("1");
  await expect(page.locator('[data-layer="junctions"] circle')).toHaveCount(0);

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-E-P1").click();
  await clickRoute(page, "route-ui-1", 0.5);
  await expect(page.getByTestId("status")).toContainText(
    "Ambiguous intersection",
  );
  await expect(page.getByTestId("revision")).toHaveText("2");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Wire" }).click();
  await page.getByTestId("terminal-E-P1").click();
  await clickRoute(page, "route-ui-1", 0.25);
  await expect(page.getByTestId("revision")).toHaveText("3");
  await expect(page.getByTestId("junction-junction-ui-3")).toBeVisible();
  await expect(page.getByTestId("crossing-count")).toHaveText("3");

  await clickRoute(page, "route-ui-2", 0.25);
  const handle = page.getByTestId("route-handle-route-ui-2");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Route handle is not measurable");
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 45, handleBox.y + handleBox.height / 2, {
    steps: 3,
  });
  await page.mouse.up();
  await expect(page.getByTestId("revision")).toHaveText("4");
});

test("imports the SPICE baseline through the grouped File menu", async ({
  page,
}) => {
  await page.goto("/");
  await openMenu(page, "File");
  await page
    .getByTestId("spice-files")
    .setInputFiles([
      resolve(process.cwd(), "netlists/mixed-device-acceptance/circuit.spi"),
      resolve(process.cwd(), "netlists/mixed-device-acceptance/models.inc"),
    ]);

  await expect(page.getByTestId("status")).toHaveText(
    "Imported 8 Documents and 32 instances; 6 generic symbols",
  );
  await expect(page.getByTestId("document-count")).toHaveText("8");
  await expect(page.getByTestId("instance-count")).toHaveText("32");
  await expect(page.getByTestId("unplaced-XFILTER")).toBeVisible();
  const topDocumentId = await page
    .getByTestId("active-document-id")
    .textContent();
  expect(topDocumentId).toBeTruthy();
  await page.getByTestId("diagnostic-0").click();
  await expect(page.getByTestId("status")).toContainText("VISUAL_UNPLACED_");

  await page.getByTestId("unplaced-XFILTER").click();
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(page.getByTestId("active-document-name")).toHaveText(
    "mixed_passive_cell",
  );
  await expect(page.getByTestId("active-instance-count")).toHaveText("3");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByTestId("active-document-name")).toHaveText(
    "mixed_device_acceptance",
  );

  await page
    .getByTestId("document-selector")
    .selectOption({ label: "mixed_diode_cell" });
  await expect(page.getByTestId("active-document-name")).toHaveText(
    "mixed_diode_cell",
  );
  await page.locator('[data-testid^="unplaced-port-"]').first().click();
  await expect(page.getByTestId("revision")).toHaveText("1");

  const projectBytes = await downloadBytes(page, "File", "Save Project");
  expect(JSON.parse(projectBytes.toString("utf8")).topDocumentId).toBe(
    topDocumentId,
  );
});

test("exports one formal visual scene as Project, SVG, PNG, and PDF", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Open visual example");
  await expect(page.getByTestId("blocking-diagnostic-count")).toHaveText("0");

  const projectBytes = await downloadBytes(page, "File", "Save Project");
  expect(JSON.parse(projectBytes.toString("utf8")).topDocumentId).toBe(
    "document-differential-stage",
  );
  const svg = (await downloadBytes(page, "Export", "Export SVG")).toString(
    "utf8",
  );
  expect(svg).toContain('data-layer="formal"');
  expect(svg).not.toMatch(/selection|route-hit|editor-overlay/u);

  const png = await downloadBytes(page, "Export", "Export PNG");
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const pdf = await downloadBytes(page, "Export", "Export PDF");
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
});

test("uses automatic recovery and guards shortcuts while typing", async ({
  page,
}) => {
  await page.goto("/");
  await placeComponent(page, "resistor", { x: 360, y: 220 });
  await expect(page.getByTestId("revision")).toHaveText("1");
  expect(
    await page.evaluate(() => localStorage.getItem("icm.recovery.v1")),
  ).toContain('"revision": 1');

  await page.reload();
  await openMenu(page, "File");
  await page.getByRole("button", { name: "Restore recovery" }).click();
  await expect(page.getByTestId("revision")).toHaveText("1");

  await page.getByRole("button", { name: "+ Component" }).click();
  const search = page.getByRole("textbox", { name: "Search components" });
  await search.fill("r");
  await expect(page.getByTestId("revision")).toHaveText("1");
});

test("keeps the production command surface compact and publishes PWA metadata", async ({
  page,
}) => {
  await page.goto("/");
  const toolbar = page.getByRole("navigation", { name: "Editor commands" });
  await expect(
    toolbar.getByRole("button", { name: "+ Component" }),
  ).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Wire" })).toBeVisible();
  for (const label of ["File", "Edit", "View", "Export", "More"]) {
    await expect(toolbar.locator("summary", { hasText: label })).toBeVisible();
  }
  for (const obsolete of [
    "Select",
    "Junction",
    "Crossing",
    "Stretch",
    "Detach",
  ]) {
    await expect(
      toolbar.getByRole("button", { name: obsolete, exact: true }),
    ).toHaveCount(0);
  }

  const manifest = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifest).toBe("/manifest.webmanifest");
  expect(
    await (await page.request.get("/manifest.webmanifest")).json(),
  ).toMatchObject({
    name: "Interactive Circuit Maker",
    display: "standalone",
  });
});
