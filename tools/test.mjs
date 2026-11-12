// Browser tests for the GTV page (uses the locally installed Chrome via puppeteer-core).
//   npm test
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SHOTS = join(ROOT, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));

// Serve dist/ (plus a configured-booking-link variant generated on the fly)
const TEST_BOOKING = 'https://calendly.com/example/gtv-profile-assessment';
const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (url === '/configured.html') {
    const html = readFileSync(join(DIST, 'preview.html'), 'utf8').replace('data-booking-link="[BOOKING_LINK]"', `data-booking-link="${TEST_BOOKING}"`);
    res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html);
  }
  const file = join(DIST, url === '/' ? 'preview.html' : url);
  if (!existsSync(file)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': extname(file) === '.html' ? 'text/html' : 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(path, width, height = 900, opts = {}) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  if (opts.reducedMotion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(BASE + path, { waitUntil: opts.wait || 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  return { page, errs };
}
// Reveal everything (as if user scrolled) so screenshots show final state
const wantColsFor = (w) => (w > 1024 ? 3 : w >= 768 ? 2 : 1);
const revealAll = (page) => page.evaluate(() => document.querySelectorAll('.gtv-reveal,.gtv-stagger').forEach((e) => e.classList.add('gtv-in', 'gtv-done')));

const VIEWPORTS = [
  { name: 'desktop-1440', w: 1440 }, { name: 'laptop-1280', w: 1280 }, { name: 'tablet-1024', w: 1024 },
  { name: 'tablet-820', w: 820 }, { name: 'tablet-768', w: 768 }, { name: 'mobile-430', w: 430 },
  { name: 'mobile-390', w: 390 }, { name: 'mobile-360', w: 360 },
];

