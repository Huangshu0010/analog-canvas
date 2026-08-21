import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { createEmptyProject } from "@icm/model";
import { serializeProject } from "@icm/project-protocol";

import { clickCommand } from "./editor-fixtures.js";

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

  // The brand mark and the explicit toolbar button both lead back to the
  // gallery, and the product name is one name everywhere.
  await expect(
    page.getByRole("link", { name: "Back to the gallery", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(page.locator(".app-brand-copy h1")).toHaveText("Analog Canvas");
  const backLink = page.getByTestId("toolbar-gallery-link");
  await expect(backLink).toBeVisible();
  await backLink.click();
  await expect(page.getByTestId("gallery-feed")).toBeVisible();
});

test("the feed offers exactly the enabled sign-in providers and sends email links", async ({
  page,
}) => {
  await mockGallery(page, [ENTRY]);
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { github: true, google: false, email: true } }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: null } }),
  );
  const emailStarts: string[] = [];
  await page.route("**/api/auth/email/start", (route) => {
    emailStarts.push(String(route.request().postDataJSON().email));
    return route.fulfill({ status: 202, json: { sent: true } });
  });

  await page.goto("/");
  await page.getByTestId("account-signin").locator("summary").click();
  await expect(page.getByTestId("signin-github")).toHaveAttribute(
    "href",
    "/api/auth/github/start",
  );
  await expect(page.getByTestId("signin-google")).toHaveCount(0);
  await page.getByTestId("signin-email-input").fill("vivian@example.com");
  await page.getByTestId("signin-email-send").click();
  await expect(page.getByTestId("account-notice")).toHaveText(
    "Check your inbox for the link.",
  );
  expect(emailStarts).toEqual(["vivian@example.com"]);
});

test("a signed-in owner renames the display name and signs out", async ({
  page,
}) => {
  await mockGallery(page, [ENTRY]);
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({ json: { github: true, google: true, email: true } }),
  );
  const user = {
    id: "u1",
    displayName: "tz",
    email: "owner@example.com",
    provider: "github",
    isAdmin: true,
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user } }),
  );
  const renames: string[] = [];
  await page.route("**/api/auth/profile", (route) => {
    const displayName = String(route.request().postDataJSON().displayName);
    renames.push(displayName);
    return route.fulfill({ json: { user: { ...user, displayName } } });
  });
  let loggedOut = 0;
  await page.route("**/api/auth/logout", (route) => {
    loggedOut += 1;
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/");
  await expect(page.getByTestId("account-owner")).toHaveText("Owner");
  await page.getByTestId("account-name").click();
  await page.getByTestId("account-rename-input").fill("Token Zhang");
  await page.getByTestId("account-rename-input").press("Enter");
  await expect(page.getByTestId("account-name")).toHaveText("Token Zhang");
  expect(renames).toEqual(["Token Zhang"]);

  await page.getByTestId("account-signout").click();
  await expect(page.getByTestId("account-signin")).toBeVisible();
  expect(loggedOut).toBe(1);
});

test("File > Publish to Gallery posts the live Project with the passphrase", async ({
  page,
}) => {
  const posted: { authorization: string | null; body: string }[] = [];
  // The real submissions endpoint is /api/gallery/submissions — the mock
  // matches it exactly so a client posting anywhere else fails this test.
  await page.route("**/api/gallery", (route) =>
    route.fulfill({ json: { entries: [], nextCursor: null } }),
  );
  await page.route("**/api/gallery/submissions", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    posted.push({
      authorization: route.request().headers()["authorization"] ?? null,
      body: route.request().postData() ?? "",
    });
    return route.fulfill({ status: 201, json: { id: "entry-99" } });
  });

  await page.goto("/editor");
  await clickCommand(page, "File", "Publish to Gallery…");
  const dialog = page.getByTestId("publish-gallery-dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Circuit name").fill("Publish Demo");
  await dialog.getByLabel("Author").fill("Vivian");
  const publish = dialog.getByRole("button", { name: "Publish" });
  await expect(publish).toBeDisabled();
  await dialog.getByLabel("Owner passphrase").fill("secret-token");
  await publish.click();

  await expect(page.getByTestId("status")).toHaveText(
    'Published "Publish Demo" to the gallery',
  );
  expect(posted).toHaveLength(1);
  const request = posted[0]!;
  expect(request.authorization).toBe("Bearer secret-token");
  const body = JSON.parse(request.body) as {
    name: string;
    author: string;
    projectText: string;
  };
  expect(body.name).toBe("Publish Demo");
  expect(body.author).toBe("Vivian");
  expect(JSON.parse(body.projectText).schemaVersion).toBe(ENTRY.schemaVersion);

  // The passphrase is remembered for the session and offered on reopen.
  await clickCommand(page, "File", "Publish to Gallery…");
  await expect(
    page.getByTestId("publish-gallery-dialog").getByLabel("Owner passphrase"),
  ).toHaveValue("secret-token");
});

test("an admin session publishes without the passphrase row", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "u1",
          displayName: "Token Zhang",
          email: "owner@example.com",
          provider: "github",
          isAdmin: true,
        },
      },
    }),
  );
  const posted: { authorization: string | null; author: string }[] = [];
  await page.route("**/api/gallery/submissions", (route) => {
    const body = route.request().postDataJSON() as { author: string };
    posted.push({
      authorization: route.request().headers()["authorization"] ?? null,
      author: body.author,
    });
    return route.fulfill({ status: 201, json: { id: "entry-77" } });
  });

  await page.goto("/editor");
  await clickCommand(page, "File", "Publish to Gallery…");
  const dialog = page.getByTestId("publish-gallery-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Signed in as Token Zhang")).toBeVisible();
  await expect(dialog.getByLabel("Owner passphrase")).toHaveCount(0);
  // The account display name prefills the author byline.
  await expect(dialog.getByLabel("Author")).toHaveValue("Token Zhang");

  await dialog.getByLabel("Circuit name").fill("Session Publish");
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByTestId("status")).toHaveText(
    'Published "Session Publish" to the gallery',
  );
  expect(posted).toEqual([{ authorization: null, author: "Token Zhang" }]);
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
