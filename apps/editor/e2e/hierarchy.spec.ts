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

test("places an existing Cell and blocks deleting its shared definition", async ({
  page,
}) => {
  await page.goto("/");
  page.once("dialog", (dialog) => dialog.accept("ReusableStage"));
  await page.getByRole("button", { name: "New Cell" }).click();
  await page.getByRole("button", { name: "Top" }).click();

  page.once("dialog", (dialog) => dialog.accept("ReusableStage"));
  await page.getByRole("button", { name: "Place Cell" }).click();
  await expect(page.getByTestId("active-instance-count")).toHaveText("1");
  await expect(page.getByTestId("status")).toContainText(
    "Placed ReusableStage as X1",
  );

  await page.getByTestId("document-selector").selectOption({
    label: "ReusableStage",
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete Cell" }).click();
  await expect(page.getByTestId("document-count")).toHaveText("2");
  await expect(page.getByTestId("status")).toContainText("still referenced");
});