// ---------- 1. Standalone preview: layout, overflow, console ----------
for (const vp of VIEWPORTS) {
  const { page, errs } = await open('/preview.html', vp.w);
  await revealAll(page); await sleep(900);
  const m = await page.evaluate(() => {
    const root = document.querySelector('.f5d-gtv-page');
    const over = [...root.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width && (r.right > innerWidth + 1 || r.left < -1) && !el.closest('.gtv-glow,.gtv-sprite,.gtv-gridbg') && !el.classList.contains('gtv-glow');
    }).map((el) => el.className.baseVal ?? el.className).slice(0, 5);
    const steps = [...document.querySelectorAll('.gtv-step')].map((s) => Math.round(s.getBoundingClientRect().top));
    const cards = [...document.querySelectorAll('.gtv-services .gtv-grid-3 > *')].map((c) => Math.round(c.getBoundingClientRect().left));
    const wrap = document.querySelector('.gtv-wrap').getBoundingClientRect();
    const firstCard = document.querySelector('.gtv-card').getBoundingClientRect();
    return {
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth, over,
      timelineRow: new Set(steps).size === 1, steps: steps.length,
      cols: new Set(cards).size, gutter: Math.round(firstCard.left), h1: document.querySelectorAll('h1').length,
      h1Size: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
      ctaFull: Math.round(document.querySelector('.gtv-hero .gtv-btn').getBoundingClientRect().width),
      tCards: document.querySelectorAll('#gtv-testimonials .gtv-tcard').length,
      tCols: new Set([...document.querySelectorAll('#gtv-testimonials .gtv-tcard')].map((c) => Math.round(c.getBoundingClientRect().left))).size,
      tIllus: [...document.querySelectorAll('#gtv-testimonials .gtv-tcard')].filter((c) => { const t = c.querySelector('.gtv-illus-tag'); return t && t.getBoundingClientRect().width > 0 && /Illustrative/i.test(t.textContent); }).length,
      tNote: (() => { const n = document.querySelector('#gtv-testimonials .gtv-illus-note'); return !!n && n.getBoundingClientRect().height > 0; })(),
      avatars: [...new Set([...document.querySelectorAll('#gtv-testimonials .gtv-avatar')].map((a) => `${Math.round(a.getBoundingClientRect().width)}x${Math.round(a.getBoundingClientRect().height)}`))],
      cardH: (() => { const rows = {}; document.querySelectorAll('#gtv-testimonials .gtv-tcard').forEach((c) => { const r = c.getBoundingClientRect(); (rows[Math.round(r.top)] ||= []).push(Math.round(r.height)); }); return Object.values(rows).every((hs) => new Set(hs).size === 1); })(),
      dashItems: [...document.querySelectorAll('.gtv-dash-list li')].filter((li) => li.querySelector('.gtv-dash-ok') && li.getBoundingClientRect().height > 0).length,
      dash: (() => { const d = document.querySelector('.gtv-dash').getBoundingClientRect(); const h = document.querySelector('.gtv-h1').getBoundingClientRect(); return { l: Math.round(d.left), r: Math.round(d.right), w: Math.round(d.width), h1w: Math.round(h.width) }; })(),
      clipped: [...document.querySelectorAll('.gtv-dash-list li, .gtv-dash-meta strong, .gtv-outs span, .gtv-tcard blockquote p, .gtv-tperson strong')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      smallTaps: [...document.querySelectorAll('.f5d-gtv-page .gtv-btn')].filter((b) => b.getBoundingClientRect().height < 44).length,
    };
  });
  ok(`[${vp.name}] 6 testimonial cards in ${wantColsFor(vp.w)} col, all labelled Illustrative`, m.tCards === 6 && m.tCols === wantColsFor(vp.w) && m.tIllus === 6 && m.tNote, `cols ${m.tCols}, tags ${m.tIllus}, note ${m.tNote}`);
  ok(`[${vp.name}] testimonial avatars identical size & equal card heights per row`, m.avatars.length === 1 && m.avatars[0] === '52x52' && m.cardH, m.avatars.join(','));
  ok(`[${vp.name}] hero dashboard: 6 checked items, inside viewport`, m.dashItems === 6 && m.dash.l >= 0 && m.dash.r <= vp.w, JSON.stringify(m.dash));
  if (vp.w > 1024) ok(`[${vp.name}] dashboard does not overpower the H1 column`, m.dash.w <= 560, `${m.dash.w}px`);
  ok(`[${vp.name}] no clipped text in dashboard/testimonials`, m.clipped === 0, `${m.clipped}`);
  ok(`[${vp.name}] buttons >= 44px tall (tap targets)`, m.smallTaps === 0, `${m.smallTaps} small`);
  ok(`[${vp.name}] no horizontal overflow`, m.scrollW <= m.innerW && m.over.length === 0, `scrollWidth ${m.scrollW}/${m.innerW}${m.over.length ? ' offenders: ' + m.over.join(', ') : ''}`);
  const wantCols = vp.w > 1024 ? 3 : vp.w >= 768 ? 2 : 1;
  ok(`[${vp.name}] service grid = ${wantCols} col`, m.cols === wantCols, `got ${m.cols}`);
  const wantRow = vp.w > 1180;
  ok(`[${vp.name}] timeline ${wantRow ? 'horizontal' : 'vertical'}`, m.timelineRow === wantRow && m.steps === 6);
  if (vp.w < 768) {
    ok(`[${vp.name}] >=16px gutter`, m.gutter >= 16, `card left ${m.gutter}px`);
    ok(`[${vp.name}] full-width hero CTA`, m.ctaFull >= vp.w - 34, `${m.ctaFull}px`);
    ok(`[${vp.name}] readable H1 size`, m.h1Size >= 28 && m.h1Size <= 40, `${m.h1Size}px`);
  }
  ok(`[${vp.name}] exactly one H1`, m.h1 === 1);
  ok(`[${vp.name}] no console errors`, errs.length === 0, errs.join(' | '));
  await page.screenshot({ path: join(SHOTS, `${vp.name}.png`), fullPage: true });
  await page.close();
}

