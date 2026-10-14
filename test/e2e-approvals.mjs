// Browser run of the STEP 5R manual-cost maker–checker (v1.14.41) against the in-memory Firebase stand-in.
// Receipts are written straight to svl_costing_periods/{period}/approvals by the app (no Cloud Functions on the Spark plan).
// The stand-in does NOT enforce firestore.rules; those are checked by reading the rule text in test/rules-contract.mjs
// and the identity logic in test/approvals-logic.mjs.
// Usage: node test/e2e-approvals.mjs http://127.0.0.1:8765/ /path/costing.xlsm <outDir> <returnsFile.xlsx>
// returnsFile: a sales-returns workbook for 2026-08 with one SALES RETURN line that has quantity and no original invoice
// (so STEP 5R needs a manual unit cost). Header: Invoice Date, Product Number, Quantity, Amount (USD), Transaction Type.
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';
import { approvalDocId, ACTION_MANUAL_COST } from '../src/engine/approvals.js';
import path from 'node:path';

const [, , base = 'http://127.0.0.1:8765/', wbPath = '/home/claude/costing.xlsm', outDir = '.', retPath] = process.argv;
if (!retPath) { console.error('Thiếu đường dẫn file hàng trả lại (tham số thứ 4).'); process.exit(2); }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errors.push('console: ' + m.text()); });
page.on('dialog', async (d) => { await d.accept(); });
await installFakeFirebase(page);

let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };
const F = (fn, ...a) => page.evaluate(fn, ...a);
const sleep = (ms) => page.waitForTimeout(ms);
const sig = (u) => F((x) => { const S = window.__fake; S.uid = x.uid; S.email = x.email; S.signedIn = true; S.listeners.forEach((cb) => setTimeout(() => cb({ uid: x.uid, email: x.email, displayName: x.email }), 0)); }, u);
const receipt = (key) => F((id) => window.__fake.docs.get(`svl_costing_periods/2026-08/approvals/${id}`) || null, approvalDocId(ACTION_MANUAL_COST, key));
const rowFor = (key) => page.locator(`#t5r-fix tr[data-k="${key}"]`);
const rowText = async (key) => ((await rowFor(key).textContent().catch(() => '')) || '').replace(/\s+/g, ' ');

