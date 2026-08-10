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

test("keeps insert actions and preview fixed while the catalog scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.goto("/");
  await page.keyboard.press("i");

  const dialog = page.getByRole("dialog", { name: "Insert Component" });
  const options = dialog.locator(".insert-component-options");
  const artwork = dialog.locator(".insert-symbol-artwork");
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const apply = dialog.getByRole("button", { name: "Apply" });

  const measure = () =>
    dialog.evaluate((element) => {
      const bounds = (target: Element) => {
        const rect = target.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const list = element.querySelector(".insert-component-options")!;
      const preview = element.querySelector(".insert-component-preview")!;
      const artwork = element.querySelector(".insert-symbol-artwork")!;
      const footer = element.querySelector(".insert-dialog-actions")!;
      return {
        dialog: bounds(element),
        list: {
          ...bounds(list),
          clientHeight: list.clientHeight,
          scrollHeight: list.scrollHeight,
          overflowY: getComputedStyle(list).overflowY,
        },
        preview: bounds(preview),
        artwork: bounds(artwork),
        footer: bounds(footer),
      };
    });

  const before = await measure();
  await expect(cancel).toBeVisible();
  await expect(apply).toBeVisible();
  expect(before.footer.bottom).toBeLessThanOrEqual(before.dialog.bottom);
  expect(before.list.overflowY).toBe("auto");
  expect(before.list.scrollHeight).toBeGreaterThan(before.list.clientHeight);

  await dialog.getByTestId("insert-component-inductor").click();
  const after = await measure();
  expect(after.dialog.height).toBeCloseTo(before.dialog.height, 0);
  expect(after.list.height).toBeCloseTo(before.list.height, 0);
  expect(after.preview.width).toBeCloseTo(before.preview.width, 0);
  expect(after.preview.height).toBeCloseTo(before.preview.height, 0);
  expect(after.artwork.width).toBeCloseTo(before.artwork.width, 0);
  expect(after.artwork.height).toBeCloseTo(before.artwork.height, 0);
  expect(after.footer.top).toBeCloseTo(before.footer.top, 0);
  expect(after.footer.bottom).toBeLessThanOrEqual(after.dialog.bottom);
});
