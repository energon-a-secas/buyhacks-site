import { test, expect } from "@playwright/test";
import { installFixture } from './fixture';
import { resolve } from 'node:path';

test.describe("BuyHacks UI", () => {
  test.beforeEach(async ({page}) => installFixture(page));
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
    // Anchored whole-string matches. "0 product" is a *substring* of "10 products",
    // "20 products", "30 products" — so the old toContainText pair broke at every
    // count ending in zero and healed itself at 31. The positive half was worse: it
    // also matched "30 products", so a filter returning everything still read as
    // "no matches".
    await expect(page.locator("#result-count")).toHaveText(/^0 products?$/);
    await expect(page.locator(".product-card")).toHaveCount(0);
    await page.fill("#search-input", "");
    await expect(page.locator("#result-count")).toHaveText(/^[1-9]\d* products?$/, { timeout: 5_000 });
    const after = await page.locator(".product-card").count();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test("clear filters resets search and sort", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".product-card").first()).toBeVisible({ timeout: 15_000 });
    await page.fill("#search-input", "label");
    await page.selectOption("#sort-select", "name");
    await page.locator('#clear-filters').click();
    await expect(page.locator("#search-input")).toHaveValue("");
    await expect(page.locator("#sort-select")).toHaveValue("default");
  });

  test("URL query restores search", async ({ page }) => {
    await page.goto("/?q=vacuum");
    await expect(page.locator("#search-input")).toHaveValue("vacuum");
    await expect(page.locator("#result-count")).toHaveText(/^[1-9]\d* products?$/);
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

  test('tips survive a failed save and background refresh; success clears the current form', async ({page}) => {
    await page.goto('/');
    await page.locator('[data-open-product]').first().click();
    await page.locator('.hack-input').fill('Keep this draft');
    await page.evaluate(() => { (window as any).fixture.fail = true; });
    await page.locator('.hack-submit').click();
    await expect(page.locator('#toast')).toContainText('Could not submit');
    await expect(page.locator('.hack-input')).toHaveValue('Keep this draft');
    await expect(page.locator('.hack-submit')).toBeEnabled();
    await page.evaluate(() => { (window as any).fixture.fail = false; });
    await page.locator('.hack-submit').click();
    await expect(page.locator('.hack-submit')).toBeDisabled();
    await page.evaluate(async () => { const path='/js/events.js'; await (await import(path)).loadRemoteData(); });
    await expect(page.locator('.hack-submit')).toBeDisabled();
    await expect(page.locator('.hack-input')).toHaveValue('');
    await expect(page.locator('.hack-submit')).toBeEnabled();
    await expect(page.locator('.hack-text')).toHaveText('Keep this draft');
    expect(await page.evaluate(() => (window as any).fixture.calls.filter(c=>c.name==='hacks:submitHack').length)).toBe(2);
  });

  test('sign-in dismissal preserves the tip and sends no write', async ({page}) => {
    await page.goto('/');
    await page.locator('[data-open-product]').first().click();
    await page.evaluate(async () => {
      const path='/js/neorgon-auth.js';
      (await import(path)).NeoAuth.listener({signedIn:false,label:null});
    });
    await page.locator('.hack-input').fill('For later');
    await page.locator('.hack-submit').click();
    await expect(page.locator('.hack-input')).toHaveValue('For later');
    await expect(page.locator('.hack-submit')).toBeEnabled();
    expect(await page.evaluate(() => (window as any).fixture.signInRequested)).toBe(true);
    expect(await page.evaluate(() => (window as any).fixture.calls.length)).toBe(0);
  });

  test('product upload and reactions still reach their original APIs', async ({page}) => {
    await page.goto('/');
    await page.locator('#addProductToggle').click();
    await page.locator('#productName').fill('Travel stand');
    await page.locator('#productBrand').fill('Example');
    await page.locator('#productDescription').fill('Fits in a bag.');
    await page.locator('#productCategory').selectOption('work-tech');
    await page.locator('#productTags').fill('travel, desk');
    await page.locator('#productUrl').fill('https://example.com/stand');
    await page.locator('#removeBgToggle').uncheck();
    await page.locator('#fileInput').setInputFiles(resolve('images/eufy-cordless-vacuum-s11.png'));
    await page.locator('#uploadSubmit').click();
    await expect(page.locator('#productName')).toHaveValue('');
    await expect(page.locator('.product-card')).toHaveCount(3);
    const product = await page.evaluate(() => (window as any).fixture.calls.find(c=>c.name==='products:saveProduct').args);
    expect(product).toMatchObject({name:'Travel stand',category:'work-tech',tags:['travel','desk'],productUrl:'https://example.com/stand',storageId:'fixture-storage'});
    await page.locator('.vote-btn[data-type="love"]').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).fixture.calls.filter(c=>c.name==='votes:toggleVote').length)).toBe(1);
  });
});
