// Browser run of server-side manual-cost approval (ENH-06) against the in-memory Firebase stand-in.
// The callable functions run the real functions/src/approvalCore.mjs logic. Firestore rules are NOT enforced here.
// Usage: node test/e2e-approvals.mjs http://127.0.0.1:8765/ /path/costing.xlsm <outDir> <returnsFile.xlsx>
// returnsFile: a sales-returns workbook for 2026-08 with one SALES RETURN line that has quantity and no original invoice
// (so STEP 5R needs a manual unit cost). Header: Invoice Date, Product Number, Quantity, Amount (USD), Transaction Type.
import { chromium } from 'playwright';
import { installFakeFirebase } from './support/fake-firebase.mjs';
import { approvalDocId, ACTION_MANUAL_COST } from '../functions/src/approvalCore.mjs';
import path from 'node:path';

const [, , base = 'http://127.0.0.1:8765/', wbPath = '/home/claude/costing.xlsm', outDir = '.', retPath] = process.argv;
if (!retPath) { console.error('Thiếu đường dẫn file hàng trả lại (tham số thứ 4).'); process.exit(2); }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errors.push('console: ' + m.text()); });
page.on('dialog', async (d) => { if (d.type() === 'prompt') await d.accept('test reason'); else await d.accept(); });
await installFakeFirebase(page);

let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); };
const F = (fn, ...a) => page.evaluate(fn, ...a);
const sleep = (ms) => page.waitForTimeout(ms);
const sig = (u) => F((x) => { const S = window.__fake; S.uid = x.uid; S.email = x.email; S.signedIn = true; S.listeners.forEach((cb) => setTimeout(() => cb({ uid: x.uid, email: x.email, displayName: x.email }), 0)); }, u);
const approvalDoc = (key) => F((id) => window.__fake.docs.get(`svl_costing_periods/2026-08/approvals/${id}`) || null, approvalDocId(ACTION_MANUAL_COST, key));
const rowFor = (key) => page.locator(`#t5r-fix tr[data-k="${key}"]`);
const rowText = async (key) => ((await rowFor(key).textContent().catch(() => '')) || '').replace(/\s+/g, ' ');

await page.goto(base + '#settings');
await page.waitForFunction(() => document.querySelector('#account')?.textContent?.includes('admin.test'), null, { timeout: 30000 });
await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });
await sleep(1500);

