// Visual + geometry audit of the hero, sticky header CTA and testimonials inside the real site shell.
//   node tools/audit-header.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'screenshots', 'audit');
mkdirSync(OUT, { recursive: true });
const srv = createServer((q, r) => {
  const f = join(ROOT, 'dist', q.url.split('?')[0]);
  if (q.url === '/' || !existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(readFileSync(f));
}).listen(0);
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((x) => x && existsSync(x));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const widths = (process.argv[2] || '1440,1280,1100,1025,1024,768,430,390,360').split(',').map(Number);

for (const W of widths) {
  const p = await b.newPage();
  await p.setViewport({ width: W, height: W < 768 ? 800 : 900, isMobile: W < 768, hasTouch: W < 768 });
  await p.goto(`http://127.0.0.1:${srv.address().port}/integration-preview.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);
  await p.addStyleTag({ content: '.tally-popup,.tally-overlay,[class*="tally-"][class*="popup"],.cmplz-cookiebanner,.cmplz-soft-cookiewall{display:none!important}html,body{overflow:visible!important}' });
  await p.evaluate(() => {
    document.querySelectorAll('iframe[src*="tally"]').forEach((f) => { let n = f; while (n.parentElement && n.parentElement !== document.body) n = n.parentElement; n.remove(); });
    document.querySelectorAll('.gtv-reveal,.gtv-stagger').forEach((e) => e.classList.add('gtv-in', 'gtv-done'));
  });
  await sleep(600);
  const geo = await p.evaluate(() => {
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && getComputedStyle(el).display !== 'none' ? { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } : null; };
    const hi = document.querySelector('.f5d-header .header-inner');
    return {
      logo: R(hi.querySelector('.header-logo')), nav: R(hi.querySelector('.desktop-nav')), siteCta: R(hi.querySelector('.header-cta')),
      cta: R(document.querySelector('[data-gtv-hcta]')), mode: document.querySelector('[data-gtv-hcta]').className, burger: R(hi.querySelector('.hamburger')), header: R(document.querySelector('.f5d-header .site-header')),
      scrollW: document.documentElement.scrollWidth,
      inner: (() => { const s = getComputedStyle(hi); return `${Math.round(hi.getBoundingClientRect().width)}w pad ${s.paddingLeft}/${s.paddingRight} gap ${s.columnGap} wrap ${s.flexWrap}`; })(),
      baseline: (() => { const c = document.querySelector('[data-gtv-hcta]'); const nx = c.nextSibling, par = c.parentNode; c.remove(); const h = Math.round(document.querySelector('.f5d-header .site-header').getBoundingClientRect().height); par.insertBefore(c, nx); return h; })(),
    };
  });
  console.log(W, JSON.stringify(geo));
  await p.screenshot({ path: join(OUT, `${W}-top.png`) });
  await p.evaluate(() => scrollTo(0, 4000)); await sleep(500);
  const stuck = await p.evaluate(() => Math.round(document.querySelector('[data-gtv-hcta]').getBoundingClientRect().top));
  console.log('   after scroll, CTA top =', stuck);
  await p.screenshot({ path: join(OUT, `${W}-scrolled.png`) });
  const t = await p.$('#gtv-testimonials');
  await t.screenshot({ path: join(OUT, `${W}-testimonials.png`) });
  await p.close();
}
await b.close(); srv.close();
