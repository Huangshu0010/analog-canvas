import { expect, test } from "@playwright/test";

import { emulateDownloadOnlyBrowser } from "./editor-fixtures.js";

test.beforeEach(async ({ page }) => {
  await emulateDownloadOnlyBrowser(page);
});

test("creates and deletes an unreferenced reusable Cell", async ({ page }) => {
  await page.goto("/");
  page.once("dialog", (dialog) => dialog.accept("ReusableStage"));
  await page.getByRole("button", { name: "New Cell" }).click();

  await expect(page.getByTestId("document-count")).toHaveText("2");
  await expect(page.getByTestId("document-selector")).toHaveValue(/document-/u);
  await expect(page.getByTestId("status")).toContainText(
    "Created Cell ReusableStage",
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Cell" }).click();
  await expect(page.getByTestId("document-count")).toHaveText("1");
  await expect(page.getByTestId("active-document-id")).toHaveText(
    "document-main",
  );
  await expect(page.getByTestId("status")).toContainText(
    "Deleted Cell ReusableStage",
  );
});

test("declares and places a Cell Port on a new local Net", async ({ page }) => {
  await page.goto("/");
  page.once("dialog", (dialog) => dialog.accept("ReusableStage"));
  await page.getByRole("button", { name: "New Cell" }).click();

  await page.getByRole("button", { name: "Add Cell Port" }).click();
  const portDialog = page.getByRole("dialog", { name: "Add Cell Port" });
  await portDialog.getByLabel("Port name").fill("IN");
  await portDialog.getByLabel("Cell Port direction").selectOption("input");
  await portDialog.getByRole("button", { name: "Place" }).click();

  const canvas = page.getByTestId("schematic-canvas");
  await canvas.click({ position: { x: 300, y: 180 } });
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
  await expect(page.getByTestId("status")).toContainText("Added Cell port IN");

  const cellInterface = page.getByLabel("Cell Interface");
  await cellInterface.locator("summary").click();
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

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Top" }).click();
  await page.getByRole("button", { name: "Place Cell" }).click();
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
  page.once("dialog", (dialog) => dialog.accept("ReusableStage"));
  await page.getByRole("button", { name: "New Cell" }).click();
  await page.getByRole("button", { name: "Top" }).click();

  await page.getByRole("button", { name: "Place Cell" }).click();
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
  await canvas.click({ position: { x: 360, y: 230 } });
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
  await expect(page.getByTestId("status")).toContainText(
    "Placed ReusableStage as X1",
  );
  await page.keyboard.press("Escape");

  await page.getByTestId("document-selector").selectOption({
    label: "ReusableStage",
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Cell" }).click();
  await expect(page.getByTestId("document-count")).toHaveText("2");
  await expect(page.getByTestId("status")).toContainText("still referenced");
});