await page.goto(base + '#settings');
await page.waitForFunction(() => document.querySelector('#account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });
await sleep(1500);

// 0) import and save one sales-return line for 2026-08 (no original invoice → manual unit cost needed)
await page.goto(base + '#salesreturn'); await sleep(800);
await page.click('[data-tab5r=import]'); await sleep(800);
await page.selectOption('#r-mode', 'MONTHLY');
await page.setInputFiles('#f-ret', retPath);
await sleep(2500);
await page.click('[data-act=ret-save]'); await sleep(2500);
// STEP 4 then STEP 5.2 FIFO first (STEP 4 re-run made it OUTDATED), then STEP 5R
await page.goto(base + '#step4'); await page.click('[data-act=run-step4]'); await sleep(1500);
await page.goto(base + '#step5'); await sleep(800);
await page.click('[data-act=s5-run]'); await sleep(3000);
await page.goto(base + '#salesreturn'); await sleep(800);
await page.click('[data-act=s5r-run]').catch(() => {}); await sleep(2000);
try { await page.waitForSelector('#t5r-fix tbody tr', { timeout: 60000 }); } catch (e) {
  console.log('DIAG #t5r-box:', ((await page.locator('#t5r-box').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 1200));
  throw e;
}
const key = await page.locator('#t5r-fix tbody tr').first().getAttribute('data-k');

// 1) maker (admin) records a manual unit cost: the app writes a REQUESTED receipt stamped with the maker
// the invoice box is pre-filled for AUTO-MATCHED lines: clear it so the manual cost is the one that applies
await rowFor(key).locator('input[name=origInv]').fill('');
await rowFor(key).locator('input[name=unitCost]').fill('1234500');
await rowFor(key).locator('input[name=note]').fill('Căn cứ: đơn giá nhập trước kỳ web (kiểm thử)');
await rowFor(key).locator('[data-5r-save]').click();
await sleep(2500);
const rec1 = await receipt(key);
ok('maker save writes a REQUESTED receipt stamped with the maker', rec1 && rec1.status === 'REQUESTED' && rec1.requestedByEmail === 'admin.test@example.com', rec1 ? `${rec1.status} by ${rec1.requestedByEmail}` : 'no receipt');
ok('receipt holds the entered values and canonical text', rec1 && rec1.values.unitCost === 1234500 && rec1.values.origInv === '' && rec1.canonical.length > 0 && rec1.approvedByEmail === '');
// the same entry with an invoice AND a unit cost is refused before any request goes out
await rowFor(key).locator('input[name=origInv]').fill('O-INV-2608-006');
await rowFor(key).locator('[data-5r-save]').click(); await sleep(1500);
ok('an entry with both invoice and unit cost is refused (no receipt change)', (await receipt(key)).values.origInv === '');
await rowFor(key).locator('input[name=origInv]').fill('');
await rowFor(key).locator('[data-5r-save]').click(); await sleep(2000);
ok('maker sees "waiting for someone else" and no approve button', (await rowText(key)).includes('Chờ người khác duyệt') && (await rowFor(key).locator('[data-5r-approve]').count()) === 0);
// control: before approval, STEP 5R must report the line as unprocessed (so the check after approval is meaningful)
await page.click('[data-act=s5r-run]').catch(() => {}); await sleep(2000);
const preText = ((await page.locator('#t5r-box').textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
ok('control: before approval STEP 5R reports the line as unprocessed', /chưa xử lý/.test(preText));

// 2) a different editor approves in the UI
await F(() => { window.__fake.docs.set('svl_costing_config/access', { members: { 'b.test@example.com': 'editor' } }); });
await sig({ uid: 'uid-b', email: 'b.test@example.com' }); await sleep(2500);
await page.goto(base + '#salesreturn'); await page.waitForSelector('#t5r-fix tbody tr', { timeout: 30000 }); await sleep(800);
ok('second editor sees the approve button for the pending line', (await rowFor(key).locator('[data-5r-approve]').count()) === 1);
await rowFor(key).locator('[data-5r-approve]').click(); await sleep(2500);
const rec2 = await receipt(key);
ok('approval is written with the approver identity and uid', rec2 && rec2.status === 'APPROVED' && rec2.approvedByEmail === 'b.test@example.com' && rec2.approvedByUid === 'uid-b' && rec2.requestedByEmail === 'admin.test@example.com', rec2 ? `${rec2.status} by ${rec2.approvedByEmail}` : '');
ok('row shows the approval', (await rowText(key)).includes('Đã duyệt: b.test@example.com'));

// 3) the approved line now counts in STEP 5R
await page.click('[data-act=s5r-run]').catch(() => {}); await sleep(2000);
const runText = ((await page.locator('#t5r-box').textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
ok('after approval, STEP 5R no longer reports this line as unprocessed', !/chưa xử lý/.test(runText));
ok('after approval, the line is costed with the approved manual unit cost', /manual unit cost 1234500/.test(runText), runText.match(/manual unit cost[^|]{0,60}/)?.[0] || 'message not found');

// 4) change the value after approval: the old approval stops counting and a new request replaces it
await sig({ uid: 'uid-admin', email: 'admin.test@example.com' }); await sleep(2500);
await page.goto(base + '#salesreturn'); await page.waitForSelector('#t5r-fix tbody tr', { timeout: 30000 }); await sleep(800);
await rowFor(key).locator('input[name=unitCost]').fill('1500000');
await rowFor(key).locator('[data-5r-save]').click(); await sleep(2500);
const rec3 = await receipt(key);
ok('changed unit cost replaces the approval with a new REQUESTED receipt', rec3 && rec3.status === 'REQUESTED' && rec3.values.unitCost === 1500000 && rec3.approvedByEmail === '', rec3 ? rec3.status : '');
ok('row no longer shows the old approval', !(await rowText(key)).includes('Đã duyệt: b.test'));

// 5) the requester cannot delete the receipt of someone else; the admin can
await sig({ uid: 'uid-b', email: 'b.test@example.com' }); await sleep(2000);
await page.goto(base + '#salesreturn'); await page.waitForSelector('#t5r-fix tbody tr', { timeout: 30000 }); await sleep(800);
await rowFor(key).locator('[data-5r-del]').first().click().catch(() => {}); await sleep(2000);
ok('an editor who did not request cannot delete the receipt', !!(await receipt(key)));
ok('the line stays on the device when the receipt refuses the delete', (await rowFor(key).locator('[data-5r-del]').count()) === 1);

await sig({ uid: 'uid-admin', email: 'admin.test@example.com' }); await sleep(2000);
await page.goto(base + '#salesreturn'); await page.waitForSelector('#t5r-fix tbody tr', { timeout: 30000 }); await sleep(800);
await rowFor(key).locator('[data-5r-del]').first().click().catch(() => {}); await sleep(2500);
ok('admin delete removes the manual cost and its receipt', (await receipt(key)) === null);

ok('no page errors during the approval flow', errors.length === 0, errors.slice(0, 3).join(' | '));
await page.screenshot({ path: path.join(outDir, 'approvals-final.png') });
await browser.close();
console.log(`\n${n - fail}/${n} approval browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