// ---------- 2. Interactions ----------
{
  const { page } = await open('/preview.html', 1440);
  // CTA links (placeholder not yet configured -> safe fallback)
  const links = await page.$$eval('[data-gtv-book]', (as) => as.map((a) => a.getAttribute('href')));
  ok('Booking CTAs fall back to /contact-us/ while [BOOKING_LINK] unset', links.length === 4 && links.every((h) => h === '/contact-us/'), links.join(', '));
  const contact = await page.$$eval('a', (as) => as.filter((a) => /Contact Our Team/.test(a.textContent)).map((a) => a.getAttribute('href')));
  ok('"Contact Our Team" links to /contact-us/', contact.length === 1 && contact[0] === '/contact-us/');
  const labels = await page.$$eval('[data-gtv-book]', (as) => as.map((a) => a.textContent.replace(/\s+/g, ' ').trim()));
  ok('Booking CTA labels', labels.every((l) => /Book (a|Your) Profile Assessment/.test(l)), labels.join(' / '));

  // Smooth scroll to process
  await page.click('[data-gtv-scroll]');
  await sleep(1600);
  const top = await page.$eval('#gtv-process', (s) => Math.round(s.getBoundingClientRect().top));
  ok('"Explore the Programme" scrolls to How It Works', Math.abs(top - 88) <= 4, `section top at ${top}px (scroll-margin 88px)`);
  ok('URL hash updated to #gtv-process', (await page.evaluate(() => location.hash)) === '#gtv-process');

  // FAQ: mouse + keyboard
  const faq = await page.$$('.gtv-faq');
  ok('9 FAQ items, all closed initially', faq.length === 9 && (await page.$$eval('.gtv-faq[open]', (d) => d.length)) === 0);
  await page.click('.gtv-faq:nth-of-type(1) summary');
  ok('FAQ opens on click', await page.$eval('.gtv-faq:nth-of-type(1)', (d) => d.open));
  const ansVisible = await page.$eval('.gtv-faq:nth-of-type(1) .gtv-faq-a', (p) => p.getBoundingClientRect().height > 20);
  ok('FAQ answer visible when open', ansVisible);
  await page.click('.gtv-faq:nth-of-type(1) summary');
  ok('FAQ closes on second click', !(await page.$eval('.gtv-faq:nth-of-type(1)', (d) => d.open)));
  await page.focus('.gtv-faq:nth-of-type(3) summary');
  await page.keyboard.press('Enter');
  ok('FAQ opens with Enter key', await page.$eval('.gtv-faq:nth-of-type(3)', (d) => d.open));
  await page.keyboard.press('Space');
  await sleep(100);
  ok('FAQ closes with Space key', !(await page.$eval('.gtv-faq:nth-of-type(3)', (d) => d.open)));

  // Keyboard focus ring on buttons
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.focus('.gtv-hero [data-gtv-book]');
  await page.keyboard.press('Tab'); await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth; });
  ok('Visible keyboard focus state on CTA', /solid 2px/.test(outline), outline);

  // Every tab stop inside the widget is reachable & labelled
  const tabStops = await page.$$eval('.f5d-gtv-page a, .f5d-gtv-page summary, .f5d-gtv-page button', (els) => els.map((e) => e.textContent.trim().length > 0));
  ok('All interactive elements have accessible text', tabStops.every(Boolean), `${tabStops.length} elements`);

  // Hover state on cards
  await page.$eval('.gtv-services', (s) => s.scrollIntoView());
  await sleep(1800); // entrance animation completes, reveal rules released
  await page.hover('.gtv-services .gtv-card'); await sleep(450);
  const tf = await page.$eval('.gtv-services .gtv-card', (c) => getComputedStyle(c).transform);
  ok('Card hover lift', tf !== 'none', tf);

  // FAQ open-state screenshot
  await page.click('.gtv-faq:nth-of-type(2) summary');
  const faqEl = await page.$('#gtv-faq');
  await faqEl.screenshot({ path: join(SHOTS, 'faq-open-desktop.png') });

  // SEO head
  const seo = await page.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name=description]')?.content,
    canon: document.querySelector('link[rel=canonical]')?.href,
    og: document.querySelector('meta[property="og:title"]')?.content,
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)['@type']),
  }));
  ok('Page title', seo.title === 'UK Global Talent Visa Programme | First500days', seo.title);
  ok('Meta description', /^Explore the UK Global Talent Visa Digital Technology programme by First500days/.test(seo.desc || ''));
  ok('Canonical URL', seo.canon === 'https://first500days.com/global-talent-visa/', seo.canon);
  ok('Open Graph title', seo.og === seo.title);
  ok('FAQPage structured data valid JSON', seo.ld.includes('FAQPage'));
  await page.close();
}

