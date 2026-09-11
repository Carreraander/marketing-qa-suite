# Sample bug report — responsive QA pass
**Target:** https://tracehold.com (marketing site) · **Date:** 2026-09-11
**Tester:** Ander Carrera Rojo · **Method:** automated width sweep (Playwright 1.62 + Chromium
151.0.7922.34, headless, Linux) with manual confirmation of every finding against a capture.

> **Scope note, stated up front:** this pass covers **layout integrity across viewport widths, Core Web
> Vitals, console errors and failed network requests, security headers and transport, SEO technicals and
> baseline accessibility structure**. Widths were driven through Chromium's engine, so
> findings are **Chromium/Blink-verified**. Safari/WebKit and real iOS/Android devices are **not**
> covered here and are marked as such — emulated Safari is not Safari.
>
> Every finding below was reproduced on **two independent runs** before being written down.
> Anything I could not reproduce twice is not in this report.

## Coverage matrix
| Width | scrollWidth | clientWidth | Result |
|---|---|---|---|
| 320 | **332** | 320 | **FAIL — horizontal overflow (12px)** |
| 360 | 360 | 360 | Pass |
| 390 | 390 | 390 | Pass |
| 480 | 480 | 480 | Pass |
| 600 | 600 | 600 | Pass |
| 768 | 768 | 768 | Pass |
| 834 | 834 | 834 | Pass |
| 1024 | **1127** | 1024 | **FAIL — horizontal overflow (103px)** |
| 1280 | 1280 | 1280 | Pass |
| 1440 | 1440 | 1440 | Pass |

---

## BUG-001 — Primary CTA is clipped off-screen at 1024px · **Severity: High**

**Environment:** Chromium 151.0.7922.34 (headless), Linux, viewport **1024×700**, DPR 1.

**Steps to reproduce**
1. Open `https://tracehold.com` at a viewport width of exactly **1024px**.
2. Look at the top-right of the header.

**Expected:** The header fits the viewport. "Request a demo" is fully visible and clickable.

**Actual:** The page overflows horizontally. `document.documentElement.scrollWidth` is **1127** against a
`clientWidth` of **1024** — **103px of overflow**. The offending node is:

```
<div class="lp-nav__cta">   left=799  right=1127  width=328
  └ <a class="lp-btn lp-btn--primary lp-btn--sm">  left=974  right=1127  width=153
      "Request a demo"
```

The primary conversion button is cut off mid-word — it renders as **"Requ"** (see evidence).

**Why this matters:** 1024px is iPad landscape and the common small-laptop width. The site's **main
call to action is partially unreachable** there, and the page gains an unintended horizontal scrollbar.

**Evidence:** `evidence/BUG-001_nav_clipped_1024.png` (header crop, 600–1024px),
`evidence/BUG-001_fullpage_1024.png` (full page).

**Suggested fix:** The nav appears to switch to the mobile/hamburger layout below some breakpoint and to
the full desktop layout at/above 1024, but at exactly 1024 the desktop nav is rendered while the
available width is insufficient for `Company · Pricing · EN · Sign in · Request a demo`. Either move the
desktop breakpoint above 1024px, or let `.lp-nav__cta` shrink (`min-width: 0` + `flex-shrink: 1`) so the
CTA stays inside the viewport.

---

## BUG-002 — Header control overflows the viewport at 320px · **Severity: Medium**

**Environment:** Chromium 151.0.7922.34 (headless), Linux, viewport **320×900**, DPR 1.

**Steps to reproduce**
1. Open `https://tracehold.com` at a viewport width of **320px** (iPhone SE 1st gen / Galaxy Fold closed).
2. Observe the header and attempt to scroll horizontally.

**Expected:** No horizontal scroll; all header controls fully inside the viewport.

**Actual:** `scrollWidth` is **332** against `clientWidth` **320** — **12px of overflow**. The hamburger
control at the top right is visibly clipped at the right edge, and the page scrolls sideways.

**Evidence:** `evidence/BUG-002_header_320.png`

**Suggested fix:** Reduce the header's horizontal padding below the 360px breakpoint, or allow the
language selector / hamburger group to shrink. A `overflow-x: hidden` on the wrapper would hide the
symptom but not the cause — the header row is 12px too wide for the box.

---

## BUG-003 — Cumulative Layout Shift is ~2× Google's budget, and ignores reduced-motion · **Severity: Medium**

**Environment:** Chromium 151.0.7922.34 (headless), Linux, viewport 1280×900, cold load.

**Steps to reproduce**
1. Load `https://tracehold.com` with a `layout-shift` PerformanceObserver attached.
2. Collect shifts for 5s, excluding those with `hadRecentInput`.

