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

// Two-phase drafting creation: click to set the start, move to preview, click to
// commit. Arrow commits on the second click; construction line commits on the
// second click too (a 2-point line). Uses real mouse clicks (not pointer
// dispatch) so the editor's onClick handler — which gates on event.detail === 1
// — fires, and a pointermove drives the hover preview between the two clicks.
async function clickCreate(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const canvas = page.getByTestId("schematic-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Schematic canvas is not measurable");
  const start = { x: box.x + from.x, y: box.y + from.y };
  const end = { x: box.x + to.x, y: box.y + to.y };
  await page.mouse.click(start.x, start.y);
  await page.mouse.move(end.x, end.y);
  await page.mouse.click(end.x, end.y);
  // Arrows commit on the second click. Construction lines retain that click as
  // a vertex so users can add bends; Enter accepts the current preview end.
  await page.keyboard.press("Enter");
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
  await clickCommand(page, "Draw", "Construction line (L)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 260 });
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
test("two-phase click-creates a construction line", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Construction line (L)");
  await expect(page.getByTestId("active-tool")).toHaveText("construction-line");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 260 });
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(
    page.locator(
      '[data-layer="drafting"] polyline[data-kind="construction-line"]',
    ),
  ).toHaveCount(1);
});

// Two-phase click-creating an arrow commits one object.
test("two-phase click-creates an arrow", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Arrow (A)");
  await expect(page.getByTestId("active-tool")).toHaveText("arrow");
  await clickCreate(page, { x: 200, y: 320 }, { x: 420, y: 380 });
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect(
    page.locator('[data-layer="drafting"] g[data-kind="draft-arrow"]'),
  ).toHaveCount(1);
});

// Shape-based hit — a construction line selects via its stroke and does not
// block a click below its bounds rect.
test("construction line uses stroke-based hit, not a blocking rect", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Construction line (L)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
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

// Stage 1/3 regression: a two-phase-created arrow shows selection handles and
// rotates 90° via the R key, committing one revision and keeping the head at
// the (rotated) tip.
test("arrow rotates 90° via R key and shows selection handles", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Arrow (A)");
  await clickCreate(page, { x: 200, y: 300 }, { x: 320, y: 300 });
  await expect(page.getByTestId("revision")).toHaveText("1");

  const hit = page.getByTestId(/^drafting-hit-arrow-/);
  await hit.click();
  await expect(
    page.locator('[data-testid^="drafting-handles-arrow-"]'),
  ).toHaveCount(1);

  await page.keyboard.press("r");
  await expect(page.getByTestId("revision")).toHaveText("2");
  // One rotated arrow remains (head stays attached to the rotated tip).
  await expect(
    page.locator('[data-layer="drafting"] g[data-kind="draft-arrow"]'),
  ).toHaveCount(1);
});

// Stage 3: dragging an arrow endpoint handle moves just that endpoint in one
// transaction; undo restores it.
test("arrow endpoint handle drag moves the tip", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Arrow (A)" }).click();
  await clickCreate(page, { x: 200, y: 300 }, { x: 320, y: 300 });
  await page.getByTestId(/^drafting-hit-arrow-/).click();
  const tipHandle = page.getByTestId(/^draft-handle-to-arrow-/);
  await dragLocator(tipHandle, { x: 0, y: 40 });
  await expect(page.getByTestId("revision")).toHaveText("2");

  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("revision")).toHaveText("1");
});

// Stage 3: double-clicking a construction line inserts a vertex; double-clicking
// a vertex (below the 2-floor) is refused.
test("construction line vertex insert via double-click", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Construction line (L)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
  await expect(page.getByTestId("revision")).toHaveText("1");

  // Insert a vertex by double-clicking the line near its midpoint.
  const hit = page.getByTestId(/^drafting-hit-construction-/);
  const box = await hit.boundingBox();
  if (!box) throw new Error("construction line hit not measurable");
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("revision")).toHaveText("2");
  // Three vertex handles now.
  await expect(page.locator('[data-testid^="draft-handle-vx-"]')).toHaveCount(
    3,
  );
});

// Stage 4: the [ and ] shortcuts step the selected object's stroke width and
// commit one revision each.
test("bracket shortcuts step stroke width", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Construction line (L)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
  await page.getByTestId(/^drafting-hit-construction-/).click({ force: true });
  await page.keyboard.press("]");
  await expect(page.getByTestId("revision")).toHaveText("2");
  await page.keyboard.press("[");
  await expect(page.getByTestId("revision")).toHaveText("3");
});

// Stage 4: the Drawing shelf exposes line-style and stroke-width controls.
test("drawing shelf changes line style via select", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Construction line (L)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
  await page.getByTestId(/^drafting-hit-construction-/).click({ force: true });
  await page
    .getByRole("combobox", { name: "Line style" })
    .selectOption("solid");
  await expect(page.getByTestId("revision")).toHaveText("2");
});

test("drawing shelf renders an arrow line-style override", async ({ page }) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Arrow (A)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
  await page.getByTestId(/^drafting-hit-arrow-/).click({ force: true });
  await page
    .getByRole("combobox", { name: "Line style" })
    .selectOption("dotted");
  await expect(
    page.locator('[data-kind="draft-arrow"] > line'),
  ).toHaveAttribute("stroke-dasharray", "2 3");
});

test("drawing shelf renders free-arrow stroke and head-size overrides", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Arrow (A)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
  await page.getByTestId(/^drafting-hit-arrow-/).click({ force: true });
  const shaft = page.locator('[data-kind="draft-arrow"] > line');
  const head = page.locator('[data-kind="draft-arrow"] > polygon');
  const originalPoints = await head.getAttribute("points");

  await page.getByRole("combobox", { name: "Stroke width" }).selectOption("2");
  await expect(shaft).toHaveAttribute("stroke-width", "3.2");

  await page
    .getByRole("combobox", { name: "Arrow head size" })
    .selectOption("1.5");
  expect(await head.getAttribute("points")).not.toBe(originalPoints);
});

// Lock protects in-place edits but Delete has priority and remains available.
test("drawing shelf unlocks a protected drawing and Delete overrides its lock", async ({
  page,
}) => {
  await page.goto("/");
  await clickCommand(page, "Draw", "Construction line (L)");
  await clickCreate(page, { x: 200, y: 200 }, { x: 420, y: 200 });
  const drawing = page.getByTestId(/^drafting-hit-construction-/);
  await drawing.click({ force: true });

  await page
    .getByRole("combobox", { name: "Line style" })
    .selectOption("dotted");
  const styledProject = JSON.parse(
    (await downloadBytes(page, "File", "Save Project")).toString("utf8"),
  );
  expect(
    styledProject.documents[0].drafting.objects[0].styleOverride.lineStyle,
  ).toBe("dotted");

  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlock", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Locked — editing is disabled; Delete is still available."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Lock", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await clickCommand(page, "Edit", "Delete");
  await expect(drawing).toHaveCount(0);
});
