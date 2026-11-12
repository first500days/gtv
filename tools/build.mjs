// Build + validate the GTV page widget.
//   node tools/build.mjs
// Outputs (dist/):
//   gtv-widget.html             -> paste into the Elementor HTML widget (production)
//   preview.html                -> standalone page with the SEO <head> (title, meta, canonical, OG)
//   integration-preview.html    -> the widget inside a saved copy of a live First500days programme
//                                  page (real header, footer, Elementor + Hello CSS) for testing
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src', 'gtv-widget.html');
const REF = join(ROOT, 'reference', 'international-founder-visa.live.html');
const DIST = join(ROOT, 'dist');

export const SEO = {
  title: 'UK Global Talent Visa Programme | First500days',
  description:
    'Explore the UK Global Talent Visa Digital Technology programme by First500days. Assess your professional profile, strengthen your evidence, develop your portfolio and prepare for the next stage.',
  canonical: 'https://first500days.com/global-talent-visa/',
  ogImage: 'https://first500days.com/wp-content/uploads/2026/09/First500days-Preview-Image-1.jpg',
};

const widget = readFileSync(SRC, 'utf8');
const errors = [];
const check = (ok, msg) => { if (!ok) errors.push(msg); };

// ---------- content & compliance checks ----------
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const body = strip(widget);
check((body.match(/<h1[\s>]/g) || []).length === 1, 'Widget must contain exactly one <h1>.');
for (const banned of ['taknik', 'achinike', 'patricia', 'white cross', 'harmony', 'cqc', 'cygnet', 'bournemouth']) {
  check(!body.toLowerCase().includes(banned), `Banned / candidate-specific term found: "${banned}"`);
}
check(!/<header[\s>]|<footer[\s>]|<nav[\s>]/i.test(body), 'Widget must not contain header/footer/nav elements.');
// no imagery, except approved testimonial photos (class="gtv-avatar-img") added later
check(!/<img(?![^>]*class="gtv-avatar-img")[\s>]/i.test(body), 'Widget must not contain images (no hero/stock imagery). Only approved testimonial photos may use <img class="gtv-avatar-img">.');

