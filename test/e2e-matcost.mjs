// Browser check of the STEP 1 unit-cost threshold controls (v1.14.46): change, persist across a fresh page, reset.
// Usage: node test/e2e-matcost.mjs http://127.0.0.1:8765/ /path/to/erp-folder /path/to/costing.xlsm
// The ERP folder must hold MI-M-{T,S,O}-202608.xlsx (synthetic or company data — nothing is written to disk).
// The threshold lives in localStorage of this browser, so a second page in the same context must show it again.
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';
import path from 'node:path';

const [, , base = 'http://127.0.0.1:8765/', erpDir = '../fixtures/erp', wbPath = '../costing.xlsm'] = process.argv;
const files = ['MI-M-T-202608.xlsx', 'MI-M-S-202608.xlsx', 'MI-M-O-202608.xlsx'].map((f) => path.join(erpDir, f));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// serviceWorkers: 'block' — the app's service worker would answer the SDK imports from its cache and bypass the stand-in
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
context.on('dialog', (d) => d.accept());
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };

async function openPage() {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL') && !m.text().includes('Failed to load resource')) errors.push('console: ' + m.text()); });
  await installFakeFirebase(page);
  return page;
}

/** Sign in (the fake is signed in), load the workbook and the MI-M reports, open STEP 1. */
async function loadAll(page) {
  await page.goto(base + '#settings');
  await page.waitForFunction(() => document.querySelector('#account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
  await page.waitForSelector('#f-xlsm', { state: 'attached' });
  await page.setInputFiles('#f-xlsm', wbPath);
  await page.waitForSelector('#mig table', { timeout: 240000 });
  await sleep(1500);
  await page.goto(base + '#step1');
  await page.waitForSelector('#f-files', { state: 'attached', timeout: 30000 });
  await page.setInputFiles('#f-files', files);
  await page.waitForSelector('#mc-dev', { timeout: 240000 });
  await sleep(1000);
}
const flaggedLinesCount = (page) => page.locator('#t-mc-lines tbody tr').count().catch(() => 0);
const stored = (page) => page.evaluate(() => localStorage.getItem('svl.matcostOpts'));

let page = await openPage();
await loadAll(page);

ok('default threshold shows 30 %', (await page.inputValue('#mc-dev')) === '30');
const lines0 = await flaggedLinesCount(page);

await page.fill('#mc-dev', '250'); await page.dispatchEvent('#mc-dev', 'change'); await sleep(1200);
const lines1 = await flaggedLinesCount(page);
ok('raising the threshold to 250 % changes the flagged-line list', lines1 !== lines0, `${lines0} → ${lines1} lines`);
ok('threshold 250 % is stored on this device', JSON.parse((await stored(page)) || 'null')?.dev === 2.5);

// fresh page in the same browser profile: the stored threshold must be applied again
await page.close();
page = await openPage();
await loadAll(page);
ok('threshold survives a new page load', (await page.inputValue('#mc-dev')) === '250');
ok('the flagged-line list keeps the 250 % result', (await flaggedLinesCount(page)) === lines1);

await page.click('#mc-reset'); await sleep(1000);
ok('reset restores 30 % and clears the stored value', (await page.inputValue('#mc-dev')) === '30' && (await stored(page)) === null);

await page.fill('#mc-dev', '0'); await page.dispatchEvent('#mc-dev', 'change'); await sleep(600);
ok('invalid threshold 0 % is refused (nothing stored)', (await stored(page)) === null);

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${n - fail}/${n} STEP 1 unit-cost threshold browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
await browser.close();
process.exit(fail ? 1 : 0);
