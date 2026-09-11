# marketing-qa-suite

A re-runnable regression suite for marketing websites. Point it at a URL, get a pass/fail matrix you
can re-run yourself after every fix instead of re-hiring for it.

```bash
npm install
npx playwright install chromium
BASE_URL=https://example.com npx playwright test
npx playwright show-report
```

## Sample report

[`sample-report/`](sample-report/) is a real pass this suite produced against a live marketing site,
with the captures behind each finding. Four defects, each reproduced on separate runs before being
written down — including one that a whole-page screenshot cannot show and that the usual overflow check
cannot detect.

## What it checks

| Spec | What it catches |
|---|---|
| `responsive.spec.ts` | A layout that collapses at an in-between width. Sweeps 320→1920 including 834 (iPad portrait) and 1024 (iPad landscape / small laptop), asserts the document never exceeds the viewport, and **names the offending element** when it does. |
| `console-health.spec.ts` | Console errors and failed network requests — where "a form that submits but delivers nothing" and "a tracking event that never fires" show up first. |
| `metadata.spec.ts` | Title present and under 70 chars, meta description, canonical, `og:title`, `og:image`. Metadata regressions are invisible in the browser and expensive in search. |
| `a11y-baseline.spec.ts` | `<html lang>`, exactly one `<h1>`, images with `alt`, form controls with an accessible name. |

Add pages in `lib/targets.ts`. The report keys 1:1 to that list, so coverage is auditable.

## Scope, stated honestly

- **Chromium/Blink only.** The WebKit project is present in the config but **commented out on purpose**:
  enabling it here would report "Safari coverage" from an emulation. Emulated Safari is not Safari.
  Turn it on when there is a real WebKit runner (BrowserStack, or local macOS).
- **`a11y-baseline.spec.ts` is a baseline, not a conformance claim.** It settles what a machine can
  settle. WCAG conformance requires manual testing with real assistive technology, which this suite
  does not do and does not pretend to do.

## Three defects found in the suite itself, and how they were fixed

Written down because they are the difference between a suite you can trust and one you can't. Every one
of these made the suite report a *site* defect that did not exist.

1. **Unbounded parallelism crashed the renderer.** Fourteen concurrent browsers on a modest host produce
   `page.goto: Page crashed`, which surfaces as a failed assertion. Now serial by default; raise with
   `PW_WORKERS` on a bigger runner. Determinism beats speed for a measurement suite.
2. **Animations moved the layout mid-measurement.** Marketing sites animate on entry and on scroll, so
   `scrollWidth` sampled mid-flight fails at random. Fixed with `reducedMotion: 'reduce'` plus an
   injected stylesheet that zeroes animations and transitions before measuring.
   *A first attempt — polling until `scrollWidth` stopped changing — was wrong: the target page runs a
   continuous animation, so it never stabilises and the poll simply timed out.*
3. **Honeypot inputs reported as accessibility failures.** `aria-hidden="true"`, `tabindex="-1"` controls
   are correctly hidden from assistive technology and need no accessible name. The check now skips them,
   along with elements whose overflow an ancestor clips. Flagging those is tool noise, not a finding.

## Verification

Run four consecutive times against a live site: **identical results every time** — the two genuine
defects, nothing else. A sample report from that run is in `../SAMPLE_BUG_REPORT.md`.
