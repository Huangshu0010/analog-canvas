import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  chooseComponent,
  downloadBytes,
  emulateDownloadOnlyBrowser,
  openMenu,
  recoveryProjectTexts,
} from "./editor-fixtures.js";

test.beforeEach(async ({ page }) => {
  await emulateDownloadOnlyBrowser(page);
});

test("downloads the canonical Project when File System Access is unavailable", async ({
  page,
}) => {
  await page.goto("/");
  await chooseComponent(page, "resistor");
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 360, y: 230 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("revision")).toHaveText("1");

  const bytes = await downloadBytes(page, "File", "Save Project");
  const parsed = JSON.parse(bytes.toString("utf8")) as {
    schemaVersion: number;
  };
  expect(parsed.schemaVersion).toBe(14);
  await expect(page.getByTestId("status")).toContainText("Download requested");
  // A download never clears the browser recovery copies.
  await expect
    .poll(() => recoveryProjectTexts(page))
    .toContain('"revision": 1');
});

test("upgrades a schema-13 Project and saves it as schema 14", async ({
  page,
}) => {
  const source = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "fixtures/projects/minimal/project.icproj.json"),
      "utf8",
    ),
  ) as Record<string, unknown>;
  source.schemaVersion = 13;

  await page.goto("/");
  await page.getByTestId("project-file").setInputFiles({
    name: "minimal-v12.icproj.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(source)),
  });
  await expect(page.getByTestId("status")).toContainText(
    "upgraded minimal-v12.icproj.json from schema 13 to schema 14",
  );
  await expect
    .poll(() => recoveryProjectTexts(page))
    .toContain('"schemaVersion": 14');

  const saved = JSON.parse(
    (await downloadBytes(page, "File", "Save Project")).toString("utf8"),
  ) as { schemaVersion: number };
  expect(saved.schemaVersion).toBe(14);
});

test("reports a confirmed File System Access save", async ({ page }) => {
  await page.addInitScript(() => {
    const writes: Array<{ name: string; text: string }> = [];
    (window as unknown as { __fsaWrites: typeof writes }).__fsaWrites = writes;
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker =
      async () => ({
        name: "chosen.icproj.json",
        createWritable: async () => ({
          write: async (data: string) => {
            writes.push({ name: "chosen.icproj.json", text: data });
          },
          close: async () => undefined,
          abort: async () => undefined,
        }),
      });
  });
  await page.goto("/");
  const fileMenu = await openMenu(page, "File");
  await fileMenu.getByRole("button", { name: "Save Project" }).click();
  await expect(page.getByTestId("status")).toContainText(
    "Saved chosen.icproj.json (write confirmed)",
  );
  const write = await page.evaluate(
    () =>
      (window as unknown as { __fsaWrites: Array<{ text: string }> })
        .__fsaWrites[0] ?? null,
  );
  expect(write).not.toBeNull();
  expect(JSON.parse(write!.text).schemaVersion).toBe(14);
});

test("falls back to download when the save location is denied", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker =
      async () => {
        throw new DOMException("location denied", "NotAllowedError");
      };
  });
  await page.goto("/");
  const bytes = await downloadBytes(page, "File", "Save Project");
  expect(JSON.parse(bytes.toString("utf8")).schemaVersion).toBe(14);
  await expect(page.getByTestId("status")).toContainText("Download requested");
});

test("keeps the Project and recovery intact when the save stream fails", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker =
      async () => ({
        name: "doomed.icproj.json",
        createWritable: async () => ({
          write: async () => {
            throw new Error("simulated write failure");
          },
          close: async () => undefined,
          abort: async () => undefined,
        }),
      });
  });
  await page.goto("/");
  await chooseComponent(page, "resistor");
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 360, y: 230 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("revision")).toHaveText("1");

  const fileMenu = await openMenu(page, "File");
  await fileMenu.getByRole("button", { name: "Save Project" }).click();
  await expect(page.getByTestId("status")).toContainText(
    "Save failed at write",
  );
  // The failed save keeps the Project dirty and the recovery copy readable.
  await expect
    .poll(() => recoveryProjectTexts(page))
    .toContain('"revision": 1');
  await expect(page.getByTestId("revision")).toHaveText("1");
});

test("keeps the Project unchanged when an opened file is rejected", async ({
  page,
}) => {
  await page.goto("/");
  await chooseComponent(page, "resistor");
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 360, y: 230 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect
    .poll(() => recoveryProjectTexts(page))
    .toContain('"revision": 1');

  await page.getByTestId("project-file").setInputFiles({
    name: "broken.icproj.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ not valid json"),
  });
  await expect(page.getByTestId("status")).toContainText("INVALID_JSON");
  await expect(page.getByTestId("revision")).toHaveText("1");
  await expect
    .poll(() => recoveryProjectTexts(page))
    .toContain('"revision": 1');
});

test("protects dirty work before opening a replacement", async ({ page }) => {
  // Break the recovery store so a confirmed recovery write is impossible;
  // the guard dialog must then let the human decide.
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: false,
      get() {
        throw new DOMException("storage blocked", "InvalidStateError");
      },
    });
  });
  await page.goto("/");
  await chooseComponent(page, "resistor");
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 360, y: 230 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("revision")).toHaveText("1");

  await page
    .getByTestId("project-file")
    .setInputFiles(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-1-manual/project.icproj.json",
      ),
    );
  const dialog = page.getByRole("dialog", {
    name: "Protect the current Project",
  });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel (keep editing)" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("revision")).toHaveText("1");

  // Reset the input so re-selecting the same file still fires change.
  await page.getByTestId("project-file").evaluate((element) => {
    (element as HTMLInputElement).value = "";
  });
  await page
    .getByTestId("project-file")
    .setInputFiles(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-1-manual/project.icproj.json",
      ),
    );
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Replace anyway" }).click();
  await expect(page.getByTestId("active-document-name")).toHaveText(
    "Manual Editor Demo",
  );
  await expect(dialog).toBeHidden();
});

test("offers a download from the replacement guard", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: false,
      get() {
        throw new DOMException("storage blocked", "InvalidStateError");
      },
    });
  });
  await page.goto("/");
  await chooseComponent(page, "resistor");
  await page
    .getByTestId("schematic-canvas")
    .click({ position: { x: 360, y: 230 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("revision")).toHaveText("1");

  await page
    .getByTestId("project-file")
    .setInputFiles(
      resolve(
        process.cwd(),
        "fixtures/projects/phase-1-manual/project.icproj.json",
      ),
    );
  const dialog = page.getByRole("dialog", {
    name: "Protect the current Project",
  });
  await expect(dialog).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download current Project" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".icproj.json");
  // The dialog stays open so the user can still cancel or replace.
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel (keep editing)" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("revision")).toHaveText("1");
});
