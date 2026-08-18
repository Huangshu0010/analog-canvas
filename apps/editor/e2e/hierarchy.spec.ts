import { expect, test } from "@playwright/test";

import { emulateDownloadOnlyBrowser } from "./editor-fixtures.js";

test.beforeEach(async ({ page }) => {
  await emulateDownloadOnlyBrowser(page);
});

async function runCellCommand(
  page: import("@playwright/test").Page,
  name: "Manage Cells…" | "Place Cell" | "Edit Interface…",
): Promise<void> {
  const menu = page.getByTestId("cell-command-menu");
  await menu.locator("summary").click();
  await menu.getByRole("button", { name, exact: true }).click();
}

async function createCell(
  page: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  await runCellCommand(page, "Manage Cells…");
  const manager = page.getByRole("dialog", { name: "Cell Manager" });
  page.once("dialog", (dialog) => dialog.accept(name));
  await manager.getByRole("button", { name: "New Cell" }).click();
}

test("overlays an adaptive Cell menu without growing the hierarchy row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 700 });
  await page.goto("/");
  const toolbar = page.locator('.toolbar-row[aria-label="Document hierarchy"]');
  const menu = page.getByTestId("cell-command-menu");
  const heightBefore = await toolbar.evaluate(
    (element) => element.getBoundingClientRect().height,
  );

  await menu.locator("summary").click();

  const heightAfter = await toolbar.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const overlay = await menu.locator(".command-popover").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      position: getComputedStyle(element).position,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
    };
  });
  expect(heightAfter).toBe(heightBefore);
  expect(overlay.position).toBe("absolute");
  expect(overlay.left).toBeGreaterThanOrEqual(0);
  expect(overlay.right).toBeLessThanOrEqual(overlay.viewportWidth);
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
  page.once("dialog", (dialog) => dialog.accept());
  await manager.getByRole("button", { name: "Delete" }).last().click();
  await expect(page.getByTestId("document-count")).toHaveText("1");
  await expect(page.getByTestId("active-document-id")).toHaveText(
    "document-main",
  );
  await expect(page.getByTestId("status")).toContainText(
    "Deleted Cell ReusableStage",
  );
});

test("manages Cell rename and lists callers", async ({ page }) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");
  await page.getByRole("button", { name: "Top" }).click();
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
  page.once("dialog", (dialog) => dialog.accept("Stage"));
  await manager.getByRole("button", { name: "Rename" }).last().click();
  await expect(manager).toContainText("Stage");
  await manager.getByRole("button", { name: "Jump to caller" }).click();
  await expect(page.getByTestId("active-document-id")).toHaveText(
    "document-main",
  );
});

test("declares and places a Cell Port on a new local Net", async ({ page }) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");

  await runCellCommand(page, "Edit Interface…");
  const cellInterface = page.getByRole("dialog", {
    name: /Cell Interface/u,
  });
  await cellInterface.getByRole("button", { name: "Add Port" }).click();
  const portDialog = page.getByRole("dialog", { name: "Add Cell Port" });
  await portDialog.getByLabel("Port name").fill("IN");
  await portDialog.getByLabel("Cell Port direction").selectOption("input");
  await portDialog.getByRole("button", { name: "Place" }).click();

  const canvas = page.getByTestId("schematic-canvas");
  await canvas.click({ position: { x: 300, y: 180 } });
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
  await expect(page.getByTestId("status")).toContainText("Added Cell port IN");

  await runCellCommand(page, "Edit Interface…");
  await cellInterface.getByLabel("IN direction").selectOption("output");
  await expect(page.getByTestId("status")).toContainText(
    "Updated Cell port direction",
  );
  await cellInterface.getByLabel("IN side").selectOption("north");
  await cellInterface.getByLabel("IN offset").fill("20");
  await cellInterface.getByLabel("IN offset").press("Tab");
  await expect(page.getByTestId("status")).toContainText(
    "Updated Cell port presentation",
  );

  await cellInterface.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Top" }).click();
  await runCellCommand(page, "Edit Interface…");
  await expect(cellInterface).toBeVisible();
  await cellInterface.getByRole("button", { name: "Close" }).click();
  await runCellCommand(page, "Place Cell");
  const insertDialog = page.getByRole("dialog", { name: "Insert Component" });
  await insertDialog.getByRole("option", { name: /ReusableStage/u }).click();
  await insertDialog.getByRole("button", { name: "Apply" }).click();
  await canvas.click({ position: { x: 420, y: 180 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
});

test("places an existing Cell and blocks deleting its shared definition", async ({
  page,
}) => {
  await page.goto("/");
  await createCell(page, "ReusableStage");
  await page.getByRole("button", { name: "Top" }).click();

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