**Expected:** CLS ≤ **0.1** (Google's "good" threshold).

**Actual:** **CLS ≈ 0.19** — roughly double the budget. Measured over four loads:

| `prefers-reduced-motion` | Run 1 | Run 2 |
|---|---|---|
| `no-preference` | 0.1952 | 0.1889 |
| `reduce` | 0.1971 | 0.1971 |

Nearly all of it is a single shift of **0.1786** affecting the hero block:
```
<div class="lp-hero__panel reveal in">   shifted 0.1786
<p   class="lp-hero__sub reveal in">     shifted 0.1786
<div class="lp-hero__free reveal in">    shifted 0.1786
<svg>                                    shifted 0.1786
```

**Two findings in one:**
1. **Performance.** CLS is a Core Web Vitals metric and a ranking signal. At 0.19 this page is in the
   "needs improvement" band; content visibly jumps under the reader while they are starting to read.
2. **Accessibility.** The figure is **identical with `prefers-reduced-motion: reduce`** (0.1971 both
   runs). The shifting nodes carry a `reveal` class, so the entry reveal is the likely source and it
   **does not vary with the user's stated motion preference.**

**Suggested fix:** Reserve the hero block's final height before the reveal runs — animate `opacity` and
`transform` only, never properties that affect layout — and gate the reveal behind
`@media (prefers-reduced-motion: reduce) { ... }` so it is skipped entirely for users who ask for that.

**Honest limit:** this is one cold load from one server in one location, not field data. Real-user
monitoring is the only source of real CLS. Treat it as a signal to investigate, confirmed across four
loads, not as a field measurement.

---

## BUG-004 — An unbroken word in the headline is silently clipped · **Severity: Medium**

**Environment:** Chromium 151.0.7922.34, viewport **390×900** (common phone width).

**Steps to reproduce**
1. Load the page at 390px.
2. Replace the `<h1>` text with a long token containing no break opportunity, e.g.
   `Supercalifragilisticexpialidocious-Antidisestablishmentarianism-Pneumonoultramicroscopic`
   — the kind of value a real CMS receives: a product name, a German compound, a long URL.

**Expected:** The word wraps or hyphenates. Nothing is lost.

**Actual:** `h1.lp-hero__title` reports **`scrollWidth` 623px inside a `clientWidth` of 334px**. The
excess is **clipped, not scrolled** — an ancestor's `overflow-x: hidden` absorbs it, so there is no
scrollbar and no visual cue. **The reader simply never sees the end of the headline.**

**Why this one is easy to miss:** the usual check — `document.documentElement.scrollWidth` against the
viewport — **cannot see this**. It stays exactly 390. A whole-page screenshot looks fine. This is only
visible by measuring the element's own `scrollWidth` against its `clientWidth`.

**Suggested fix:** `overflow-wrap: anywhere` (or `hyphens: auto` with a `lang` attribute) on the heading.

**How I know the check works:** I verified the assertion can actually fail before trusting it. With
`white-space: nowrap` forced on the `h1` it reports 1779px in a 334px box; on the unmodified page it
reports 334 against 334. An assertion that cannot fail is not a test, and this one was vacuous until I
fixed it — see below.

---

## Not reproduced / not reported
- Widths 360–834 and 1280–1440 showed **no** horizontal overflow on either run.
- Several decorative elements (`.lp-*__glow`, `.thld-scene__mark`) extend past the viewport by design
  and are clipped correctly by their parents. **These are not bugs and are excluded** — flagging them
  would be noise from an automated tool, not a finding.
- `.skip-link` and `.lp-honey` sit at `left: -9999px`. That is the standard visually-hidden /
  honeypot pattern, **working as intended**.

## Tooling
`qa_scan.py` (included) drives the width sweep, measures `scrollWidth` vs `clientWidth`, enumerates
every element whose bounding box escapes the viewport, and records console errors and failed requests.
It is re-runnable by the site owner after every fix.

## How AI was used, and where it misled me
The sweep, the DOM measurement and this report were produced with an AI agent. **Where it misled me:**
in the first visual pass I read the 320px paragraph as overflowing its container — the measurement
showed it does not; only the header does. Worse: my first messy-content check asserted on
`document.scrollWidth`, which **cannot detect clipped overflow at all** — it passed even when I forced
`white-space: nowrap` on the headline. It was a test that could not fail, and I only found that out by
deliberately trying to break it. BUG-004 exists because I did. I also had to exclude ~10 decorative nodes per width that the
element-level check flagged as "overflowing" but which are clipped correctly by their parents. **That is
exactly why nothing here ships without a measurement and a capture behind it.**
