import { expect, test } from "@playwright/test";

import { chooseComponent, clickCommand } from "./editor-fixtures.js";

test("edits compatible selected instances through the explicit Instance Table", async ({
  page,
}) => {
  await page.goto("/");
  await chooseComponent(page, "nmos");
  const canvas = page.getByTestId("schematic-canvas");
  await canvas.click({ position: { x: 220, y: 180 } });
  await page.keyboard.press("Escape");
  await chooseComponent(page, "nmos");
  await canvas.click({ position: { x: 380, y: 180 } });
  await page.keyboard.press("Escape");

  await clickCommand(page, "Netlist", "Instance Table…");
  const table = page.getByRole("dialog", { name: "Instance Table" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("button", { name: "M1" })).toBeVisible();
  await expect(table.getByRole("button", { name: "M2" })).toBeVisible();
  await table.getByRole("button", { name: "Select visible" }).click();
  await table.getByLabel("Parameter name").fill("l");
  await table.getByLabel("Batch value").fill("120n");
  await expect(table.getByText("2 ready", { exact: false })).toBeVisible();
  await table.getByRole("button", { name: "Apply to 2" }).click();
  await expect(table.getByText("l=120n", { exact: false })).toHaveCount(2);
});
