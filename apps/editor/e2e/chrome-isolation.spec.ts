import { expect, test } from "@playwright/test";

test("keeps editor chrome typography from suppressing SVG italics", async ({
  page,
}) => {
  await page.goto("/");

  const library = page.getByRole("complementary", {
    name: "Symbols and drawing tools",
  });
  const resistor = library.getByTestId("library-component-resistor");
  if (!(await resistor.isVisible())) {
    await library.getByRole("button", { name: "Expand" }).click();
  }
  await resistor.click();
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 320, y: 220 } });

  const italicRun = page
    .getByTestId("schematic-canvas")
    .locator('[data-text-run="base"][style*="font-style:italic"]')
    .first();
  await expect(italicRun).toBeVisible();
  await expect(italicRun).toHaveCSS("font-style", "italic");
  expect(
    await italicRun.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("font-synthesis"),
    ),
  ).not.toBe("none");
});