// 1) maker (admin) records a manual unit cost for one return line
await page.goto(base + '#step4'); await page.click('[data-act=run-step4]'); await sleep(1500);
// 0) import and save one sales-return line for 2026-08 (no original invoice → manual unit cost needed)
await page.goto(base + '#salesreturn'); await sleep(800);
await page.click('[data-tab5r=import]'); await sleep(800);
await page.selectOption('#r-mode', 'MONTHLY');
await page.setInputFiles('#f-ret', retPath);
await sleep(2500);
await page.click('[data-act=ret-save]'); await sleep(2500);
// STEP 5.2 FIFO first (STEP 4 re-run made it OUTDATED), then STEP 5R
await page.goto(base + '#step5'); await sleep(800);
await page.click('[data-act=s5-run]'); await sleep(3000);
await page.goto(base + '#salesreturn'); await sleep(800);
await page.click('[data-act=s5r-run]').catch(() => {}); await sleep(2000);
try { await page.waitForSelector('#t5r-fix tbody tr', { timeout: 60000 }); } catch (e) {
  console.log('DIAG #t5r-box:', ((await page.locator('#t5r-box').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 1200));
  console.log('DIAG toasts:', ((await page.locator('#toasts').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 400));
  throw e;
}
const key = await page.locator('#t5r-fix tbody tr').first().getAttribute('data-k');
await rowFor(key).locator('input[name=unitCost]').fill('1234500');
await rowFor(key).locator('input[name=note]').fill('Căn cứ: đơn giá nhập trước kỳ web (kiểm thử)');
await rowFor(key).locator('[data-5r-save]').click();
await sleep(2500);
const rec1 = await approvalDoc(key);
ok('maker save creates a server receipt REQUESTED with the maker identity', rec1 && rec1.status === 'REQUESTED' && rec1.requestedByEmail === 'admin.test@example.com', rec1 ? `${rec1.status} by ${rec1.requestedByEmail}` : 'no receipt');
ok('receipt values are the entered values (canonical text, fingerprint)', rec1 && rec1.values.unitCost === 1234500 && /^[0-9a-f]{64}$/.test(rec1.fingerprint));
ok('maker sees "waiting for someone else" and no approve button', (await rowText(key)).includes('Chờ người khác duyệt') && (await rowFor(key).locator('[data-5r-approve]').count()) === 0);

// 2) the maker cannot approve through the server either (direct callable call as the same user)
const selfErr = await F(async (a) => { try { await window.__FBI.httpsCallable(null, 'approveApproval')({ period: '2026-08', action: 'RETURN_MANUAL_COST', key: a.k, canonical: a.canon }); return 'approved'; } catch (e) { return e.message; } }, { k: key, canon: rec1.canonical }).catch((e) => 'x:' + e.message);
ok('server refuses self-approval even when called directly', typeof selfErr === 'string' && /tự duyệt/.test(selfErr), selfErr.slice(0, 90));

// 3) a different editor approves in the UI
await F(() => { window.__fake.docs.set('svl_costing_config/access', { members: { 'b.test@example.com': 'editor' } }); });
await sig({ uid: 'uid-b', email: 'b.test@example.com' }); await sleep(2500);
await page.goto(base + '#salesreturn'); await page.waitForSelector('#t5r-fix tbody tr', { timeout: 30000 }); await sleep(800);
ok('second editor sees the approve button for the pending line', (await rowFor(key).locator('[data-5r-approve]').count()) === 1);
await rowFor(key).locator('[data-5r-approve]').click(); await sleep(2500);
const rec2 = await approvalDoc(key);
ok('approval recorded by the server with the approver identity', rec2 && rec2.status === 'APPROVED' && rec2.approvedByEmail === 'b.test@example.com' && rec2.requestedByEmail === 'admin.test@example.com', rec2 ? `${rec2.status} by ${rec2.approvedByEmail}` : '');
ok('row shows the approval from the server', (await rowText(key)).includes('Đã duyệt (máy chủ): b.test@example.com'));

// 4) change the value after approval: the old approval stops counting until it is requested again
await sig({ uid: 'uid-admin', email: 'admin.test@example.com' }); await sleep(2500);
await page.goto(base + '#salesreturn'); await page.waitForSelector('#t5r-fix tbody tr', { timeout: 30000 }); await sleep(800);
await rowFor(key).locator('input[name=unitCost]').fill('1500000');
await rowFor(key).locator('[data-5r-save]').click(); await sleep(2500);
const rec3 = await approvalDoc(key);
ok('changed unit cost replaces the approval with a new pending request', rec3 && rec3.status === 'REQUESTED' && rec3.values.unitCost === 1500000, rec3 ? rec3.status : '');
ok('row no longer shows the old approval', !(await rowText(key)).includes('Đã duyệt (máy chủ)'));

// 5) the approver cannot approve a value that was not requested (stale canonical)
await sig({ uid: 'uid-b', email: 'b.test@example.com' }); await sleep(2000);
const stale = await F(async (a) => { try { await window.__FBI.httpsCallable(null, 'approveApproval')({ period: '2026-08', action: 'RETURN_MANUAL_COST', key: a.k, canonical: a.canon }); return 'approved'; } catch (e) { return e.message; } }, { k: key, canon: rec2.canonical });
ok('approval of the old values is refused by the server', typeof stale === 'string' && /thay đổi|Không có yêu cầu/.test(stale), stale.slice(0, 90));

ok('no page errors during approval flow', errors.length === 0, errors.slice(0, 3).join(' | '));
await page.screenshot({ path: path.join(outDir, 'approvals-final.png') });
await browser.close();
console.log(`\n${n - fail}/${n} approval browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
