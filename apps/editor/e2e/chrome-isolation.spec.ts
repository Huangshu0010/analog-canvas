import { expect, test } from "@playwright/test";

import { chooseComponent } from "./editor-fixtures.js";

test("keeps editor chrome typography from suppressing SVG italics", async ({
  page,
}) => {
  await page.goto("/");

  await chooseComponent(page, "resistor");
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 320, y: 220 } });

  const italicRun = page
    .getByTestId("schematic-canvas")
    .locator('[data-text-run="span"][style*="font-style:italic"]')
    .first();
  await expect(italicRun).toBeVisible();
  await expect(italicRun).toHaveCSS("font-style", "italic");
  expect(
    await italicRun.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("font-synthesis"),
    ),
  ).not.toBe("none");
});

test("dismisses Help with Escape or a backdrop pointer", async ({ page }) => {
  await page.goto("/");
  const help = page.getByRole("dialog", { name: "Help" });

  await page.getByRole("button", { name: "Help" }).click();
  await expect(help).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);

  await page.getByRole("button", { name: "Help" }).click();
  await expect(help).toBeVisible();
  await page.locator(".help-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(help).toHaveCount(0);
});