// ---------- 3. Configured booking link ----------
{
  const { page } = await open('/configured.html', 1280);
  const links = await page.$$eval('[data-gtv-book]', (as) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  ok('Configured booking URL applied to every assessment CTA', links.length === 4 && links.every(([h]) => h === TEST_BOOKING));
  ok('External booking URL opens in new tab with rel=noopener', links.every(([, t, r]) => t === '_blank' && /noopener/.test(r)));
  const sticky = await page.$eval('[data-gtv-hcta]', (a) => [a.getAttribute('href'), a.target]);
  ok('Sticky "Book Free Consultation" uses the same configured link', sticky[0] === TEST_BOOKING && sticky[1] === '_blank', sticky.join(' '));
  await page.close();
}

// ---------- 3b. Sticky CTA in the standalone preview (no site header -> floating fallback) ----------
for (const w of [1440, 390]) {
  const { page, errs } = await open('/preview.html', w);
  const s0 = await page.$eval('[data-gtv-hcta]', (a) => ({ href: a.getAttribute('href'), label: a.getAttribute('aria-label'), op: getComputedStyle(a).opacity }));
  ok(`[preview ${w}] sticky CTA -> /contact-us/ fallback, labelled "Book Free Consultation"`, s0.href === '/contact-us/' && s0.label === 'Book Free Consultation', JSON.stringify(s0));
  ok(`[preview ${w}] sticky CTA hidden over the hero (avoids duplicating the hero CTA)`, s0.op === '0');
  await page.evaluate(() => scrollTo(0, 3000)); await sleep(500);
  const s1 = await page.$eval('[data-gtv-hcta]', (a) => { const r = a.getBoundingClientRect(); return { op: getComputedStyle(a).opacity, t: Math.round(r.top), b: Math.round(r.bottom), r: Math.round(r.right), h: Math.round(r.height) }; });
  ok(`[preview ${w}] sticky CTA visible while scrolling, inside viewport, tappable`, s1.op === '1' && s1.t >= 0 && s1.b <= 900 && s1.r <= w && s1.h >= 40, JSON.stringify(s1));
  ok(`[preview ${w}] no console errors`, errs.length === 0, errs.join(' | '));
  await page.close();
}

// ---------- 4. Reduced motion: content visible without animation ----------
{
  const { page } = await open('/preview.html', 1280, 900, { reducedMotion: true });
  const hidden = await page.$$eval('.gtv-reveal, .gtv-stagger > *', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
  ok('Reduced-motion: all content visible', hidden === 0, `${hidden} hidden`);
  await page.close();
}

// ---------- 5. No-JS: content still visible ----------
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/preview.html', { waitUntil: 'load' });
  const hidden = await page.$$eval('.gtv-reveal', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length);
  ok('Without JavaScript: content visible', hidden === 0);
  await page.close();
}

// ---------- 6. Integration inside the real site shell (live header/footer/CSS) ----------
if (existsSync(join(DIST, 'integration-preview.html'))) {
  for (const vp of [{ n: 'integration-desktop-1440', w: 1440 }, { n: 'integration-mobile-390', w: 390 }]) {
    const { page, errs } = await open('/integration-preview.html', vp.w, 900, { wait: 'networkidle2' });
    await revealAll(page); await sleep(1200);
    const r = await page.evaluate(() => {
      const root = document.querySelector('.f5d-gtv-page');
      const cs = (sel, p) => getComputedStyle(root.querySelector(sel))[p];
      return {
        header: !!document.querySelector('.f5d-header, header'),
        footer: !!document.querySelector('footer, [data-elementor-type="footer"]'),
        oldBody: !!document.querySelector('.f5d-founder-visa-page'),
        scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
        font: cs('.gtv-h1', 'fontFamily'),
        btnColor: cs('.gtv-btn-primary', 'color'),
        h2Color: cs('.gtv-light .gtv-h2', 'color'),
        cardH3: cs('.gtv-card h3', 'color'),
        width: Math.round(root.getBoundingClientRect().width),
        h1s: document.querySelectorAll('h1').length,
        last: (() => { const f = document.querySelector('[data-elementor-type="footer"], footer'); const d = root.querySelector('.gtv-disclaimer'); return f && d ? Math.round(f.getBoundingClientRect().top - d.getBoundingClientRect().bottom) : null; })(),
      };
    });
    ok(`[${vp.n}] renders between existing header & footer`, r.header && r.footer && !r.oldBody);
    ok(`[${vp.n}] full-bleed width`, r.width >= vp.w - 20, `${r.width}px`);
    ok(`[${vp.n}] no horizontal overflow`, r.scrollW <= r.innerW, `${r.scrollW}/${r.innerW}`);
    ok(`[${vp.n}] theme CSS does not override widget styles`, /Poppins/.test(r.font) && r.btnColor === 'rgb(255, 255, 255)' && r.h2Color === 'rgb(11, 18, 32)' && r.cardH3 === 'rgb(11, 18, 32)', JSON.stringify({ font: r.font.split(',')[0], btn: r.btnColor, h2: r.h2Color }));
    ok(`[${vp.n}] one H1 on full page`, r.h1s === 1, `${r.h1s}`);
    ok(`[${vp.n}] disclaimer sits directly above footer`, r.last !== null && r.last >= -1 && r.last < 120, `gap ${r.last}px`);
    const own = errs.filter((e) => /gtv|f5d-gtv/i.test(e));
    ok(`[${vp.n}] no console errors from GTV widget`, own.length === 0, own.join(' | ') || (errs.length ? `${errs.length} unrelated site/third-party errors when served from localhost` : ''));
    await page.screenshot({ path: join(SHOTS, `${vp.n}.png`), fullPage: true });
    await page.close();
  }

  // Sticky "Book Free Consultation" CTA inside the real (sticky) site header, at every width
  for (const w of [1440, 1280, 1200, 1100, 1025, 1024, 768, 430, 390, 360]) {
    const { page } = await open('/integration-preview.html', w, 900, { wait: 'networkidle2' });
    await sleep(700);
    const measure = () => page.evaluate(() => {
      const R = (el) => { if (!el || getComputedStyle(el).display === 'none') return null; const r = el.getBoundingClientRect(); return r.width ? r : null; };
      const hdr = document.querySelector('.f5d-header .site-header'), hi = hdr.querySelector('.header-inner');
      const cta = document.querySelector('[data-gtv-hcta]'), c = cta.getBoundingClientRect(), hr = hdr.getBoundingClientRect();
      const obstacles = [hi.querySelector('.header-logo'), hi.querySelector('.desktop-nav'), hi.querySelector('.hamburger')].map(R).filter(Boolean);
      const hit = obstacles.some((o) => !(c.right <= o.left || c.left >= o.right || c.bottom <= o.top || c.top >= o.bottom));
      // header height with vs without the CTA (no second row / no header growth)
      const nx = cta.nextSibling, par = cta.parentNode; cta.remove(); const base = hdr.offsetHeight; par.insertBefore(cta, nx);
      return {
        mode: cta.className.replace(/gtv-hcta |gtv-hm-ready/g, '').trim(), inHeader: hdr.contains(cta), float: cta.classList.contains('gtv-hcta-float'),
        visible: getComputedStyle(cta).visibility === 'visible' && getComputedStyle(cta).opacity === '1',
        inBar: c.top >= hr.top - 1 && c.bottom <= hr.bottom + 1, inView: c.left >= 0 && c.right <= innerWidth && c.top >= 0 && c.bottom <= innerHeight,
        hit, grew: hdr.offsetHeight > base, h: Math.round(c.height), href: cta.getAttribute('href'),
        scrollW: document.documentElement.scrollWidth, text: cta.textContent.replace(/\s+/g, ' ').trim(),
      };
    });
    const a = await measure();
    await page.evaluate(() => scrollTo(0, 5000)); await sleep(700);
    const b = await measure();
    const placedOk = (x) => x.visible && x.inView && !x.hit && !x.grew && (x.float || (x.inHeader && x.inBar));
    ok(`[integration ${w}] sticky CTA placed (${a.mode}) without overlapping logo/nav/menu or growing the header`, placedOk(a), JSON.stringify(a));
    ok(`[integration ${w}] sticky CTA still visible after scrolling`, placedOk(b), JSON.stringify({ mode: b.mode, inBar: b.inBar, inView: b.inView, hit: b.hit }));
    ok(`[integration ${w}] sticky CTA -> booking destination, tappable, no overflow`, a.href === '/contact-us/' && a.h >= 39 && a.scrollW <= w, `${a.href} h${a.h} "${a.text}"`);
    if (w === 1440 || w === 390) await page.screenshot({ path: join(SHOTS, `sticky-cta-${w}-scrolled.png`) });
    await page.close();
  }
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.pass);
writeFileSync(join(SHOTS, 'test-results.json'), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in screenshots/`);
process.exit(failed.length ? 1 : 0);
