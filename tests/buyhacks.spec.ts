import { test, expect } from "@playwright/test";

test.describe("BuyHacks UI", () => {
  test("loads main heading and product cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "BuyHacks" })).toBeVisible();
    await expect(page.locator(".product-card").first()).toBeVisible({ timeout: 15_000 });
  });

  test("search narrows results", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".product-card").first()).toBeVisible({ timeout: 15_000 });
    const before = await page.locator(".product-card").count();
    await page.fill("#search-input", "zzzznomatch");
    await expect(page.locator("#result-count")).toContainText("0 product");
    await page.fill("#search-input", "");
    await expect(page.locator("#result-count")).not.toContainText("0 product", { timeout: 5_000 });
    const after = await page.locator(".product-card").count();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test("clear filters resets search and sort", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".product-card").first()).toBeVisible({ timeout: 15_000 });
    await page.fill("#search-input", "label");
    await page.selectOption("#sort-select", "name");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.locator("#search-input")).toHaveValue("");
    await expect(page.locator("#sort-select")).toHaveValue("default");
  });

  test("URL query restores search", async ({ page }) => {
    await page.goto("/?q=vacuum");
    await expect(page.locator("#search-input")).toHaveValue("vacuum");
    await expect(page.locator("#result-count")).not.toContainText("0 product");
  });

  test("mobile toolbar shows clear filters and sort", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await expect(page.locator("#sort-select")).toBeVisible();
    await expect(page.locator(".toolbar-actions")).toBeVisible();
  });

  test("list view toggle applies compact layout class", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".product-card").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "List" }).click();
    await expect(page.locator("#product-grid")).toHaveClass(/compact/);
    await expect(page.locator(".product-card--row").first()).toBeVisible();
  });
});
