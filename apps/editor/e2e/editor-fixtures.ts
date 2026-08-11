import type { Locator, Page } from "@playwright/test";

export async function openMenu(page: Page, name: string): Promise<Locator> {
  const summary = page.locator("summary", { hasText: name }).filter({
    hasText: new RegExp(`^${name}$`, "u"),
  });
  const details = summary.locator("..");
  if ((await details.getAttribute("open")) === null) await summary.click();
  return details;
}

export async function clickCommand(
  page: Page,
  menu: string,
  button: string,
): Promise<void> {
  const details = await openMenu(page, menu);
  await details.getByRole("button", { name: button, exact: true }).click();
}

export async function chooseComponent(
  page: Page,
  symbolId: string,
): Promise<void> {
  await page.keyboard.press("i");
  const dialog = page.getByRole("dialog", { name: "Insert Component" });
  await dialog.getByLabel("Component search").fill(symbolId);
  await dialog.getByTestId(`insert-component-${symbolId}`).click();
  await dialog.getByRole("button", { name: "Apply" }).click();
}

export async function downloadBytes(
  page: Page,
  menu: string,
  buttonName: string,
): Promise<Buffer> {
  const downloadPromise = page.waitForEvent("download");
  await clickCommand(page, menu, buttonName);
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
