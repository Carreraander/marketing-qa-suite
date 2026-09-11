import { test, expect } from '@playwright/test';
import { TARGETS } from '../lib/targets';

/**
 * BASELINE ONLY, and labelled as such. These are structural checks a machine can
 * settle. They are NOT a WCAG conformance claim: conformance requires manual
 * testing with real assistive technology, which this suite does not do.
 */
for (const target of TARGETS) {
  test(`${target.name} passes baseline accessibility structure`, async ({ page }) => {
    await page.goto(target.path, { waitUntil: 'networkidle' });

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang, 'Missing <html lang> — screen readers cannot pick a voice').toBeTruthy();

    const h1Count = await page.locator('h1').count();
    expect(h1Count, `Expected exactly one <h1>, found ${h1Count}`).toBe(1);

    const imgsWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imgsWithoutAlt, 'Images missing an alt attribute (use alt="" if decorative)').toBe(0);

    const unlabelled = await page.evaluate(() => {
      const bad: string[] = [];
      document.querySelectorAll<HTMLElement>('input:not([type=hidden]), select, textarea').forEach((el) => {
        // Correctly hidden from assistive technology: honeypots and off-canvas
        // controls need no accessible name. Flagging them is tool noise.
        if (el.getAttribute('aria-hidden') === 'true') return;
        if (el.closest('[aria-hidden="true"]')) return;
        if (el.getAttribute('tabindex') === '-1' && !el.offsetParent) return;
        const id = el.getAttribute('id');
        const labelled =
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          el.getAttribute('title') ||
          (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
          el.closest('label');
        if (!labelled) bad.push(el.outerHTML.slice(0, 100));
      });
      return bad;
    });
    expect(unlabelled, `Form controls with no accessible name:\n${unlabelled.join('\n')}`).toHaveLength(0);
  });
}
