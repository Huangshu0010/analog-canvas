import { expect, test } from "@playwright/test";

import { chooseComponent } from "./editor-fixtures.js";

test("inserts from the master-detail dialog with keyboard and live placement preview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("canvas-empty-state")).toBeVisible();

  await page.keyboard.press("i");
  const dialog = page.getByRole("dialog", { name: "Insert Component" });
  const search = dialog.getByRole("combobox");
  await expect(search).toBeFocused();
  await search.fill("not-a-real-component");
  await expect(dialog.getByRole("button", { name: "Apply" })).toBeDisabled();
  await search.fill("mos");
  const before = await search.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  expect(await search.getAttribute("aria-activedescendant")).not.toBe(before);

  await search.fill("resistor");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);

  const canvas = page.getByTestId("schematic-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas is not measurable");
  await page.mouse.move(box.x + 360, box.y + 230);
  const preview = page.getByTestId("component-placement-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("transform", /rotate\(0\)/u);

  await page.keyboard.press("r");
  await expect(preview).toHaveAttribute("transform", /rotate\(90\)/u);
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(page.getByTestId("revision")).toHaveText("0");

  await chooseComponent(page, "resistor");
  await canvas.click({ position: { x: 360, y: 230 } });
  await expect(page.getByTestId("hit-R1")).toBeVisible();
  await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  await page.getByTestId("selection-shelf").click();
  await expect(page.locator(".selection-overview")).toContainText(
    "ComponentR1Symbolresistor",
  );
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("icm.recent-components.v1")),
    )
    .toContain("resistor");

  await page.keyboard.press("i");
  const reopened = page.getByRole("dialog", { name: "Insert Component" });
  const passives = reopened
    .locator(".insert-option-group")
    .filter({ hasText: "Passives" });
  await expect(passives.locator("button").first()).toHaveAttribute(
    "data-testid",
    "insert-component-resistor",
  );
});

test("keeps the workspace inside the viewport and exposes low-interference zoom controls", async ({
  page,
}) => {
  await page.goto("/");

  expect(
    await page.evaluate(() => ({
      horizontal:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      vertical:
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight,
    })),
  ).toEqual({ horizontal: false, vertical: false });

  const zoom = page.getByRole("status", { name: "Current zoom" });
  await expect(zoom).toHaveText("100%");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(zoom).not.toHaveText("100%");
  await page.getByRole("button", { name: "Fit view" }).click();

  const canvasBefore = await page.getByTestId("schematic-canvas").boundingBox();
  await page.getByTestId("selection-shelf").click();
  const canvasAfter = await page.getByTestId("schematic-canvas").boundingBox();
  expect(canvasAfter?.width).toBe(canvasBefore?.width);
});
