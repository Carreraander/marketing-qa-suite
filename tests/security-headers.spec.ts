import { test, expect } from '@playwright/test';

/**
 * Transport and header hygiene. Every one of these is a one-line server change
 * and each closes a real class of attack, so they belong in an audit whose
 * output is a prioritised fix list.
 */
test('security headers and transport are configured', async ({ page, request, baseURL }) => {
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
  const headers = res?.headers() ?? {};
  const problems: string[] = [];

  if (!headers['strict-transport-security']) {
    problems.push('Missing Strict-Transport-Security (HSTS): a first visit over http can be intercepted.');
  }
  if (!headers['content-security-policy'] && !headers['content-security-policy-report-only']) {
    problems.push('Missing Content-Security-Policy: no defence-in-depth against injected scripts.');
  }
  if (headers['x-content-type-options'] !== 'nosniff') {
    problems.push('Missing X-Content-Type-Options: nosniff — browsers may MIME-sniff a response into script.');
  }
  const csp = headers['content-security-policy'] ?? '';
  if (!headers['x-frame-options'] && !csp.includes('frame-ancestors')) {
    problems.push('No X-Frame-Options and no CSP frame-ancestors — the site can be framed for clickjacking.');
  }
  if (headers['server'] && /\d/.test(headers['server'])) {
    problems.push(`Server header leaks a version string: "${headers['server']}" — free reconnaissance.`);
  }
  if (headers['x-powered-by']) {
    problems.push(`X-Powered-By leaks the stack: "${headers['x-powered-by']}".`);
  }

  // http:// must redirect to https://
  if (baseURL?.startsWith('https://')) {
    const insecure = baseURL.replace('https://', 'http://');
    try {
      const r = await request.get(insecure, { maxRedirects: 0, failOnStatusCode: false });
      const loc = r.headers()['location'] ?? '';
      if (r.status() < 300 || r.status() >= 400 || !loc.startsWith('https://')) {
        problems.push(`http:// does not redirect to https:// (status ${r.status()}, location "${loc}")`);
      }
    } catch {
      /* unreachable over http is acceptable — nothing served there */
    }
  }

  expect(problems, `Header findings:\n- ${problems.join('\n- ')}`).toHaveLength(0);
});
