// Browser check for v1.11 separate revenue books: returns / credit notes have their own file, database, screen,
// STEP 5R run and FAST accounts (5212 / 5213), apart from sales revenue (511).
// node test/e2e-returns.mjs <base-url> <costing.xlsm> <outDir>
import { chromium } from 'playwright';
import path from 'node:path';
import XLSX from 'xlsx';
const [, , base0, wbPath, outDir] = process.argv;
const base = base0 + '?sandbox=1';
// a combined ERP-style file: one physical return of an August invoice, one credit note, one ordinary sale (must be skipped)
const H = ['Invoice Date', 'Month', 'Customer', 'Product Number', 'Product Name', 'Exchange Rate', 'Quantity', 'Unit Price (USD)', 'Amount (USD)', 'Amount (VND)', 'Remark', 'SI Invoice No.', 'Invoice Line No.', 'Transaction Type', 'Original Invoice No.'];
const retFile = path.join(outDir, 'returns_2026-08.xlsx');
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([H,
  [46255, 8, 'Techtronic Trading Ltd.', 'OLI-4810VU', '20 INCH LARGER M-TOTE', 26275, -10, 29.94, -299.4, -7866735, 'defect', 'O-RET-2608-001', '', 'SALES RETURN', 'O-INV-2608-001'],
  [46250, 8, 'Techtronic Trading Ltd.', '', 'Price reduction Aug', 26275, null, null, -100, -2627500, '', 'O-CN-2608-001', '', 'CREDIT NOTE', ''],
  [46250, 8, 'Techtronic Trading Ltd.', 'OLI-4810VU', '20 INCH LARGER M-TOTE', 26275, 1, 29.94, 29.94, 786673.5, '', 'O-INV-TEST', '', 'NORMAL SALE', ''],
]), 'Returns');
XLSX.writeFile(wb, retFile);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errors.push('console: ' + m.text()); });
page.on('dialog', async (d) => { console.log('dialog:', d.message().slice(0, 160).replace(/\n/g, ' | ')); await d.accept(d.type() === 'prompt' ? 'test' : undefined); });
const txt = async (sel) => (await page.textContent(sel)).replace(/\s+/g, ' ');
const shot = (n) => page.screenshot({ path: path.join(outDir, n) });
await page.goto(base + '#settings');
await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });

await page.goto(base + '#sales'); await page.waitForSelector('.kpis');
console.log('4.1 header:', (await txt('h1')), '|', (await txt('.kpis')));
console.log('4.1 legacy notice:', ((await txt('main')).match(/còn \d+ dòng SALES RETURN \/ CREDIT NOTE/) || ['(none)'])[0]);

await page.goto(base + '#salesreturn'); await page.waitForSelector('.result');
console.log('5R before:', await txt('.result'), '|', await txt('.kpis'));
await page.click('[data-tab5r="import"]'); await page.waitForSelector('#f-ret', { state: 'attached' });
await page.selectOption('#r-mode', 'MONTHLY');
await page.setInputFiles('#f-ret', retFile); await page.waitForTimeout(800);
console.log('5R import toast:', (await page.textContent('#toasts')).slice(-200));
await page.click('[data-act=ret-save]'); await page.waitForTimeout(800);
console.log('5R save toast:', (await page.textContent('#toasts')).slice(-260));
await shot('50-returns-import.png');
await page.click('[data-tab5r="db"]'); await page.waitForTimeout(300);
console.log('5R db:', ((await txt('main')).match(/· \d+ dòng \(mọi kỳ\)/) || ['?'])[0]);

await page.goto(base + '#sales'); await page.waitForSelector('.kpis');
console.log('4.1 after split:', (await txt('.kpis')), '| legacy notice:', ((await txt('main')).match(/còn \d+ dòng SALES RETURN/) || ['(none)'])[0], '| deductions:', ((await txt('main')).match(/Giảm trừ doanh thu kỳ này.{0,120}/) || ['(none)'])[0]);

await page.goto(base + '#step5'); await page.waitForSelector('.result');
await page.click('[data-act=s5-run]'); await page.waitForTimeout(1500);
console.log('5.2 sales-only:', await txt('.result'), '|', ((await txt('main')).match(/Bước tiếp: STEP 5R.{0,120}/) || ['(no 5R notice)'])[0]);
console.log('5.2 kpis:', await txt('.kpis'));
await page.goto(base + '#close'); await page.waitForSelector('.result');
console.log('close before 5R:', ((await txt('main')).match(/Chưa đóng được:.{0,140}/) || ['(none)'])[0]);
await page.click('[data-act=s5-hist]'); await page.waitForTimeout(800);
console.log('history before 5R blocked:', (await page.textContent('#toasts')).includes('BUILD FG HISTORY bị chặn – STEP 5R'));

await page.goto(base + '#salesreturn'); await page.waitForSelector('.result');
await page.click('[data-tab5r="run"]'); await page.waitForSelector('[data-act=s5r-run]');
console.log('5R ready:', await txt('.result'), '| button enabled:', await page.isEnabled('[data-act=s5r-run]'));
await page.click('[data-act=s5r-run]'); await page.waitForTimeout(1500);
console.log('5R after run:', await txt('.result'), '|', await txt('.kpis'));
console.log('5R alert:', ((await txt('main')).match(/STEP 5R PASS.{0,80}|Còn \d+ dòng trả lại chưa xử lý|\d+ dòng trả lại cần xác nhận/) || ['?'])[0]);
console.log('5R register:', ((await txt('#t5r-main')).match(/O-RET-2608-001.{0,160}/) || ['?'])[0]);
await shot('51-returns-run.png');

await page.goto(base + '#step5'); await page.waitForSelector('.kpis');
console.log('5.2 after 5R kpis:', await txt('.kpis'));
await page.goto(base + '#close'); await page.waitForSelector('.result');
await page.click('[data-act=s5-hist]'); await page.waitForTimeout(1200);
console.log('history after 5R:', (await page.textContent('#toasts')).slice(-140));
await page.click('[data-tabh="fast"]'); await page.waitForSelector('#f-fast');
const fast = await page.$$eval('#f-fast tbody tr', (trs) => trs.map((tr) => [tr.children[0].textContent.trim(), tr.children[2].textContent.trim()]));
console.log('FAST rows:', JSON.stringify(fast));
console.log('close reason:', ((await txt('main')).match(/Chưa đóng được:.{0,140}/) || ['(none)'])[0]);
await shot('52-fast-tie.png');
// changing a resolution after the run makes STEP 5R stale (not STEP 5.2)
await page.goto(base + '#cc'); await page.waitForTimeout(400);
console.log('CC 5R row:', ((await txt('main')).match(/5RHàng trả lại & giảm giá.{0,80}/) || ['?'])[0]);
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
