import { expect, test } from "@playwright/test";

import { emulateDownloadOnlyBrowser } from "./editor-fixtures.js";

test.beforeEach(async ({ page }) => {
  await emulateDownloadOnlyBrowser(page);
});

async function runCellCommand(
  page: import("@playwright/test").Page,
  name: "Manage Cells…" | "Place Cell",
): Promise<void> {
  await page
    .getByTestId("cell-command-menu")
    .getByRole("button", { name, exact: true })
    .click();
}

async function createCell(
  page: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  await runCellCommand(page, "Manage Cells…");
  const manager = page.getByRole("dialog", { name: "Cell Manager" });
  await manager.getByRole("button", { name: "New Cell" }).click();
  const editor = page.getByRole("dialog", { name: "New Cell" });
  await editor.getByLabel("Cell name").fill(name);
  await editor.getByRole("button", { name: "Create" }).click();
}

test("keeps direct Cell commands in one hierarchy row", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 700 });
  await page.goto("/");
  const toolbar = page.locator('.toolbar-row[aria-label="Document hierarchy"]');
  await expect(
    page.getByRole("button", { name: "Manage Cells…" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Place Cell" })).toBeVisible();
  expect(
    await toolbar.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThan(90);
});

test("creates and deletes an unreferenced reusable Cell", async ({ page }) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");

  await expect(page.getByTestId("document-count")).toHaveText("2");
  await expect(page.getByTestId("document-selector")).toHaveValue(/document-/u);
  await expect(page.getByTestId("status")).toContainText(
    "Created Cell ReusableStage",
  );

  await runCellCommand(page, "Manage Cells…");
  const manager = page.getByRole("dialog", { name: "Cell Manager" });
  await manager.getByRole("button", { name: "Delete" }).last().click();
  const confirm = page.getByRole("dialog", { name: "Delete Cell" });
  await confirm.getByRole("button", { name: "Delete Cell" }).click();
  await expect(page.getByTestId("document-count")).toHaveText("1");
  await expect(page.getByTestId("active-document-id")).toHaveText(
    "document-main",
  );
  await expect(page.getByTestId("status")).toContainText(
    "Deleted Cell ReusableStage",
  );
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("document-count")).toHaveText("2");
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByTestId("document-count")).toHaveText("1");
});

test("manages Cell rename and lists callers", async ({ page }) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");
  await page
    .getByTestId("cell-navigation")
    .getByRole("button", { name: "Top", exact: true })
    .click();
  await runCellCommand(page, "Place Cell");
  const insert = page.getByRole("dialog", { name: "Insert Component" });
  await insert.getByRole("option", { name: /ReusableStage/u }).click();
  await insert.getByRole("button", { name: "Apply" }).click();
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 320, y: 180 } });
  await page.keyboard.press("Escape");

  await runCellCommand(page, "Manage Cells…");
  const manager = page.getByRole("dialog", { name: "Cell Manager" });
  await expect(manager).toContainText("1 callers");
  await manager.getByRole("button", { name: "Rename" }).last().click();
  const rename = page.getByRole("dialog", { name: "Rename Cell" });
  await rename.getByLabel("Cell name").fill("Stage");
  await rename.getByRole("button", { name: "Rename" }).click();
  await expect(manager).toContainText("Stage");
  await manager.getByRole("button", { name: "Jump to caller" }).click();
  await expect(page.getByTestId("active-document-id")).toHaveText(
    "document-main",
  );
});

