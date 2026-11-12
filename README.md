# Global Talent Visa programme page: first500days.com

The body content for a new `/global-talent-visa/` programme page. It is built the same way as the existing
programme pages (e.g. `/international-founder-visa/`): **one Elementor HTML widget** on a page that uses the
**Elementor Full Width** template. The site's existing header and footer render around it. This page adds no
header, footer, nav, logo or imagery.

## Files

| Path | Purpose |
|---|---|
| `src/gtv-widget.html` | Source of the widget (scoped CSS + markup + JS + FAQPage JSON-LD). Edit this one. |
| `dist/gtv-widget.html` | Build output. **Paste this into the Elementor HTML widget.** |
| `dist/preview.html` | Standalone preview with the page's SEO `<head>`. |
| `dist/integration-preview.html` | The widget inside a saved copy of a live First500days programme page (real header, footer, Elementor/Hello CSS). Used for testing. |
| `reference/international-founder-visa.live.html` | Saved live page used for the integration preview. |
| `tools/build.mjs` | Builds `dist/` and enforces content rules (one H1, heading order, FAQ schema = visible FAQ, no candidate data, no TaknikAI, no prices or success rates). |
| `tools/test.mjs` | Browser tests: 6 viewports, overflow, layout, CTAs, FAQ (mouse + keyboard), smooth scroll, focus states, SEO, reduced motion, no-JS, integration. |
| `screenshots/` | Output of the last test run. |

```bash
npm install     # one-time (puppeteer-core; uses your installed Chrome/Edge)
npm run build   # validate + regenerate dist/
npm test        # build + browser tests (167 checks)
node tools/shoot-sections.mjs 1440   # per-section screenshots at a given width
```

## Install in WordPress

1. **Pages → Add New**. Title: `Global Talent Visa`. Slug: `global-talent-visa`.
2. Page Attributes → Template: **Elementor Full Width** (same as the other programme pages).
3. Edit with Elementor. Add one **HTML** widget to a full-width container with no padding, then paste the
   whole of `dist/gtv-widget.html`.
4. **Booking link:** on the first line of the widget's root element, replace the placeholder:
   ```html
   <div class="f5d-gtv-page" data-booking-link="[BOOKING_LINK]">
   ```
   All four "Book a / Book Your Profile Assessment" buttons read this one value. It accepts either:
   - a full URL (e.g. Calendly), which opens in a new tab, or
   - a Tally hash link like the rest of the site uses, e.g. `#tally-open=XXXXXX&tally-layout=modal&tally-hide-title=1`
     (Tally's embed script is already loaded site-wide).

   While the value is still `[BOOKING_LINK]`, the buttons fall back to `/contact-us/`, so there are never broken links.
   "Contact Our Team" always goes to `/contact-us/`.
5. **Rank Math → General:**
   - SEO title: `UK Global Talent Visa Programme | First500days`
   - Description: `Explore the UK Global Talent Visa Digital Technology programme by First500days. Assess your professional profile, strengthen your evidence, develop your portfolio and prepare for the next stage.`
   - Canonical: leave as default (`https://first500days.com/global-talent-visa/`, trailing slash, matching `/international-founder-visa/`).
   - Social tab: Rank Math fills OG/Twitter from the title and description. Choose an OG image (the site default is `First500days-Preview-Image-1.jpg`).
6. **Schema:** the widget already outputs `FAQPage` JSON-LD that matches the visible FAQ exactly.
   Do **not** add a second FAQ schema in Rank Math for this page.
7. Publish. Adding the page to the **Programs** menu or dropdown is a separate header change and has been left to the developer.

## Before publishing: testimonials are placeholders

The testimonials section (`#gtv-testimonials`) contains **six illustrative, fictional** testimonials. The page
labels them as such: a notice above the grid plus an "Illustrative" tag on each card. **Do not publish them as
client feedback.** Before go-live, either:
- replace each card with a verified, consented testimonial. For an approved photo, put
  `<img class="gtv-avatar-img" src="..." alt="">` inside `.gtv-avatar` in place of the initials. Once all six
  are real, remove the notice and the tags and set `data-gtv-illustrative="false"`; or
- delete the whole `<section id="gtv-testimonials">`.

The build prints a reminder while they are still illustrative. No Review/rating schema is output.

## Sticky "Book Free Consultation" button

The widget's script adds the button into the **existing sticky site header on this page only**. The header
template is not edited. The button uses the same destination as the assessment buttons (`data-booking-link`,
or `/contact-us/` while unset). It measures the free space in the header row and never overlaps the logo,
nav or menu button:
- desktop: full label after the nav;
- narrow header widths and phones: "Free Consultation", then a compact two-line pill;
- ~1025–1080px, where the live header has no free space at all: it floats bottom-left instead.

In the standalone `preview.html` (no site header), it appears as a floating pill once you scroll past the hero.
`node tools/audit-header.mjs` prints its geometry at each width and saves screenshots in `screenshots/audit/`.

## Implementation notes

- All CSS is scoped under `.f5d-gtv-page` with `gtv-` prefixed classes, so nothing leaks into the header or footer
  or other pages. Tests confirm the theme/kit CSS does not override the widget's fonts or colours.
- Design tokens come from the live site: Poppins; navy `#0B1220`; gradient `#5AB0E3 → #2E7BC4`; borders `#D6E2EF`;
  20px cards; pill buttons with the same sheen hover; uppercase blue eyebrows; scroll-reveal.
- Accessibility: one H1 with no skipped heading levels; native `<details>` FAQ (Enter/Space); visible focus rings;
  decorative icons are `aria-hidden`; `prefers-reduced-motion` respected; content stays visible without JavaScript.
- Responsive: 3 columns on desktop, 2 on tablet, 1 on mobile; horizontal 6-step timeline above 1180px, vertical
  below; 16px mobile gutters; full-width mobile CTAs; no horizontal overflow at 360–1440px.
- Content: the brief's copy is used verbatim. The assessment section is modelled on the structure of the sample
  client assessment deck, with **no** candidate details, findings or brand names from it. It states plainly that an
  assessment may recommend *not* enrolling. There are no prices, durations, statistics, testimonials or outcomes.
