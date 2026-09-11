import { test, expect } from '@playwright/test';

/** Technicals that decide whether the site can be crawled and indexed at all. */
test('robots.txt and sitemap are reachable and consistent', async ({ request, baseURL }) => {
  const problems: string[] = [];

  const robots = await request.get('/robots.txt', { failOnStatusCode: false });
  if (robots.status() !== 200) {
    problems.push(`robots.txt returned ${robots.status()}`);
  } else {
    const body = await robots.text();
    if (/^\s*Disallow:\s*\/\s*$/im.test(body) && !/Allow:/i.test(body)) {
      problems.push('robots.txt disallows the entire site.');
    }
    const sitemapLine = body.match(/^\s*Sitemap:\s*(\S+)/im);
    if (!sitemapLine) {
      problems.push('robots.txt declares no Sitemap.');
    } else {
      const sm = await request.get(sitemapLine[1], { failOnStatusCode: false });
      if (sm.status() !== 200) problems.push(`Sitemap ${sitemapLine[1]} returned ${sm.status()}`);
    }
  }

  expect(problems, `SEO technical findings (base ${baseURL}):\n- ${problems.join('\n- ')}`).toHaveLength(0);
});

test('heading structure is ordered and has no gaps', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const issues = await page.evaluate(() => {
    const out: string[] = [];
    const hs = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    let prev = 0;
    hs.forEach((h) => {
      const lvl = Number(h.tagName[1]);
      if (prev && lvl > prev + 1) {
        out.push(`Jump from h${prev} to h${lvl} at "${(h.textContent ?? '').trim().slice(0, 45)}"`);
      }
      prev = lvl;
    });
    return out;
  });
  expect(issues, `Heading structure:\n- ${issues.join('\n- ')}`).toHaveLength(0);
});
