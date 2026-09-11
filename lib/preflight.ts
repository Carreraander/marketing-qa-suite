import { chromium } from '@playwright/test';

/**
 * Fails fast and legibly when the target is not reachable.
 *
 * Without this, pointing the suite at a dead or mistyped URL produces one
 * confusing failure per test — fourteen red lines that look like fourteen site
 * defects. A reviewer reading that report reaches the wrong conclusion. One
 * clear message is worth more than fourteen misleading ones.
 */
export default async function globalSetup() {
  const baseURL = process.env.BASE_URL ?? 'https://example.com';
  const browser = await chromium.launch({
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer'],
  });
  try {
    const page = await browser.newPage();
    const res = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!res) throw new Error(`No response from ${baseURL}`);
    if (res.status() >= 400) {
      throw new Error(`${baseURL} returned HTTP ${res.status()} — nothing to test.`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `\n\n  PREFLIGHT FAILED — the target is not testable.\n` +
        `  BASE_URL: ${baseURL}\n` +
        `  Reason:   ${reason}\n\n` +
        `  This is not a site defect. Check the URL, DNS, and that the host is serving.\n`,
    );
  } finally {
    await browser.close();
  }
}
