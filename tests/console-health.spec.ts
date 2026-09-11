import { test, expect } from '@playwright/test';
import { TARGETS } from '../lib/targets';

/**
 * "A form that submits but delivers nothing" and "a tracking event that never
 * fires" both show up here first: as a console error or a failed request.
 */
for (const target of TARGETS) {
  test(`${target.name} loads with no console errors or failed requests`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failed: string[] = [];

    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
    });
    page.on('requestfailed', (r) => {
      // Aborted requests are usually the page navigating away; not a defect.
      if (r.failure()?.errorText === 'net::ERR_ABORTED') return;
      failed.push(`${r.method()} ${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`);
    });

    await page.goto(target.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toHaveLength(0);
    expect(failed, `Failed requests:\n${failed.join('\n')}`).toHaveLength(0);
  });
}
