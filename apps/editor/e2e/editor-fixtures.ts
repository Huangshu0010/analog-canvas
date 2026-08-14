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

export interface RecoveryRecordView {
  workingCopyId: string;
  generation: string;
  projectText: string;
}

/**
 * Read the editor's bounded browser recovery records straight from the
 * application's IndexedDB store (no service API exists on purpose).
 */
export async function readRecoveryRecords(
  page: Page,
): Promise<RecoveryRecordView[]> {
  return page.evaluate(
    () =>
      new Promise<
        Array<{
          workingCopyId: string;
          generation: string;
          projectText: string;
        }>
      >((resolve, reject) => {
        const request = indexedDB.open("analog-canvas-recovery");
        request.onerror = () =>
          reject(request.error ?? new Error("recovery db open failed"));
        request.onsuccess = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("browser-recovery-v2")) {
            resolve([]);
            database.close();
            return;
          }
          const transaction = database.transaction(
            "browser-recovery-v2",
            "readonly",
          );
          const getAll = transaction
            .objectStore("browser-recovery-v2")
            .getAll();
          getAll.onsuccess = () => {
            resolve(
              (getAll.result as Array<Record<string, unknown>>).map(
                (record) => ({
                  workingCopyId: String(record.workingCopyId),
                  generation: String(record.generation),
                  projectText: String(record.projectText ?? ""),
                }),
              ),
            );
            database.close();
          };
          getAll.onerror = () =>
            reject(getAll.error ?? new Error("recovery store read failed"));
        };
      }),
  );
}

export async function recoveryProjectTexts(page: Page): Promise<string> {
  const records = await readRecoveryRecords(page);
  return records.map((record) => record.projectText).join("\n");
}
