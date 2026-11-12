// Capture each page section separately (inside the real site shell) for visual review.
//   node tools/shoot-sections.mjs [width]
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'screenshots', 'sections');
mkdirSync(OUT, { recursive: true });
const W = +(process.argv[2] || 1440);

const srv = createServer((q, r) => {
  const f = join(ROOT, 'dist', q.url.split('?')[0]);
  if (q.url === '/' || !existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(readFileSync(f));
}).listen(0);

const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((x) => x && existsSync(x));
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage();
await p.setViewport({ width: W, height: 900, isMobile: W < 768 });
await p.goto(`http://127.0.0.1:${srv.address().port}/integration-preview.html`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
// Hide the live site's own auto-opening Tally popup + cookie banner (site behaviour, not the widget)
await p.addStyleTag({ content: '.tally-popup,.tally-overlay,[class*="tally-"][class*="popup"],.cmplz-cookiebanner,.cmplz-soft-cookiewall{display:none!important}html,body{overflow:visible!important}' });
await p.evaluate(() => {
  document.querySelectorAll('iframe[src*="tally"]').forEach((f) => { let n = f; while (n.parentElement && n.parentElement !== document.body) n = n.parentElement; n.remove(); });
  document.querySelectorAll('.gtv-reveal,.gtv-stagger').forEach((e) => e.classList.add('gtv-in', 'gtv-done'));
});
await new Promise((r) => setTimeout(r, 800));

const sections = await p.$$('.f5d-gtv-page > section');
for (let i = 0; i < sections.length; i++) {
  await sections[i].screenshot({ path: join(OUT, `${W}-${String(i + 1).padStart(2, '0')}.png`) });
}
await p.evaluate(() => scrollTo(0, 0));
await p.screenshot({ path: join(OUT, `${W}-00-header-hero.png`) });
const d = await (await p.$('.gtv-disclaimer')).boundingBox();
await p.screenshot({ path: join(OUT, `${W}-99-disclaimer-footer.png`), clip: { x: 0, y: d.y - 150, width: W, height: 800 }, captureBeyondViewport: true });
console.log(`${sections.length} sections captured at ${W}px`);
await b.close(); srv.close();
