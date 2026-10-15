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
ok('card C blocks STEP 2 until the MI-M prices are confirmed (v1.14.65)', (await card.locator('button[data-part="C"]').count()) === 1 && /BLOCK/.test((await card.locator('h3').textContent()) || ''));
await card.locator('button[data-part="C"]').click();
await sleep(1500);
const cardCAfter = page.locator('section.dq-card', { hasText: 'C · Vật tư số âm' });
ok('after confirming, card C shows who confirmed', /Đã xác nhận bởi/.test(((await cardCAfter.textContent()) || '')));
ok('the confirm dialog listed the MI-M lines', dialogs.some((m) => /Xác nhận phần C/.test(m) && /MI-M/.test(m)));
// v1.14.62: filters – system and status – and export of the filtered rows
const tbl = card.locator('#t-dq-mc');
const sels = tbl.locator('select.vt-filter');
ok('the MI-M table has a system filter and a status filter', (await sels.count()) === 2);
const cnt = async () => { const t = ((await tbl.locator('.vt-count').textContent()) || '').replace(/\./g, ''); const m = t.match(/(\d+)/g) || []; return +m[0] || 0; };
const allN = await cnt();
await sleep(3000); // let the page finish its first render before changing the filters
await sels.nth(1).selectOption({ label: 'Review - Abnormal' }); await sleep(300);
const flaggedN = await cnt();
await sels.nth(1).selectOption({ label: 'OK - Normal' }); await sleep(300);
const okN = await cnt();
ok('status filter: Review - Abnormal + OK - Normal = all lines', flaggedN + okN === allN && allN > 0, `${flaggedN} + ${okN} = ${allN}`);
await sels.nth(1).selectOption({ value: '' }); await sleep(200);
const systems = await sels.nth(0).locator('option').allTextContents();
ok('system filter lists the systems, not statuses', systems.length >= 2 && !systems.some((x) => /Review|OK -/.test(x)), systems.join(' | '));
const dlP = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
await tbl.locator('xpath=..').locator('button.vt-export').click();
const dl = await dlP;
ok('export downloads a file named for the MI-M line list', !!dl && /01_DON_GIA_XUAT_NVL_MI_M_DONG/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : 'no download');
// v1.14.63 / v1.14.64: card D – PC-lot unit cost (PC-P): blocking like C, with filters and export
const cardD = page.locator('section.dq-card', { hasText: 'D · Đơn giá thành phẩm theo lô PC' });
ok('card D exists next to C', (await cardD.count()) === 1);
ok('card D asks for confirmation before STEP 2 (flagged PC lots)', (await cardD.locator('button[data-part="D"]').count()) === 1);
const tblD = cardD.locator('#t-dq-pc');
ok('card D lists the PC lots with rows', (await tblD.locator('tbody tr[data-v]').count()) > 0);
ok('card D has a system filter and a status filter', (await tblD.locator('select.vt-filter').count()) === 2);
await cardD.locator('button[data-part="D"]').click();
await sleep(1500);
const cardDAfter = page.locator('section.dq-card', { hasText: 'D · Đơn giá thành phẩm theo lô PC' });
const txtD = ((await cardDAfter.textContent()) || '').replace(/\s+/g, ' ');
ok('after confirming, card D shows who confirmed', /Đã xác nhận bởi/.test(txtD));
ok('the confirm dialog listed the PC lots by system', dialogs.some((m) => /Xác nhận phần D/.test(m) && /PC-P hệ/.test(m)));
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${n - fail}/${n} STEP 1 card C browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
await browser.close();
process.exit(fail ? 1 : 0);
