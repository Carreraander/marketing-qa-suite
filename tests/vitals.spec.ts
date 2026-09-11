import { test, expect } from '@playwright/test';
import { TARGETS } from '../lib/targets';

/**
 * Core Web Vitals, collected from a real page load, with the element responsible
 * named. "The site is slow" is not actionable; "your LCP is the hero image at
 * 4.1s and it is lazy-loaded" is.
 *
 * Thresholds are Google's: LCP good <= 2500ms, CLS good <= 0.1.
 * These run on ONE cold load from a server in one location. Treat them as a
 * signal to investigate, not as field data — real users are the only source of
 * real field data, and that is stated in every report this produces.
 */
const LCP_BUDGET_MS = 2500;
const CLS_BUDGET = 0.1;

for (const target of TARGETS) {
  test(`${target.name} meets Core Web Vitals budgets`, async ({ page }) => {
    await page.goto(target.path, { waitUntil: 'load' });

    const vitals = await page.evaluate(
      () =>
        new Promise<{ lcp: number; lcpElement: string; cls: number; shifts: string[] }>((resolve) => {
          let lcp = 0;
          let lcpElement = '(none)';
          let cls = 0;
          const shifts: string[] = [];

          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as any[]) {
              lcp = e.startTime;
              const el = e.element as HTMLElement | undefined;
              const cls0 = el?.getAttribute('class');
              lcpElement = el
                ? `<${el.tagName.toLowerCase()}${cls0 ? ` class="${cls0.slice(0, 40)}"` : ''}>` +
                  (el.getAttribute('loading') === 'lazy' ? ' [loading=lazy — LCP images must not be lazy]' : '')
                : '(no element)';
            }
          }).observe({ type: 'largest-contentful-paint', buffered: true });

          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as any[]) {
              if (e.hadRecentInput) continue;
              cls += e.value;
              for (const s of e.sources ?? []) {
                const n = s.node as HTMLElement | undefined;
                if (!n) continue;
                const c = n.getAttribute('class');
                shifts.push(`<${n.tagName.toLowerCase()}${c ? ` class="${c.slice(0, 40)}"` : ''}> shifted ${e.value.toFixed(4)}`);
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => resolve({ lcp, lcpElement, cls, shifts: shifts.slice(0, 6) }), 5000);
        }),
    );

    test.info().annotations.push({
      type: 'vitals',
      description: `LCP ${Math.round(vitals.lcp)}ms on ${vitals.lcpElement} · CLS ${vitals.cls.toFixed(4)}`,
    });

    expect(
      vitals.lcp,
      `LCP is ${Math.round(vitals.lcp)}ms (budget ${LCP_BUDGET_MS}ms). Responsible element: ${vitals.lcpElement}`,
    ).toBeLessThanOrEqual(LCP_BUDGET_MS);

    expect(
      vitals.cls,
      `CLS is ${vitals.cls.toFixed(4)} (budget ${CLS_BUDGET}).\nShifting elements:\n${vitals.shifts.join('\n')}`,
    ).toBeLessThanOrEqual(CLS_BUDGET);
  });
}
