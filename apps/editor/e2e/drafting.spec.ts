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

// WP-R6 scenario A: add drafting text with rich markup, verify selection and
// the canonical AST, then undo/redo.
test("adds drafting text with rich markup and undo/redo restores it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revision")).toHaveText("0");

  await clickCommand(page, "More", "Add text");
  // addPlainText selects the new drafting object and opens the text panel.
  const draftInput = page.getByRole("textbox", {
    name: "Drafting text content",
  });
  await expect(draftInput).toBeVisible();
  await draftInput.fill("V_{in}^{+} = \\frac{V_{DD}}{2}");
  await page.getByRole("button", { name: "Apply text" }).click();

  // The drafting layer renders the parsed AST as tspans; the visible text
  // flattens subscripts/superscripts/fractions to their letters.
  await expect(page.locator('[data-layer="drafting"]')).toContainText(
    "Vin+ = VDD2",
  );
  // revision 1 = Add text, revision 2 = Apply text.
  await expect(page.getByTestId("revision")).toHaveText("2");

  // The canonical AST is persisted (fraction + sub/superscript).
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

  // Undo reverts Apply text (object still exists); a second Undo removes the
  // created object; redo restores both. Each edit/undo/redo advances the
  // revision monotonically (Edit Engine invariant).
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
  await clickCommand(page, "More", "Add construction line");
  await expect(page.getByTestId("revision")).toHaveText("1");
  await clickCommand(page, "More", "Add vertical guide");
  await expect(page.getByTestId("revision")).toHaveText("2");
  // A guide overlay is visible in the editor.
  await expect(page.locator('[data-testid^="guide-"]')).toHaveCount(1);

  const svg = (await downloadBytes(page, "Export", "Export SVG")).toString(
    "utf8",
  );
  expect(svg).toContain('data-kind="construction-line"');
  // Guides are editor-only: they never enter formal export.
  expect(svg).not.toContain('data-kind="guide"');
  expect(svg).not.toContain("guide-2");
});

// WP-R6 scenario F: the built editor mounts without console errors.
test("production build mounts without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/");
  await expect(page.getByTestId("schematic-canvas")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