test("declares and places a Cell Port on a new local Net", async ({ page }) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");

  const canvas = page.getByTestId("schematic-canvas");
  await page.getByTestId("shapes-chip-port").click();
  await canvas.click({ position: { x: 300, y: 180 } });
  await expect(page.getByTestId("status")).toContainText("Added Cell port P1");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");

  await page.getByTestId("selection-shelf").click();
  const portProperties = page.getByLabel("Cell Port properties");
  await expect(portProperties).toBeVisible();
  await expect(portProperties.getByLabel("Port name")).toHaveCount(0);
  await page.getByTestId("annotation-hit-instance-label-P1").dblclick();
  const nameEditor = page.getByRole("textbox", { name: "Canvas text editor" });
  await nameEditor.fill("IN");
  await page.getByRole("button", { name: "Apply text changes" }).click();
  await expect(page.getByTestId("status")).toContainText(
    "Renamed formal port to IN",
  );
  await page.getByTestId("hit-P1").click();
  const shelf = page.getByTestId("selection-shelf");
  if ((await shelf.getAttribute("aria-expanded")) === "false") {
    await shelf.click();
  }
  const renamedPortProperties = page.getByLabel("Cell Port properties");
  await renamedPortProperties
    .getByLabel("Cell Port direction")
    .selectOption("input");
  await expect(page.getByTestId("status")).toContainText(
    "Updated Cell port direction",
  );

  await page
    .getByTestId("cell-navigation")
    .getByRole("button", { name: "Top", exact: true })
    .click();
  await page
    .getByTestId("cell-command-menu")
    .getByRole("button", { name: "Place Cell" })
    .click();
  const insertDialog = page.getByRole("dialog", { name: "Insert Component" });
  await insertDialog.getByRole("option", { name: /ReusableStage/u }).click();
  await insertDialog.getByRole("button", { name: "Apply" }).click();
  await canvas.click({ position: { x: 420, y: 180 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
  await expect(canvas.locator('[data-pin-name="IN"]')).toHaveCount(1);

  await page.getByTestId("hit-X1").click();
  const layoutShelf = page.getByTestId("selection-shelf");
  if ((await layoutShelf.getAttribute("aria-expanded")) === "false") {
    await layoutShelf.click();
  }
  const layout = page.getByLabel("Cell symbol layout");
  await expect(layout).toBeVisible();
  await layout.getByLabel("Cell symbol width").fill("120");
  await layout.getByLabel("Cell symbol width").press("Tab");
  await expect(page.getByTestId("status")).toContainText(
    "Resized ReusableStage",
  );
  await layout.getByLabel("Cell symbol IN pin side").selectOption("north");
  await expect(page.getByTestId("status")).toContainText(
    "Moved Cell symbol pin",
  );
  await layout
    .getByRole("button", { name: "Edit symbol layout on canvas" })
    .click();
  const layoutOverlay = page.getByTestId("cell-symbol-layout-overlay");
  await expect(layoutOverlay).toBeVisible();
  const bodyHandle = page.getByTestId("cell-symbol-body-handle");
  const bodyHandleBox = await bodyHandle.boundingBox();
  expect(bodyHandleBox).not.toBeNull();
  if (bodyHandleBox) {
    await page.mouse.move(
      bodyHandleBox.x + bodyHandleBox.width / 2,
      bodyHandleBox.y + bodyHandleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bodyHandleBox.x + bodyHandleBox.width / 2 + 30,
      bodyHandleBox.y + bodyHandleBox.height / 2 + 30,
    );
    await page.mouse.up();
  }
  await expect(page.getByTestId("status")).toContainText(
    /Resized ReusableStage|Committed revision/u,
  );
  const pinHandle = page.locator('[data-testid^="cell-symbol-pin-handle-"]');
  const pinHandleBox = await pinHandle.boundingBox();
  expect(pinHandleBox).not.toBeNull();
  if (pinHandleBox) {
    await page.mouse.move(
      pinHandleBox.x + pinHandleBox.width / 2,
      pinHandleBox.y + pinHandleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      pinHandleBox.x + pinHandleBox.width / 2 + 20,
      pinHandleBox.y + pinHandleBox.height / 2,
    );
    await page.mouse.up();
  }
  await expect(page.getByTestId("status")).toContainText(
    "Moved Cell symbol pin",
  );
});

test("deletes a wired child Cell Port through the ordinary instance path", async ({
  page,
}) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");
  const canvas = page.getByTestId("schematic-canvas");
  await page.getByTestId("shapes-chip-port").click();
  await canvas.click({ position: { x: 300, y: 180 } });
  await page.keyboard.press("Escape");
  await page.getByTestId("hit-P1").click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("hit-P1")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("hit-P1")).toHaveCount(1);
});

test("places an existing Cell and blocks deleting its shared definition", async ({
  page,
}) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");
  await page
    .getByTestId("cell-navigation")
    .getByRole("button", { name: "Top", exact: true })
    .click();

  await runCellCommand(page, "Place Cell");
  const dialog = page.getByRole("dialog", { name: "Insert Component" });
  await expect(dialog.getByText("Cells", { exact: true })).toBeVisible();
  await expect(dialog.getByTestId("insert-component-nmos")).toHaveCount(0);
  await dialog.getByRole("option", { name: /ReusableStage/u }).click();
  await dialog.getByRole("button", { name: "Apply" }).click();

  const canvas = page.getByTestId("schematic-canvas");
  await canvas.hover({ position: { x: 360, y: 230 } });
  const preview = page.getByTestId("component-placement-preview");
  await expect(preview).toBeVisible();
  await page.keyboard.press("r");
  await expect(preview).toHaveAttribute("transform", /rotate\(90\)/u);
  await page.keyboard.press("Shift+R");
  await expect(preview).toHaveAttribute("transform", /scale\(-1 1\)/u);
  await canvas.click({ position: { x: 360, y: 230 } });
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
  await expect(page.getByTestId("status")).toContainText(
    "Placed ReusableStage as X1",
  );
  await expect(canvas.locator('[data-kind="instance-value"]')).toContainText(
    "ReusableStage",
  );
  await expect(canvas.locator('[data-kind="instance-label"]')).toHaveCount(0);
  await page.keyboard.press("Escape");

  await runCellCommand(page, "Manage Cells…");
  const manager = page.getByRole("dialog", { name: "Cell Manager" });
  await expect(
    manager.getByRole("button", { name: "Delete" }).last(),
  ).toBeDisabled();
  await expect(page.getByTestId("document-count")).toHaveText("2");
});
