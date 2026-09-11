import { test, expect } from '@playwright/test';
import { TARGETS } from '../lib/targets';

/** Metadata regressions are invisible in the browser and expensive in search. */
for (const target of TARGETS) {
  test(`${target.name} has complete, non-default metadata`, async ({ page }) => {
    await page.goto(target.path, { waitUntil: 'domcontentloaded' });

    const title = await page.title();
    expect(title.length, 'Page title is empty').toBeGreaterThan(0);
    expect(title.length, `Title is ${title.length} chars; search results truncate near 60`).toBeLessThan(70);

    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    expect(desc, 'Missing meta description').toBeTruthy();

    const canonical = await page.locator('link[rel="canonical"]').count();
    expect(canonical, 'Missing canonical link').toBeGreaterThan(0);

    const ogTitle = await page.locator('meta[property="og:title"]').count();
    const ogImage = await page.locator('meta[property="og:image"]').count();
    expect(ogTitle, 'Missing og:title — link previews will fall back to the raw title').toBeGreaterThan(0);
    expect(ogImage, 'Missing og:image — link previews will render without an image').toBeGreaterThan(0);
  });
}
