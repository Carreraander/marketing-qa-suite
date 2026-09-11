import { test, expect } from '@playwright/test';
import { TARGETS, WIDTHS } from '../lib/targets';

/**
 * Catches the failure this suite exists for: a layout that collapses at an
 * in-between width. Asserts the document never exceeds the viewport, and when
 * it does, names the offending element so an engineer can act without asking.
 *
 * Animations are disabled before measuring. Marketing sites animate on entry and
 * on scroll; measuring mid-flight produces a suite that fails at random, which is
 * worse than no suite at all.
 */
const KILL_MOTION = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    animation-duration: 0s !important;
    transition-duration: 0s !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
`;

for (const target of TARGETS) {
  for (const width of WIDTHS) {
    test(`${target.name} @ ${width}px has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(target.path, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: KILL_MOTION });
      await page.waitForTimeout(400);

      const result = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const offenders: Array<Record<string, unknown>> = [];
        document.querySelectorAll<HTMLElement>('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          // Visually-hidden / honeypot pattern: far off-canvas by design.
          if (r.right < -1000 || r.left > vw + 1000) return;
          // Overflow clipped by an ancestor (decorative glows) is not a defect.
          let p: HTMLElement | null = el.parentElement;
          while (p) {
            const o = getComputedStyle(p).overflowX;
            if (o === 'hidden' || o === 'clip') return;
            p = p.parentElement;
          }
          if (r.right > vw + 1) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
              text: (el.textContent ?? '').trim().slice(0, 50),
              left: Math.round(r.left),
              right: Math.round(r.right),
            });
          }
        });
        return { vw, scrollW: document.documentElement.scrollWidth, offenders: offenders.slice(0, 8) };
      });

      expect(
        result.scrollW,
        `Horizontal overflow of ${result.scrollW - result.vw}px at ${width}px.\n` +
          `Offending elements:\n${JSON.stringify(result.offenders, null, 2)}`,
      ).toBeLessThanOrEqual(result.vw + 1);
    });
  }
}
