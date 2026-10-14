// Browser check of STEP 1 card C (v1.14.48: negative / text lines AND the flagged MI-M unit-cost lines, one confirmation):
// the card lists the MI-M lines, the confirm button asks for a note, and the confirmed card shows the confirmation.
// The stand-in does not enforce rules.
// Usage: node test/e2e-step1-c.mjs http://127.0.0.1:8765/ /path/to/erp-folder /path/to/costing.xlsm
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';
import path from 'node:path';

const [, , base = 'http://127.0.0.1:8765/', erpDir = '../fixtures/erp', wbPath = '../costing.xlsm'] = process.argv;
const files = ['MI-M-T-202608.xlsx', 'MI-M-S-202608.xlsx', 'MI-M-O-202608.xlsx'].map((f) => path.join(erpDir, f));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
const dialogs = [];
context.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(d.type() === 'prompt' ? 'Kiểm thử: định mức đã rà soát' : undefined); });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };

const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await installFakeFirebase(page);
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

const card = page.locator('section.dq-card', { hasText: 'C · Vật tư số âm' });
ok('card C shows the flagged MI-M lines', (await card.count()) === 1 && (await card.locator('#t-dq-mc tbody tr').count()) > 0, `${await card.locator('#t-dq-mc tbody tr').count()} dòng`);
ok('there is no separate card D', (await page.locator('section.dq-card', { hasText: 'D · ' }).count()) === 0);
ok('card C asks for confirmation before STEP 2', (await card.locator('button[data-part="C"]').count()) === 1);
await card.locator('button[data-part="C"]').click();
await sleep(1500);
const cardAfter = page.locator('section.dq-card', { hasText: 'C · Vật tư số âm' });
const txt = ((await cardAfter.textContent()) || '').replace(/\s+/g, ' ');
ok('after confirming, card C shows who confirmed and the note', /Đã xác nhận bởi/.test(txt) && /Kiểm thử: định mức đã rà soát/.test(txt));
ok('the confirm dialog listed the material lines', dialogs.some((m) => /Xác nhận phần C/.test(m) && /MI-M/.test(m)));
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${n - fail}/${n} STEP 1 card C browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
await browser.close();
process.exit(fail ? 1 : 0);
