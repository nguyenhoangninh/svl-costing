// Browser check of v1.14.77: a Stock Out line marked "tiêu hao" leaves Material WIP once STEP 2 has run with it,
// STEP 3 refuses to run while the selection is newer than STEP 2, STEP 2 rebuilds STEP 3, and the WIP journal
// (JE02 / JE02B) follows the WIP figures.
// Usage: node test/e2e-consumption.mjs http://127.0.0.1:8765/ /path/to/erp-folder /path/to/costing.xlsm
// The ERP folder must hold the STOCK OUT / PC / MI / MR reports for 202608 (synthetic or company data — nothing is written to disk).
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [, , base = 'http://127.0.0.1:8765/', erpDir = '../fixtures/erp', wbPath = '../costing.xlsm'] = process.argv;
const files = fs.readdirSync(erpDir).filter((f) => f.endsWith('.xlsx')).map((f) => path.join(erpDir, f));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// serviceWorkers: 'block' — the app's service worker would answer the SDK imports from its cache and bypass the stand-in
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
// the ERP anomaly confirmation asks for a note (prompt); the test gives one
context.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Kiểm thử e2e v1.14.77: xác nhận để chạy STEP 2' : undefined));
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };

const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL') && !m.text().includes('Failed to load resource')) errors.push('console: ' + m.text()); });
await installFakeFirebase(page);

/** vi-VN number text ("202.200", "-20.786.171,66") to a number */
const amt = (s) => Number(String(s).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
const toasts = () => page.$$eval('#toasts .toast', (els) => els.map((e) => e.textContent));
/** drop the toasts still on screen, so a match is always the message of the step just clicked */
const clearToasts = () => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()));
/** the first toast matching re, polled while it is on screen (toasts fade after ~4.5 s) */
async function toastOf(re, timeout = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const hit = (await toasts()).find((x) => re.test(x)); if (hit) return hit; await sleep(250); }
  return null;
}
/** wait until the app's busy overlay (#busy) is gone, so a click reaches its button */
const settle = () => page.waitForFunction(() => { const b = document.getElementById('busy'); if (!b) return true; const cs = getComputedStyle(b); return cs.display === 'none' || cs.visibility === 'hidden' || b.offsetParent === null; }, null, { timeout: 240000 });
async function go(hash) { await page.goto(base + hash); await sleep(900); }
/** the flow strip of STEP 3: [Opening, MI, Stock Out in, PC, MR, Stock Out out, Closing] */
async function flowValues() {
  return page.$$eval('.flow .fb b', (els) => els.map((e) => e.textContent));
}
/** JE rows of the STEP 3 journal, keyed by JE code → amount text (last column; v1.14.79 added the Khách hàng column) */
async function journal() {
  return page.$$eval('table.cp tr', (rows) => Object.fromEntries(rows.map((r) => [...r.children].map((c) => c.textContent.trim())).filter((c) => /^JE\d/.test(c[0] || '')).map((c) => [c[0], c[c.length - 1]])));
}

