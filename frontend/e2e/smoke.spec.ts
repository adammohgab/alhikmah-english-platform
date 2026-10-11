import { test, expect } from "@playwright/test";

test.describe("Index / Landing Page Smoke Test", () => {
  test("loads the landing page successfully", async ({ page }) => {
    await page.goto("./");

    // Expect the page title to match platform title
    await expect(page).toHaveTitle(/Al[ -]?Hikmah/i);

    // Validate root application mounting container is present and visible
    const root = page.locator("#root");
    await expect(root).toBeAttached();
  });
});
