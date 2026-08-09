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

async function dragLocator(
  locator: Locator,
  delta: { x: number; y: number },
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Drafting hit target is not measurable");
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await locator.page().mouse.move(start.x, start.y);
  await locator.page().mouse.down();
  await locator.page().mouse.move(start.x + delta.x, start.y + delta.y, {
    steps: 12,
  });
  await locator.page().mouse.up();
}

// The canvas-local toolbar creates RichText AST without exposing raw markup.
test("adds formatted drafting text and undo/redo restores it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revision")).toHaveText("0");

  await clickCommand(page, "More", "Add text");
  const draftInput = page.getByRole("textbox", {
    name: "Canvas text editor",
  });
  await expect(draftInput).toBeVisible();
  await draftInput.fill("Vin");
  await draftInput.press("Control+a");
  await page.getByRole("button", { name: "Subscript" }).click();
  await page.getByRole("button", { name: "Apply text changes" }).click();

  await expect(page.locator('[data-layer="drafting"]')).toContainText("Vin");
  await expect(page.getByTestId("revision")).toHaveText("2");

  const projectBytes = await downloadBytes(page, "File", "Save Project");
  const project = JSON.parse(projectBytes.toString("utf8"));
  const doc = project.documents[0];
  const textObject = doc.drafting.objects.find(
    (object: { kind: string }) => object.kind === "text",
  );
  expect(textObject).toBeTruthy();
  const runs = textObject.content.runs.map((run: { kind: string }) => run.kind);
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

// P0-2: moving an existing drafting object commits exactly one transaction,
// so one Ctrl+Z restores its original persisted anchor.
test("existing text drag commits once and undoes atomically (P0-2)", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Add text");
  await page
    .getByRole("textbox", { name: "Canvas text editor" })
    .press("Escape");
  await expect(page.getByTestId("revision")).toHaveText("1");

  const before = JSON.parse(
    (await downloadBytes(page, "File", "Save Project")).toString("utf8"),
  ).documents[0].drafting.objects[0].anchor.position;
  await dragLocator(page.getByTestId(/^drafting-hit-note-/), {
    x: 70,
    y: -45,
  });
  await expect(page.getByTestId("revision")).toHaveText("2");
  const moved = JSON.parse(
    (await downloadBytes(page, "File", "Save Project")).toString("utf8"),
  ).documents[0].drafting.objects[0].anchor.position;
  expect(moved).not.toEqual(before);

  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("revision")).toHaveText("3");
  const undone = JSON.parse(
    (await downloadBytes(page, "File", "Save Project")).toString("utf8"),
  ).documents[0].drafting.objects[0].anchor.position;
  expect(undone).toEqual(before);
});

test("Escape cancels an existing text drag without a revision", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Add text");
  await page
    .getByRole("textbox", { name: "Canvas text editor" })
    .press("Escape");
  const hit = page.getByTestId(/^drafting-hit-note-/);
  const box = await hit.boundingBox();
  if (!box) throw new Error("Drafting hit target is not measurable");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y - 30, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(page.getByText("Cancelled drafting drag")).toBeVisible();
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
    name: "Canvas text editor",
  });
  await draftInput.fill("Vin");
  await page.getByRole("button", { name: "Apply text changes" }).click();
  await expect(page.getByTestId("revision")).toHaveText("2");

  const handle = page.getByTestId(/^drafting-hit-note-/);
  await handle.dblclick();
  await expect(draftInput).toBeVisible();
  await page.getByRole("button", { name: "Apply text changes" }).click();
  await page.waitForTimeout(200);
  await expect(page.getByTestId("revision")).toHaveText("2");
});

// WP-R3/P1: a saved project is actually reopened through the file input and
// preserves both its canonical rich-text AST and anchor.
test("drafting content and anchor survive save and reopen (P1 persistence)", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "More", "Add text");
  const draftInput = page.getByRole("textbox", {
    name: "Canvas text editor",
  });
  await draftInput.fill("Vref");
  await page.getByRole("button", { name: "Insert fraction" }).click();
  await page.getByRole("button", { name: "Apply text changes" }).click();
  await expect(page.getByTestId("revision")).toHaveText("2");

  const projectBytes = await downloadBytes(page, "File", "Save Project");
  const project = JSON.parse(projectBytes.toString("utf8"));
  const textObject = project.documents[0].drafting.objects.find(
    (object: { kind: string }) => object.kind === "text",
  );
  expect(textObject).toBeTruthy();
  expect(
    textObject.content.runs.map((run: { kind: string }) => run.kind),
  ).toContain("fraction");
  expect(textObject.anchor).toMatchObject({ kind: "free" });
  expect(typeof textObject.anchor.position.x).toBe("number");
  await clickCommand(page, "More", "Add text");
  await expect(page.locator('[data-kind="draft-text"]')).toHaveCount(2);

  await page.getByTestId("project-file").setInputFiles({
    name: "saved-drafting.icproj.json",
    mimeType: "application/json",
    buffer: projectBytes,
  });
  await expect(
    page.getByText(/Opened saved-drafting\.icproj\.json/),
  ).toBeVisible();
  await expect(page.locator('[data-kind="draft-text"]')).toHaveCount(1);
  const reopenedBytes = await downloadBytes(page, "File", "Save Project");
  const reopened = JSON.parse(reopenedBytes.toString("utf8"));
  const reopenedText = reopened.documents[0].drafting.objects.find(
    (object: { kind: string }) => object.kind === "text",
  );
  expect(reopenedText.anchor).toEqual(textObject.anchor);
  expect(reopenedText.content).toEqual(textObject.content);
});
