import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createEmptyProject } from "@icm/model";
import { serializeProject } from "@icm/project-protocol";

const ENTRY = {
  id: "g-ring",
  name: "Ring Oscillator",
  author: "tz",
  description: "Three-stage loop",
  createdAt: "2026-08-21T10:00:00.000Z",
  schemaVersion: 21,
};

async function mockGallery(page: Page, entries: object[]): Promise<void> {
  await page.route("**/api/gallery", (route) =>
    route.fulfill({ json: { entries, nextCursor: null } }),
  );
  await page.route(`**/api/gallery/${ENTRY.id}/preview.svg`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/></svg>',
    }),
  );
  await page.route(`**/api/gallery/${ENTRY.id}`, (route) =>
    route.fulfill({
      json: {
        entry: ENTRY,
        projectText: serializeProject(
          createEmptyProject("gallery-ring", ENTRY.name),
        ),
      },
    }),
  );
}

test("the site lands on the full-screen gallery feed", async ({ page }) => {
  await mockGallery(page, [ENTRY]);
  await page.goto("/");
  const feed = page.getByTestId("gallery-feed");
  await expect(feed).toBeVisible();

  // With community entries present the wall shows them alone: the bundled
  // starter tiles exist only while the gallery is empty.
  await expect(page.getByTestId(`gallery-tile-${ENTRY.id}`)).toBeVisible();
  await expect(
    page.getByTestId("gallery-bundled-common-source-amplifier"),
  ).toHaveCount(0);
  await expect(page.getByTestId("gallery-new-circuit")).toHaveAttribute(
    "href",
    "/editor",
  );
});

test("falls back to bundled tiles when the gallery is empty or unreachable", async ({
  page,
}) => {
  await page.route("**/api/gallery", (route) =>
    route.fulfill({ status: 502, json: { error: "unavailable" } }),
  );
  await page.goto("/");
  await expect(
    page.getByTestId("gallery-bundled-two-stage-op-amp"),
  ).toBeVisible();
});

test("a gallery tile opens its circuit in the editor", async ({ page }) => {
  await mockGallery(page, [ENTRY]);
  await page.goto("/");
  await page.getByTestId(`gallery-tile-${ENTRY.id}`).click();
  await expect(page).toHaveURL(/\/g\/g-ring$/);
  await expect(page.getByTestId("status")).toContainText(
    `Opened gallery circuit: ${ENTRY.name}`,
  );
  await expect(page.locator(".app-brand-copy p")).toContainText(ENTRY.name);

  // The brand mark links back to the gallery landing page.
  await expect(
    page.getByRole("link", { name: "Back to the gallery" }),
  ).toHaveAttribute("href", "/");
});

test("bundled starter tiles open their example in the editor", async ({
  page,
}) => {
  await mockGallery(page, []);
  await page.goto("/");
  await page.getByTestId("gallery-bundled-common-source-amplifier").click();
  await expect(page).toHaveURL(/\/editor\?example=common-source-amplifier$/);
  await expect(page.getByTestId("status")).toContainText(
    "Opened example: Common-Source Amplifier",
  );
});
