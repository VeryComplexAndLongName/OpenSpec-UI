import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Navigates to the AI panel, loads the change list through a real
 * `list` command round-trip (not a UI shortcut), and selects `changeName`
 * -- the shared setup every AI-panel-driven lifecycle spec needs. */
export async function loadAndSelectChange(page: Page, changeName: string): Promise<void> {
  await page.getByRole("tab", { name: "Run a Command" }).click();
  await page.getByTestId("load-changes-button").click();
  await expect(page.getByTestId("change-picker").locator("option")).toHaveCount(2, { timeout: 15000 });
  await page.getByTestId("change-picker").selectOption(changeName);
}
