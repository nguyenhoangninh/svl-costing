// Browser check of the VI / EN switch (v1.14.59): header button, page text, re-render, switch back, persistence.
// Usage: node test/e2e-i18n.mjs http://127.0.0.1:8765/ /path/to/costing.xlsm
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';

const [, , base = 'http://127.0.0.1:8765/', wbPath = '../costing.xlsm'] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
context.on('dialog', (d) => d.accept());
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };
const open = async () => { const p = await context.newPage(); p.on('pageerror', (e) => errors.push(e.message)); await installFakeFirebase(p); return p; };
const text = (p) => p.evaluate(() => document.body.innerText);

let page = await open();
await page.goto(base + '#settings');
await page.waitForFunction(() => document.querySelector('#account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });
await sleep(4000);
await page.goto(base + '#cc'); await sleep(1000);
ok('starts in Vietnamese', (await text(page)).includes('Tổng quan kỳ') && (await page.textContent('#lang')).trim() === 'EN');

await page.click('#lang'); await sleep(800);
let t = await text(page);
ok('EN: page and navigation in English', t.includes('Period overview') && t.includes('Stock Out allocation') && t.includes('Sign out'), t.slice(0, 80).replace(/\s+/g, ' '));
ok('EN: html lang and button switch', (await page.evaluate(() => document.documentElement.lang)) === 'en' && (await page.textContent('#lang')).trim() === 'VI');
ok('EN: overview figures translated', t.includes('WIP · work in progress') && t.includes('Finished goods · COGS'));

await page.goto(base + '#step5'); await sleep(1200);
t = await text(page);
ok('EN: another screen renders in English (STEP 5.2)', t.includes('FIFO COGS & FIFO rework') && t.includes('FIFO mode'));
await page.goto(base + '#step2'); await sleep(1200);
t = await text(page);
ok('EN: tables and placeholders translated (STEP 2)', t.includes('Amounts by rule') && (await page.locator('input[placeholder^="Search"]').count()) > 0);

await page.click('#lang'); await sleep(800);
t = await text(page);
ok('back to VI: Vietnamese restored, including the header', t.includes('Số tiền theo rule') && t.includes('Đăng xuất') && !t.includes('Sign out'));

await page.click('#lang'); await sleep(500);
await page.close();
page = await open();
await page.goto(base + '#cc');
await page.waitForFunction(() => document.querySelector('#account')?.textContent?.length > 0, null, { timeout: 30000 });
await sleep(1200);
ok('choice remembered on a new page (EN)', (await text(page)).includes('Sign out') && (await page.textContent('#lang')).trim() === 'VI');

// v1.14.72: the 5P tab and the labels the app writes itself, in both languages (the page is in English here)
await page.goto(base + '#provision'); await sleep(1200);
t = await text(page);
ok('EN: 5P tab title in English', t.includes('FG provision · TK 2294') && !t.includes('Dự phòng FG · TK 2294'));
await page.goto(base + '#rework'); await sleep(1200);
t = await text(page);
ok('EN: app-written column headers in English (rework)', t.includes('Rework ID') && !t.includes('Mã rework'));
await page.click('#lang'); await sleep(800);
t = await text(page);
ok('VI: app-written column headers in Vietnamese (rework)', t.includes('Mã rework') && !t.includes('Rework ID'));
await page.goto(base + '#provision'); await sleep(1200);
t = await text(page);
ok('VI: 5P tab title in Vietnamese', t.includes('Dự phòng FG · TK 2294') && !t.includes('FG provision · TK 2294'));
await page.evaluate(() => { try { localStorage.removeItem('svl.lang'); } catch {} });

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${n - fail}/${n} language switch browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
await browser.close();
process.exit(fail ? 1 : 0);
