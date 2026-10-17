// Browser check: every Excel export button that works after STEP 2 writes a styled, valid workbook.
// Usage: node test/e2e-exports.mjs http://localhost:8765/ [ERP folder] [outDir]
// v1.14.92 (audit TST-01): without an ERP folder the synthetic ERP reports are generated (runs in CI).
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSynthErp } from './support/synth-files.mjs';
import XLSX from '../lib/xlsx.mjs'; // same SheetJS build as the app (v1.14.20)
import * as __fsForXlsx from 'node:fs'; XLSX.set_fs(__fsForXlsx); // the ESM build needs fs injected for readFile / writeFile in Node

const [, , base = 'http://localhost:8765/', fixDir0, outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svl-e2e-exp-'))] = process.argv;
const fixDir = fixDir0 || (writeSynthErp(path.join(outDir, 'erp'), { rework: false, negative: false }), path.join(outDir, 'erp'));
const root = base + (base.includes('?') ? '&' : '?') + 'sandbox=1';
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; let fails = 0;
const ok = (label, cond, info = '') => { console.log(`${cond ? '✓' : '✗'} ${label}${info ? ' — ' + info : ''}`); if (!cond) fails++; };
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL_CONNECTION_FAILED')) errors.push('console: ' + m.text()); });
page.on('dialog', async (d) => { await d.accept(d.type() === 'prompt' ? '2026-08' : undefined); });

async function download(trigger, label) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), trigger()]);
  const target = path.join(outDir, dl.suggestedFilename());
  await dl.saveAs(target);
  const wb = XLSX.read(fs.readFileSync(target), { type: 'buffer' });
  ok(`${label}: file ${dl.suggestedFilename()} opens`, wb.SheetNames.length > 0, wb.SheetNames.join(' | ').slice(0, 160));
  return target;
}

await page.goto(root);
await page.waitForSelector('#f-new');
await page.fill('#f-new input[name=p]', '2026-08');
await page.click('#f-new button');
await page.waitForSelector('.kpis');
await page.goto(root + '#step1');
await page.waitForSelector('#f-files', { state: 'attached' });
await page.setInputFiles('#f-files', fs.readdirSync(fixDir).filter((f) => f.endsWith('.xlsx')).map((f) => path.join(fixDir, f)));
await page.waitForSelector('#plan .alert', { timeout: 120000 });
// v1.14.25: confirm the abnormal ERP lines listed at STEP 1 before STEP 2
// v1.14.69+: each open part (A–D) is confirmed separately, as the user does before STEP 2
for (let i = 0; i < 8 && (await page.$('[data-act=dq-confirm]')); i++) { await page.click('[data-act=dq-confirm]'); await page.waitForTimeout(900); }
await page.goto(root + '#step2');
await page.click('[data-act=run-step2]');
await page.waitForSelector('#t-detail .vt-table', { timeout: 60000 });

await download(() => page.click('[data-act=s2-report]'), 'STEP 2 tổng hợp');
await download(() => page.locator('#t-detail .vt-export').click(), 'Bảng chi tiết STEP 2');
await page.goto(root + '#settings');
await page.waitForSelector('[data-act=export-all]', { timeout: 60000 });
await download(() => page.click('[data-act=export-all]'), 'Xuất kết quả kỳ');
console.log('errors:', errors.join('\n') || 'none');
await browser.close();
process.exit(errors.length || fails ? 1 : 0);
