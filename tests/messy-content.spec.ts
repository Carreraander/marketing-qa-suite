import { test, expect } from '@playwright/test';
import { TARGETS } from '../lib/targets';

/**
 * CMS-driven components fail differently from hardcoded ones. The content that
 * ships on launch day is the content someone wrote to fit; the content that
 * breaks the page arrives three months later from a marketing hire.
 *
 * This mutates live text in place and re-measures. It does not touch the CMS and
 * changes nothing server-side — it answers "what happens WHEN, not IF, someone
 * types a 140-character headline".
 */
const CASES = [
  { name: 'long headline', value: 'Enterprise-Grade Observability And Compliance Tooling For Regulated Multinational Organisations' },
  { name: 'unbroken token', value: 'Supercalifragilisticexpialidocious-Antidisestablishmentarianism-Pneumonoultramicroscopic' },
  { name: 'unusual characters', value: 'Zażółć gęślą jaźń — 日本語テスト — «Ñandú» — 🚀🔒📊 — ﷽' },
  { name: 'empty value', value: '' },
];

for (const target of TARGETS) {
  for (const c of CASES) {
    test(`${target.name} survives a ${c.name} in its main heading`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 }); // narrowest realistic phone
      await page.goto(target.path, { waitUntil: 'networkidle' });

      const applied = await page.evaluate((value) => {
        const h1 = document.querySelector('h1');
        if (!h1) return false;
        h1.textContent = value;
        return true;
      }, c.value);
      test.skip(!applied, 'No <h1> on this page to mutate');

      await page.waitForTimeout(300);

      const res = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const findings: string[] = [];

        // Two DIFFERENT failures, and the second is the one people miss.
        //
        // (a) The document grows past the viewport -> a horizontal scrollbar.
        // (b) The content is CLIPPED inside its own box -> no scrollbar at all,
        //     and the reader silently loses the end of the sentence. Checking
        //     documentElement.scrollWidth cannot see (b), because an ancestor
        //     with overflow-x:hidden absorbs it. Element-level scrollWidth can.
        document.querySelectorAll<HTMLElement>('h1, h1 *, header, nav').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return;
          const cls = el.getAttribute('class');
          const tag = `<${el.tagName.toLowerCase()}${cls ? ` class="${cls.slice(0, 40)}"` : ''}>`;
          if (el.scrollWidth > el.clientWidth + 1) {
            findings.push(`${tag} content is CLIPPED: ${el.scrollWidth}px of content in a ${el.clientWidth}px box`);
          }
          if (r.right > vw + 1) {
            findings.push(`${tag} extends to x=${Math.round(r.right)} past the ${vw}px viewport`);
          }
        });

        return { vw, scrollW: document.documentElement.scrollWidth, findings: findings.slice(0, 6) };
      });

      const docOverflow = res.scrollW - res.vw;
      expect(
        [...res.findings, ...(docOverflow > 1 ? [`document overflows by ${docOverflow}px`] : [])],
        `A ${c.name} breaks the layout at 390px.\nContent: "${c.value.slice(0, 60)}"\nFindings:\n${res.findings.join('\n')}`,
      ).toHaveLength(0);
    });
  }

  test(`${target.name} survives a missing hero image`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    // Fail every image request: the CMS field was left empty, or the CDN is down.
    await page.route('**/*.{png,jpg,jpeg,webp,avif,gif,svg}', (r) => r.abort());
    await page.goto(target.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const res = await page.evaluate(() => ({
      vw: document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth,
      // An <img> with no alt and no src renders as nothing: invisible to sighted
      // users AND to screen readers. That is a content hole, not a design choice.
      silentlyBroken: Array.from(document.querySelectorAll('img'))
        .filter((i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0)
        .filter((i) => !i.getAttribute('alt'))
        .length,
    }));

    expect(res.scrollW, `Missing images push the layout ${res.scrollW - res.vw}px past the viewport.`)
      .toBeLessThanOrEqual(res.vw + 1);
    expect(
      res.silentlyBroken,
      `${res.silentlyBroken} broken image(s) have no alt text — they vanish silently for every user.`,
    ).toBe(0);
  });
}
