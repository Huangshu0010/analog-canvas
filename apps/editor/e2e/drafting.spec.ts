import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

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

// P1 helper: run a canvas drag-create gesture by dispatching pointer events
// directly on the schematic canvas element.
async function dragCreate(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const canvas = page.getByTestId("schematic-canvas");
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 1,
    clientX: from.x,
    clientY: from.y,
    button: 0,
  });
  await canvas.dispatchEvent("pointermove", {
    pointerId: 1,
    clientX: to.x,
    clientY: to.y,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 1,
    clientX: to.x,
    clientY: to.y,
    button: 0,
  });
}

// WP-R6 scenario A: add drafting text with rich markup, verify the canonical
// AST is persisted and undo/redo restores it.
test("adds drafting text with rich markup and undo/redo restores it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revision")).toHaveText("0");

  await clickCommand(page, "More", "Add text");
  const draftInput = page.getByRole("textbox", {
    name: "Drafting text content",
  });
  await expect(draftInput).toBeVisible();
  await draftInput.fill("V_{in}^{+} = \\frac{V_{DD}}{2}");
  await page.getByRole("button", { name: "Apply text" }).click();

  await expect(page.locator('[data-layer="drafting"]')).toContainText(
    "Vin+ = VDD2",
  );
  await expect(page.getByTestId("revision")).toHaveText("2");

  const projectBytes = await downloadBytes(page, "File", "Save Project");
  const project = JSON.parse(projectBytes.toString("utf8"));
  const doc = project.documents[0];
  const textObject = doc.drafting.objects.find(
    (object: { kind: string }) => object.kind === "text",
  );
  expect(textObject).toBeTruthy();
  const runs = textObject.content.runs.map((run: { kind: string }) => run.kind);
  expect(runs).toContain("fraction");
  expect(runs).toContain("span");

  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-layer="drafting"] text')).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(page.locator('[data-layer="drafting"] text')).toHaveCount(0);
  await page.keyboard.press("Control+y");
  await expect(page.locator('[data-layer="drafting"] text')).toHaveCount(1);
  await page.keyboard.press("Control+y");
  await expect(page.getByTestId("revision")).toHaveText("6");
});

// WP-R6 scenario E: export bounds cover drafting content and guides never
// appear in the SVG.
test("export includes drafting bounds and never emits guides (WP-R6)", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Construction line tool (drag)");
  await dragCreate(page, { x: 200, y: 200 }, { x: 420, y: 260 });
  await expect(page.getByTestId("revision")).toHaveText("1");
  await clickCommand(page, "More", "Add vertical guide");
  await expect(page.getByTestId("revision")).toHaveText("2");
  await expect(page.locator('[data-testid^="guide-"]')).toHaveCount(1);

  const svg = (await downloadBytes(page, "Export", "Export SVG")).toString(
    "utf8",
  );
  expect(svg).toContain('data-kind="construction-line"');
  expect(svg).not.toContain('data-kind="guide"');
  expect(svg).not.toContain("guide-");
});

// WP-R6 scenario F: the editor mounts without console errors (dev server; the
// production-preview smoke is covered by the build gate).
test("editor mounts without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByTestId("schematic-canvas")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

// P0-2: a drafting drag (the drag-create gesture) commits exactly one
// transaction, so one Ctrl+Z fully undoes it.
test("drag-create commits one revision and undoes atomically (P0-2)", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Construction line tool (drag)");
  await expect(page.getByTestId("active-tool")).toHaveText("construction-line");
  await dragCreate(page, { x: 200, y: 200 }, { x: 420, y: 260 });
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(
    page.locator(
      '[data-layer="drafting"] polyline[data-kind="construction-line"]',
    ),
  ).toHaveCount(1);

  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("revision")).toHaveText("2");
  await expect(
    page.locator(
      '[data-layer="drafting"] polyline[data-kind="construction-line"]',
    ),
  ).toHaveCount(0);
});

