// Browser check (v1.14.15): a one-month sales file saved in YTD mode must not wipe the earlier months of the Sales Database.
// Usage: node test/e2e-sales-ytd.mjs <base url> <costing.xlsm> <sales_2026.xlsx> <outDir>
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import * as XLSX from '../lib/xlsx.mjs';
const [, , base0, wbPath, salesPath, outDir] = process.argv;
const base = base0.includes('sandbox') ? base0 : base0 + '?sandbox=1';
// a file with only the last month of the fixture (the workbook period)
const wb = XLSX.read(fs.readFileSync(salesPath), { type: 'buffer', cellDates: false });
const g = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
const hi = g.findIndex((r) => r && r.some((v) => String(v || '').toUpperCase().includes('PRODUCT')));
const di = g[hi].findIndex((h) => /invoice date/i.test(String(h)));
const month = (s) => new Date(Date.UTC(1899, 11, 30) + s * 86400000).getUTCMonth() + 1;
const rows = g.slice(hi + 1).filter((r) => r && typeof r[di] === 'number');
const last = Math.max(...rows.map((r) => month(r[di])));
const one = [g[hi], ...rows.filter((r) => month(r[di]) === last)];
const nb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(nb, XLSX.utils.aoa_to_sheet(one), 'Sales');
const onePath = path.join(outDir, `sales_month_${last}.xlsx`); fs.writeFileSync(onePath, XLSX.write(nb, { type: 'buffer', bookType: 'xlsx' }));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; const dialogs = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
await page.goto(base + '#settings');
await page.waitForSelector('#f-xlsm', { state: 'attached' });
await page.setInputFiles('#f-xlsm', wbPath);
await page.waitForSelector('#mig table', { timeout: 240000 });
const dbCount = async () => { await page.goto(base + '#sales'); await page.waitForSelector('.kpis'); return (await page.textContent('.kpis')).replace(/\s+/g, ' ').match(/Sales Database\s*([\d.]+)/)[1]; };
let pass = 0, fail = 0; const ok = (l, c) => { if (c) pass++; else { fail++; console.log('✗ ' + l); } };
const before = await dbCount();
console.log('Sales Database before:', before, '| one-month file: month', last, (one.length - 1), 'rows');
const importAs = async (mode) => {
  await page.goto(base + '#sales'); await page.waitForSelector('.kpis'); await page.click('[data-tabs="import"]');
  await page.selectOption('#s-mode', mode); await page.setInputFiles('#f-sales', onePath);
  await page.waitForFunction(() => !document.querySelector('[data-act="sales-save"]')?.disabled, null, { timeout: 60000 });
  dialogs.length = 0; await page.click('[data-act="sales-save"]'); await page.waitForTimeout(800);
};
await importAs('YTD');
const toastY = (await page.textContent('body')).replace(/\s+/g, ' ');
ok('YTD one-month save shows the block message', /XOÁ toàn bộ doanh thu/.test(toastY));
ok('YTD one-month save asks no confirmation (blocked before the dialog)', dialogs.length === 0);
await page.screenshot({ path: path.join(outDir, 'sales-ytd-blocked.png') });
const afterY = await dbCount();
ok(`Sales Database unchanged after blocked YTD save (${before} → ${afterY})`, afterY === before);
await importAs('MONTHLY');
ok('MONTHLY save asks the usual confirmation', dialogs.length === 1 && /MONTHLY/.test(dialogs[0]));
const afterM = await dbCount();
ok(`Sales Database keeps earlier months after MONTHLY save (${before} → ${afterM})`, afterM === before);
await page.click('[data-tabs="pm"]'); await page.click('[data-act="pm-update"]'); await page.waitForTimeout(800);
const afterPM = await dbCount();
ok(`Update Price Master leaves the Sales Database as it is (${afterM} → ${afterPM})`, afterPM === afterM);
ok('no page errors', errors.length === 0);
if (errors.length) console.log(errors);
console.log(`\n${pass}/${pass + fail} sales YTD guard browser checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
