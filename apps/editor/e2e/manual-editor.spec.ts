import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { resolve } from "node:path";

async function dragInstance(
  page: Page,
  instanceId: string,
  x: number,
  y: number,
): Promise<void> {
  await page
    .getByTestId(`unplaced-${instanceId}`)
    .dragTo(page.getByTestId("schematic-canvas"), {
      targetPosition: { x, y },
    });
  await expect(page.getByTestId(`hit-${instanceId}`)).toBeVisible();
}

test("manual place, transform, history, save, reopen, and export closure", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Interactive Circuit Maker" }),
  ).toBeVisible();
  await expect(page.getByTestId("revision")).toHaveText("0");

  await dragInstance(page, "M1", 320, 180);
  await expect(page.getByTestId("revision")).toHaveText("1");
  await dragInstance(page, "M2", 520, 180);
  await expect(page.getByTestId("revision")).toHaveText("2");
  await dragInstance(page, "R1", 420, 360);
  await expect(page.getByTestId("revision")).toHaveText("3");
  await expect(page.getByText("All instances placed")).toBeVisible();

  await page.getByTestId("hit-R1").click();
  await page.getByRole("button", { name: "Rotate" }).click();
  await page.getByRole("button", { name: "Mirror" }).click();
  await expect(page.getByTestId("revision")).toHaveText("5");

  const hit = page.getByTestId("hit-M1");
  const canvas = page.getByTestId("schematic-canvas");
  const hitBox = await hit.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!hitBox || !canvasBox) {
    throw new Error("Editor geometry is not measurable");
  }
  await page.mouse.move(
    hitBox.x + hitBox.width / 2,
    hitBox.y + hitBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 650, canvasBox.y + 300, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("revision")).toHaveText("6");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("revision")).toHaveText("7");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByTestId("revision")).toHaveText("8");

  await page.getByRole("button", { name: "Save snapshot" }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("icm.phase1.snapshot"),
  );
  expect(saved).not.toBeNull();
  expect(saved).not.toMatch(/selection|viewport|dragPreview|editor-overlay/u);

  const movedHitBox = await page.getByTestId("hit-M1").boundingBox();
  if (!movedHitBox) {
    throw new Error("Moved instance is not measurable");
  }
  await page.mouse.move(
    movedHitBox.x + movedHitBox.width / 2,
    movedHitBox.y + movedHitBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 720, canvasBox.y + 380, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("revision")).toHaveText("9");

  await page.getByRole("button", { name: "Reopen snapshot" }).click();
  await expect(page.getByTestId("revision")).toHaveText("8");
  await expect(page.getByTestId("status")).toHaveText("Reopened revision 8");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const svg = Buffer.concat(chunks).toString("utf8");
  expect(svg).toContain('data-layer="formal"');
  expect(svg).not.toMatch(/selection|hit-target|editor-overlay/u);
});

test("imports a selected SPICE source set into unplaced Documents", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("spice-files")
    .setInputFiles([
      resolve(process.cwd(), "netlists/mixed-device-acceptance/circuit.spi"),
      resolve(process.cwd(), "netlists/mixed-device-acceptance/models.inc"),
    ]);

  await expect(page.getByTestId("status")).toHaveText(
    "Imported 8 Documents and 32 instances; 23 generic symbols",
  );
  await expect(
    page.getByText("mixed_device_acceptance (SPICE Import)"),
  ).toBeVisible();
  await expect(page.getByTestId("document-count")).toHaveText("8");
  await expect(page.getByTestId("instance-count")).toHaveText("32");
  await expect(page.getByTestId("revision")).toHaveText("0");
  await expect(page.getByTestId("unplaced-XFILTER")).toBeVisible();
  await expect(page.getByTestId("unplaced-XCONTROL")).toBeVisible();

  await page.getByRole("button", { name: "Save snapshot" }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("icm.phase1.snapshot"),
  );
  const project = JSON.parse(saved!);
  expect(project.documents).toHaveLength(8);
  expect(
    project.source.files.map((file: { path: string }) => file.path),
  ).toEqual(["circuit.spi", "models.inc"]);
  expect(saved).not.toMatch(
    /rawText|logicalLines|syntaxFiles|unresolvedStatements|diagnostics/u,
  );
});
