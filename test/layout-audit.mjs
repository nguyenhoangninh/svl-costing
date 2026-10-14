// Responsive layout audit (v1.14.49): loads the app with the synthetic Firebase stand-in and the workbook, then for each
// viewport (phone → 4K) checks that no element sticks out of the viewport outside a scrolling container, and saves screenshots.
// Usage: node test/layout-audit.mjs http://127.0.0.1:8765/ /path/to/costing.xlsm /path/to/erp-folder /path/to/outDir
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';
import path from 'node:path';
import fs from 'node:fs';

const [, , base = 'http://127.0.0.1:8765/', wbPath = '../costing.xlsm', erpDir = '../fixtures/erp', outDir = '/tmp/layout-audit'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 740, dpr: 2 },
  { name: 'phone-390', width: 390, height: 844, dpr: 3 },
  { name: 'tablet-768', width: 768, height: 1024, dpr: 2 },
  { name: 'laptop-1366', width: 1366, height: 768, dpr: 1 },
  { name: 'laptop-1440', width: 1440, height: 900, dpr: 2 },
  { name: 'desktop-1920', width: 1920, height: 1080, dpr: 1 },
  { name: 'qhd-2560', width: 2560, height: 1440, dpr: 1 },
  { name: 'uhd-3840', width: 3840, height: 2160, dpr: 1 },
];
const VIEWS = ['step1', 'settings'];
const files = ['MI-M-T-202608.xlsx', 'MI-M-S-202608.xlsx', 'MI-M-O-202608.xlsx'].map((f) => path.join(erpDir, f));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
context.on('dialog', (d) => d.accept());
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await installFakeFirebase(page);

// load the data once at desktop size
await page.goto(base + '#settings');
await page.waitForFunction(() => document.querySelector('#account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });
await sleep(1500);
await page.goto(base + '#step1');
await page.waitForSelector('#f-files', { state: 'attached', timeout: 30000 });
await page.setInputFiles('#f-files', files);
await page.waitForSelector('#mc-dev', { timeout: 240000 });
await sleep(1000);

// elements whose box extends past the viewport and that are not inside a horizontally scrolling box
const overflowProbe = () => {
  const vw = document.documentElement.clientWidth;
  const scrollable = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  const bad = [];
  for (const el of document.querySelectorAll('main *, #rail *, header *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 && !scrollable(el)) bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className || '').split(' ')[0]} → right ${Math.round(r.right)}`);
  }
  return { vw, docOverflow: document.documentElement.scrollWidth - vw, bad: bad.slice(0, 8), n: bad.length };
};

const report = [];
for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const v of VIEWS) {
    await page.goto(base + '#' + v);
    await sleep(900);
    const res = await page.evaluate(overflowProbe);
    report.push({ vp: vp.name, view: v, ...res });
    await page.screenshot({ path: path.join(outDir, `${vp.name}-${v}.png`), fullPage: false });
  }
}
for (const r of report) console.log(`${r.vp.padEnd(13)} ${r.view.padEnd(9)} docOverflow=${r.docOverflow}px  offenders=${r.n}${r.bad.length ? '  e.g. ' + r.bad.slice(0, 3).join(' | ') : ''}`);
const bad = report.filter((r) => r.docOverflow > 1 || r.n > 0);
console.log('page errors:', errors.length ? errors.slice(0, 3) : 'none');
console.log(bad.length ? `${bad.length} layout problem(s)` : 'layout: no horizontal overflow on any viewport');
await browser.close();
process.exitCode = bad.length || errors.length ? 1 : 0;