// testimonials: 6 cards; while any are placeholders they must be visibly labelled as illustrative
const tSection = body.match(/<section[^>]*id="gtv-testimonials"[\s\S]*?<\/section>/)?.[0] || '';
const tCards = (tSection.match(/<figure class="gtv-tcard"/g) || []).length;
const illustrative = /data-gtv-illustrative="true"/.test(tSection);
check(tCards === 6, `Expected 6 testimonial cards, found ${tCards}.`);
if (illustrative) {
  check(/Illustrative examples, not client testimonials/.test(tSection), 'Illustrative testimonials must carry the visible "Illustrative examples, not client testimonials" notice.');
  check((tSection.match(/gtv-illus-tag">Illustrative</g) || []).length === tCards, 'Every illustrative testimonial card must show an "Illustrative" tag.');
}
check(!/"@type"\s*:\s*"(Review|AggregateRating)"/.test(body), 'No Review / AggregateRating schema (testimonials are not verified reviews).');

// hero dashboard: the six deliverable items with checkmarks
const dash = body.match(/<ul class="gtv-dash-list">([\s\S]*?)<\/ul>/)?.[1] || '';
check((dash.match(/<li>/g) || []).length === 6 && (dash.match(/gtv-dash-ok/g) || []).length === 6, 'Hero dashboard must list 6 assessment items with checkmarks.');
check(!/\b\d{1,3}\s?%\s*(success|approval|endorse)/i.test(body), 'Looks like a success-rate statistic.');
check(!/[£$€]\s?\d/.test(body), 'Looks like a price.');
check(/data-booking-link="[^"]+"/.test(body), 'Root data-booking-link attribute missing.');
const bookCount = (body.match(/<a [^>]*\bdata-gtv-book\b/g) || []).length;
check(bookCount === 4, `Expected booking CTAs to use data-gtv-book (found ${bookCount}).`);
check(body.includes('id="gtv-process"') && body.includes('href="#gtv-process"'), 'Explore CTA must target #gtv-process.');

// heading order: no level skips (h1 -> h2 -> h3)
const levels = [...body.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
levels.forEach((l, i) => i && check(l - levels[i - 1] <= 1, `Heading level skip h${levels[i - 1]} -> h${l} (#${i}).`));

// FAQ schema must match the visible accordion exactly
const ld = body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
let faqSchema = [];
try { faqSchema = JSON.parse(ld[1]).mainEntity; } catch (e) { errors.push('FAQ JSON-LD does not parse: ' + e.message); }
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").trim();
const faqDom = [...body.matchAll(/<h3 class="gtv-faq-q">([\s\S]*?)<\/h3>[\s\S]*?<p class="gtv-faq-a">([\s\S]*?)<\/p>/g)]
  .map((m) => ({ q: decode(m[1]), a: decode(m[2]) }));
check(faqDom.length === 9, `Expected 9 FAQ items, found ${faqDom.length}.`);
check(faqSchema.length === faqDom.length, 'FAQ schema count differs from accordion.');
faqDom.forEach((f, i) => {
  check(faqSchema[i]?.name === f.q, `FAQ schema question #${i + 1} differs from page.`);
  check(faqSchema[i]?.acceptedAnswer?.text === f.a, `FAQ schema answer #${i + 1} differs from page.`);
});

if (errors.length) {
  console.error('BUILD FAILED\n - ' + errors.join('\n - '));
  process.exit(1);
}

// ---------- outputs ----------
mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, 'gtv-widget.html'), widget);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const seoHead = `<title>${SEO.title}</title>
<meta name="description" content="${esc(SEO.description)}">
<link rel="canonical" href="${SEO.canonical}">
<meta name="robots" content="index, follow">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="article">
<meta property="og:site_name" content="First500days">
<meta property="og:title" content="${esc(SEO.title)}">
<meta property="og:description" content="${esc(SEO.description)}">
<meta property="og:url" content="${SEO.canonical}">
<meta property="og:image" content="${SEO.ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(SEO.title)}">
<meta name="twitter:description" content="${esc(SEO.description)}">`;

writeFileSync(join(DIST, 'preview.html'), `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${seoHead}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:#fff}</style>
</head>
<body>
<main>
${widget}
</main>
</body>
</html>
`);

// Integration preview: swap the live programme page's body widget for ours.
if (existsSync(REF)) {
  let html = readFileSync(REF, 'utf8');
  // mask <style>/<script> bodies so "<div" inside CSS/JS can't confuse the depth counter
  const masked = html.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, (m) => ' '.repeat(m.length));
  const marker = masked.indexOf('elementor-element-5d98839');
  if (marker < 0) throw new Error('Reference page structure changed: body widget not found.');
  const open = masked.lastIndexOf('<div', marker);
  const innerStart = masked.indexOf('>', open) + 1;
  const re = /<div\b|<\/div>/g; re.lastIndex = innerStart;
  let depth = 1, m, innerEnd = -1;
  while ((m = re.exec(masked))) { depth += m[0] === '</div>' ? -1 : 1; if (!depth) { innerEnd = m.index; break; } }
  if (innerEnd < 0) throw new Error('Could not find end of body widget.');
  html = html.slice(0, innerStart) + '\n' + widget + '\n' + html.slice(innerEnd);
  // site-relative assets (logo etc.) load from the live site when previewed locally
  html = html.replace(/(src|srcset)="\/wp-content\//g, '$1="https://first500days.com/wp-content/');
  // replace page SEO head with ours (Rank Math tags in production)
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta (name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\s*/g, '')
    .replace(/<link rel="canonical"[^>]*>\s*/, '')
    .replace(/<head>/, '<head>\n' + seoHead + '\n');
  writeFileSync(join(DIST, 'integration-preview.html'), html);
}

console.log(`Build OK: ${faqDom.length} FAQs, ${bookCount} booking CTAs (+ sticky header CTA), ${tCards} testimonials, ${levels.length} headings -> dist/`);
if (illustrative) console.warn('NOTE: testimonials are ILLUSTRATIVE placeholders (labelled on the page). Replace with verified testimonials or remove the section before publishing.');
