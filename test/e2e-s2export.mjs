// Browser check: STEP 2 "Xuất Excel tổng hợp phân bổ" builds the styled workbook (ExcelJS loaded from lib/ under the page CSP) and downloads it.
// Usage: node test/e2e-s2export.mjs http://localhost:8765/ ../fixtures/erp $OUTDIR
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const [, , base = 'http://localhost:8765/', fixDir, outDir] = process.argv;
const root = base + (base.includes('?') ? '&' : '?') + 'sandbox=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; let fails = 0;
const ok = (label, cond, info = '') => { console.log(`${cond ? '✓' : '✗'} ${label}${info ? ' — ' + info : ''}`); if (!cond) fails++; };
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
// external font / Google resources can be refused by the sandbox proxy; only app errors count
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + m.text()); });
page.on('dialog', async (d) => { await d.accept(d.type() === 'prompt' ? '2026-08' : undefined); });

await page.goto(root);
await page.waitForSelector('#f-new');
await page.fill('#f-new input[name=p]', '2026-08');
await page.click('#f-new button');
await page.waitForSelector('.kpis');
await page.goto(root + '#step1');
await page.waitForSelector('#f-files', { state: 'attached' });
const files = fs.readdirSync(fixDir).filter((f) => f.endsWith('.xlsx')).map((f) => path.join(fixDir, f));
await page.setInputFiles('#f-files', files);
await page.waitForSelector('#plan .alert', { timeout: 120000 });
await page.goto(root + '#step2');
await page.click('[data-act=run-step2]');
await page.waitForSelector('#t-detail .vt-table', { timeout: 60000 });

const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 120000 }),
  page.click('[data-act=s2-report]'),
]);
const target = path.join(outDir, dl.suggestedFilename());
await dl.saveAs(target);
ok('download named after the period', dl.suggestedFilename() === 'SVL_STEP2_PhanBo_StockOut_2026-08.xlsx', dl.suggestedFilename());
const wb = XLSX.read(fs.readFileSync(target), { type: 'buffer' });
ok('workbook has the five report sheets', JSON.stringify(wb.SheetNames) === JSON.stringify(['Tổng hợp', 'Logic phân bổ', 'Theo nhóm nguồn', 'Theo lô PC', 'Chi tiết phân bổ']), wb.SheetNames.join(' | '));
const titleCell = wb.Sheets['Tổng hợp']['A1'];
ok('title shows the period', !!titleCell && String(titleCell.v).includes('2026-08'), titleCell?.v);
ok('no page errors during export', errors.length === 0, errors.join(' / ').slice(0, 300));
console.log('saved:', target);
await browser.close();
process.exit(errors.length || fails ? 1 : 0);
