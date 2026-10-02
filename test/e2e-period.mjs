// Browser check (audit F-06): roll-forward from an OPEN previous period needs a reason, is stamped,
// and the next period is told when the previous period's closing WIP changes afterwards.
import { chromium } from 'playwright';
const [, , base0, wbPath] = process.argv;
const base = base0 + '?sandbox=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; let fails = 0;
const ok = (label, cond) => { console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fails++; };
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
const txt = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
await page.goto(base + '#settings'); await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath); await page.waitForSelector('#mig table', { timeout: 240000 });
// 1) new period while 2026-08 is open, reason left blank → nothing rolled
await page.evaluate(() => { window.prompt = (m) => (m.includes('CHƯA ĐÓNG') ? '' : '2026-09'); });
await page.click('[data-act=new-period]'); await page.waitForTimeout(1200);
await page.goto(base + '#opening'); await page.waitForSelector('.result');
ok('no reason → Opening WIP not rolled', (await txt('.result')).includes('NO DATA'));
// 2) roll with a reason → stamped "chưa đóng"
await page.evaluate(() => { window.prompt = () => 'Kiểm thử e2e'; });
await page.click('[data-act=roll-wip]'); await page.waitForTimeout(1200);
const note = await txt('main');
ok('rolled with reason, source shown as not closed', note.includes('chưa đóng khi chuyển') && note.includes('Kiểm thử e2e'));
await page.goto(base + '#rework'); await page.waitForTimeout(400);
ok('rework B/F seeded', /B\/F/.test(await txt('main')));
await page.goto(base + '#cc'); await page.waitForTimeout(600);
ok('no drift right after roll', !(await txt('main')).includes('Số dư đầu kỳ cần chuyển lại'));
// 3) the previous period's closing WIP changes afterwards → drift alert on reload
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('svl-costing-sandbox', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const get = (k) => new Promise((res) => { const t = db.transaction('kv', 'readonly'); const q = t.objectStore('kv').get(k); q.onsuccess = () => res(q.result); });
  const s3 = await get('p/2026-08/step3'); const m = s3.rows.find((r) => Math.abs(r.closingAmt) > 1); m.closingAmt += 1000;
  await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(s3, 'p/2026-08/step3'); t.oncomplete = res; });
});
await page.reload(); await page.waitForSelector('.page'); await page.goto(base + '#cc'); await page.waitForTimeout(1500);
ok('drift alert shown in Control Center', (await txt('main')).includes('Closing WIP kỳ 2026-08 đã thay đổi'));
// 4) roll again → alert gone
await page.goto(base + '#opening'); await page.waitForTimeout(300);
await page.evaluate(() => { window.prompt = () => 'Kiểm thử lần 2'; });
await page.click('[data-act=roll-wip]'); await page.waitForTimeout(1500);
await page.goto(base + '#cc'); await page.waitForTimeout(800);
ok('drift cleared after roll forward again', !(await txt('main')).includes('Số dư đầu kỳ cần chuyển lại'));
console.log('errors:', errors.join('\n') || 'none');
await browser.close();
process.exit(errors.length || fails ? 1 : 0);