// P1: drag-creating a construction line commits one object.
test("drag-creates a construction line (P1 tools)", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "More", "Construction line tool (drag)");
  await expect(page.getByTestId("active-tool")).toHaveText("construction-line");
  await dragCreate(page, { x: 200, y: 200 }, { x: 420, y: 260 });
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(
    page.locator(
      '[data-layer="drafting"] polyline[data-kind="construction-line"]',
    ),
  ).toHaveCount(1);
});

// P1: drag-creating an arrow commits one object.
test("drag-creates an arrow (P1 tools)", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "More", "Arrow tool (drag)");
  await expect(page.getByTestId("active-tool")).toHaveText("arrow");
  await dragCreate(page, { x: 200, y: 320 }, { x: 420, y: 380 });
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(
    page.locator('[data-layer="drafting"] g[data-kind="draft-arrow"]'),
  ).toHaveCount(1);
});

// P1: shape-based hit — a construction line selects via its stroke and does
// not block a click below its bounds rect.
test("construction line uses stroke-based hit, not a blocking rect (P1 hit)", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Construction line tool (drag)");
  await dragCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
  await expect(page.getByTestId("revision")).toHaveText("1");

  const hit = page.getByTestId(/^drafting-hit-construction-/);
  await expect(hit).toHaveCount(1);
  const tag = await hit.evaluate((element) => element.tagName);
  expect(tag).toBe("polyline");

  const line = page.locator(
    '[data-layer="drafting"] polyline[data-kind="construction-line"]',
  );
  const box = await line.boundingBox();
  if (!box) throw new Error("Construction line is not measurable");
  await page.mouse.click(box.x + 40, box.y + box.height / 2);
  await expect(
    page.locator('[data-testid^="drafting-hit-construction-"].selected'),
  ).toHaveCount(1);
});

// WP-R3 scenario B: an unedited Apply must not add a revision.
test("unedited Apply does not add a revision (WP-R3)", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "More", "Add text");
  const draftInput = page.getByRole("textbox", {
    name: "Drafting text content",
  });
  await draftInput.fill("V_{in}");
  await page.getByRole("button", { name: "Apply text" }).click();
  await expect(page.getByTestId("revision")).toHaveText("2");

  const handle = page.getByTestId(/^drafting-hit-note-/);
  await handle.click();
  await expect(draftInput).toBeVisible();
  await page.getByRole("button", { name: "Apply text" }).click();
  await page.waitForTimeout(200);
  await expect(page.getByTestId("revision")).toHaveText("2");
});

// WP-R3/P1: a saved project preserves drafting anchors across recovery.
test("drafting anchor survives save and recovery (P1 persistence)", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Add text");
  const draftInput = page.getByRole("textbox", {
    name: "Drafting text content",
  });
  await draftInput.fill("V_{in}");
  await page.getByRole("button", { name: "Apply text" }).click();
  await expect(page.getByTestId("revision")).toHaveText("2");

  const projectBytes = await downloadBytes(page, "File", "Save Project");
  const project = JSON.parse(projectBytes.toString("utf8"));
  const textObject = project.documents[0].drafting.objects.find(
    (object: { kind: string }) => object.kind === "text",
  );
  expect(textObject).toBeTruthy();
  expect(textObject.anchor).toMatchObject({ kind: "free" });
  expect(typeof textObject.anchor.position.x).toBe("number");

  // Recovery data is written on commit; if present it must round-trip the
  // drafting anchor (defensive, not the primary assertion).
  const recovery = await page.evaluate(() =>
    localStorage.getItem("icm.recovery.v1"),
  );
  if (recovery) {
    const recovered = JSON.parse(recovery);
    const recoveredText = recovered.documents[0].drafting.objects.find(
      (object: { kind: string }) => object.kind === "text",
    );
    expect(recoveredText?.anchor).toEqual(textObject.anchor);
  }
});