// ---------- load: workbook (opening WIP, settings) then the ERP reports
await page.goto(base + '#settings');
await page.waitForFunction(() => document.querySelector('#account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });
await sleep(1500);
await go('#step1');
await page.waitForSelector('#f-files', { state: 'attached', timeout: 30000 });
await page.setInputFiles('#f-files', files);
await sleep(4000);
// STEP 1: confirm each ERP anomaly part (A–D) that is still open, as the user would before STEP 2
await go('#step1');
for (let i = 0; i < 8; i++) {
  await settle();
  if (!(await page.$('[data-act="dq-confirm"]'))) break;
  await page.click('[data-act="dq-confirm"]');
  await toastOf(/Đã xác nhận phần/, 60000);
  await sleep(500);
}

// ---------- STEP 2 and STEP 3 on the imported reports
await go('#step2');
await page.waitForSelector('[data-act="run-step2"]', { timeout: 60000 });
await settle(); await clearToasts(); await page.click('[data-act="run-step2"]');
const s2first = await toastOf(/STEP 2 xong|STEP 2 dừng|STEP 2 bị chặn/);
ok('STEP 2 runs on the imported reports', !!s2first && /STEP 2 xong/.test(s2first), s2first || 'no toast');
await page.waitForSelector('input[data-cons]', { state: 'attached', timeout: 60000 });
const pick = await page.evaluate(() => {
  // a line with a non-zero amount (zero is shown as "–"), T first
  const rows = [...document.querySelectorAll('.s2-cons tbody tr[data-q]')].filter((tr) => !['–', '-', '0', ''].includes(tr.lastElementChild.textContent.trim()));
  const r = rows.find((tr) => tr.dataset.erp === 'T') || rows[0];
  if (!r) return null;
  const cb = r.querySelector('input[data-cons]');
  return { key: cb.dataset.cons, text: r.lastElementChild.textContent.trim() };
});
ok('a Stock Out line is available to mark as consumption', !!pick, JSON.stringify(pick));
await go('#step3');
await page.waitForSelector('[data-act="run-step3"]', { timeout: 60000 });
await settle(); await clearToasts(); await page.click('[data-act="run-step3"]');
const s3first = await toastOf(/STEP 3 xong|STEP 3 dừng/);
ok('STEP 3 runs before any consumption is marked', !!s3first && /STEP 3 xong/.test(s3first), s3first || 'no toast');
const before = await flowValues();
const soBefore = amt(before[2]);

// ---------- mark the line on STEP 2 only (no STEP 2 re-run yet)
await go('#step2');
await page.waitForSelector('input[data-cons]', { state: 'attached', timeout: 60000 });
const lineAmt = amt(pick.text);
await page.evaluate(() => { const d = document.querySelector('.cons-pick'); if (d) d.open = true; });
await settle();
await page.check(`input[data-cons="${pick.key}"]`);
await sleep(600);
ok('STEP 2 warns that the consumption list changed after the last run', (await page.$$('#cons-stale .alert')).length === 1);
const postedBefore = await page.$eval('#cons-stats tr.tot td:last-child', (td) => td.textContent.trim());

// ---------- STEP 3 must refuse to run on the old STEP 2
await go('#step3');
await page.waitForSelector('[data-act="run-step3"]', { timeout: 60000 });
await settle(); await clearToasts(); await page.click('[data-act="run-step3"]');
const refused = await toastOf(/Danh sách tiêu hao đã đổi/);
ok('STEP 3 is refused while the consumption list is newer than STEP 2', !!refused, refused || 'no toast');
ok('the WIP Stock Out is unchanged by the refused run', amt((await flowValues())[2]) === soBefore);
ok('STEP 3 shows that WIP does not match STEP 2 yet', (await page.textContent('body')).includes('WIP chưa khớp STEP 2 hiện tại'));

// ---------- STEP 2 re-run rebuilds STEP 3 at once
await go('#step2');
await page.waitForSelector('[data-act="run-step2"]', { timeout: 60000 });
await settle(); await clearToasts(); await page.click('[data-act="run-step2"]');
const s2again = await toastOf(/STEP 2 xong|STEP 2 dừng|STEP 2 bị chặn/);
ok('STEP 2 re-run mentions STEP 3 was rebuilt', !!s2again && /STEP 3 đã tính lại theo STEP 2 mới\./.test(s2again), s2again || 'no toast');
const posted = await page.$eval('#cons-stats tr.tot td:last-child', (td) => td.textContent.trim());
ok('STEP 2 posts the marked line to 632 / 152', amt(posted) === lineAmt, `posted ${posted} vs line ${pick.text}`);

await go('#step3');
await page.waitForSelector('.flow .fb b', { timeout: 60000 });
const after = await flowValues();
const soAfter = amt(after[2]);
ok('WIP Stock Out falls by the consumption line', Math.abs((soBefore - soAfter) - lineAmt) < 1, `before ${before[2]} after ${after[2]} line ${pick.text}`);
ok('no WIP mismatch warning after the re-run', !(await page.textContent('body')).includes('WIP chưa khớp STEP 2 hiện tại'));
await go('#cc'); await page.waitForSelector('table.cp', { timeout: 60000 });
const je = await journal();
ok('JE02 (Stock Out in WIP) equals the WIP Stock Out figure', Math.abs(amt(je.JE02) - soAfter) < 1, `JE02 ${je.JE02} vs WIP ${after[2]}`);
ok('JE02B (632 / 152) equals the consumption posted by STEP 2', Math.abs(amt(je.JE02B) - amt(posted)) < 1, `JE02B ${je.JE02B} vs STEP 2 ${posted}`);
ok('JE02 + JE02B = the full Stock Out before the change (nothing lost between 154 and 632)', Math.abs(amt(je.JE02) + amt(je.JE02B) - soBefore) < 1, `${je.JE02} + ${je.JE02B} vs ${before[2]}`);

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${n - fail}/${n} consumption checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
