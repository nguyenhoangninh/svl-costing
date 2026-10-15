// Browser run of a whole period on SYNTHETIC data (no company files, so it runs in CI): STEP 1 import of generated ERP
// reports → Opening WIP → STEP 2 → STEP 3 → sales & price master → FX / GL → STEP 4 → FG opening → STEP 5 → FG History →
// NRV decision → FAST tie → CLOSE → journal by customer → dashboard → Bảng tổng hợp hạch toán export → REOPEN.
// Audit NEW-01: a change that breaks CLOSE, the NRV decision, the journal or the exports turns this test red.
// Usage: node test/e2e-synthetic.mjs [base url, default http://127.0.0.1:8765/] [chromium path]
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import XLSX from '../lib/xlsx.mjs';
import { writeSynthErp, writeSynthInputs } from './support/synth-files.mjs';

const [, , base0 = 'http://127.0.0.1:8765/', exe = process.env.CHROMIUM_PATH || ''] = process.argv;
const root = base0 + (base0.includes('?') ? '&' : '?') + 'sandbox=1';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svl-e2e-synth-'));
const erpFiles = writeSynthErp(path.join(dir, 'erp'), { rework: false, negative: false });
const inp = await writeSynthInputs(path.join(dir, 'inputs'));
const VERBOSE = !!process.env.E2E_VERBOSE;

const browser = await chromium.launch(exe ? { executablePath: exe } : (fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}));
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|firebase|gstatic/i.test(m.text())) errors.push('console: ' + m.text()); });
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Kiểm thử e2e dữ liệu giả lập' : undefined));

let n = 0, fail = 0;
const ok = (label, cond, extra = '') => { n++; if (!cond) fail++; console.log(`${cond ? '✓' : '✗'} ${label}${extra && (!cond || VERBOSE) ? ' — ' + extra : ''}`); };
const sleep = (ms) => page.waitForTimeout(ms);
const go = async (hash) => { await page.goto(root + hash); await sleep(600); };
const toasts = async () => ((await page.textContent('#toasts').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
const clearToasts = () => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()));
const settle = () => page.waitForFunction(() => { const b = document.getElementById('busy'); if (!b) return true; const cs = getComputedStyle(b); return cs.display === 'none' || cs.visibility === 'hidden' || b.offsetParent === null; }, null, { timeout: 240000 }).catch(() => {});
async function toastOf(re, timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const t = await toasts(); if (re.test(t)) return t; await sleep(250); }
  return await toasts();
}
async function act(sel, re, label) {
  await settle(); await clearToasts();
  await page.click(sel);
  const t = await toastOf(re);
  if (VERBOSE) console.log(`   [${label}] ${t.slice(0, 220)}`);
  return t;
}
const amt = (s) => Number(String(s).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));

try {
  // ---------- period + STEP 1
  await page.goto(root); await page.waitForSelector('#f-new');
  await page.fill('#f-new input[name=p]', '2026-08'); await page.click('#f-new button'); await page.waitForSelector('.kpis');
  await go('#step1'); await page.waitForSelector('#f-files', { state: 'attached' });
  await page.setInputFiles('#f-files', erpFiles);
  await page.waitForSelector('#plan .alert', { timeout: 120000 }); await sleep(800);
  for (let i = 0; i < 8 && (await page.$('[data-act=dq-confirm]')); i++) { await settle(); await page.click('[data-act=dq-confirm]'); await sleep(900); }
  ok('STEP 1: generated ERP reports import (PC / MI / MR / Stock Out, T / O / S)', (await page.textContent('main')).includes('12 / 21'));

  // ---------- Opening WIP
  await go('#opening'); await page.waitForSelector('#f-open', { state: 'attached' });
  await page.setInputFiles('#f-open', inp.wipFile); await sleep(1500);
  await act('[data-act=validate-wip]', /Opening|WIP|lưu|validate/i, 'opening');
  await go('#step3');
  const op01 = await page.$$eval('table.cp tr', (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ')).find((t) => /Trạng thái Opening WIP/.test(t)) || '');
  ok('Opening WIP: template file imports and validates (checkpoint 01 READY)', /READY\s*READY|READYREADY|READY READY/.test(op01) || /PASS/.test(op01), op01);

  // ---------- STEP 2 / STEP 3
  await go('#step2'); await page.waitForSelector('[data-act=run-step2]');
  const t2 = await act('[data-act=run-step2]', /STEP 2 xong|STEP 2 dừng|STEP 2 bị chặn/, 'step2');
  ok('STEP 2 runs PASS', /STEP 2 xong: PASS/.test(t2), t2);
  // broad fallback above 5 % of the allocation needs a reviewed approval (the synthetic data has two such lines)
  if (await page.$('[data-act=approve-step2-fallback]')) { await settle(); await page.click('[data-act=approve-step2-fallback]'); await sleep(800); }
  ok('STEP 2 fallback approval clears the STEP 2 block', !(await page.$('[data-act=approve-step2-fallback]')));
  await go('#step3'); await page.waitForSelector('[data-act=run-step3]');
  const t3 = await act('[data-act=run-step3]', /STEP 3 xong|STEP 3 dừng|chặn/, 'step3');
  ok('STEP 3 runs', /STEP 3 xong/.test(t3), t3);

  // ---------- sales + price master, FX / GL
  await go('#sales'); await page.waitForSelector('#f-sales', { state: 'attached' });
  await page.selectOption('#s-mode', 'MONTHLY');
  await page.setInputFiles('#f-sales', inp.salesFile); await sleep(1500);
  const tS = await act('[data-act=sales-save]', /lưu|Lưu|Saved|SAVED|Không lưu|lỗi/i, 'sales');
  ok('4.1 sales file (MONTHLY) validates and saves', !/Không lưu|lỗi/.test(tS) && /SAVED/.test(await page.textContent('main')), tS);
  if (!(await page.$('[data-act=pm-update]'))) { await page.click('[data-tabs="pm"]').catch(() => {}); await sleep(500); }
  const tP = await act('[data-act=pm-update]', /Price|giá|PM/i, 'pm');
  ok('4.1 price master updates from the saved sales', !/lỗi|trống/.test(tP), tP);
  await go('#gl'); await page.waitForSelector('#f-gl');
  await page.fill('#f-gl input[name=fx]', String(inp.gl.fx)); await page.fill('#f-gl input[name=gl622]', String(inp.gl.gl622)); await page.fill('#f-gl input[name=gl627]', String(inp.gl.gl627));
  await clearToasts(); await page.click('#f-gl button[type=submit]'); await sleep(800);
  ok('4.2 FX / GL saved for the period', /PASS/.test(await page.textContent('header.ph .result')), await toasts());

  // ---------- STEP 4
  await go('#step4'); await page.waitForSelector('[data-act=run-step4]');
  const t4 = await act('[data-act=run-step4]', /STEP 4/, 'step4');
  ok('STEP 4 allocates 622 / 627 and costs the FG lots', /STEP 4 xong|PASS/.test(t4), t4);

  // ---------- STEP 5.1 FG opening, 5.2 FIFO
  await go('#fgopen'); await page.waitForSelector('#f-fgopen', { state: 'attached' });
  await page.setInputFiles('#f-fgopen', inp.fgFile); await sleep(1500);
  const tF = await act('[data-act=s5-validate]', /VALIDATED|Validate|hợp lệ|lỗi/i, 'fgopen');
  ok('5.1 FG opening template (v2) validates', /VALIDATED/.test(tF + (await page.textContent('main'))), tF);
  await go('#step5'); await page.waitForSelector('[data-act=s5-run]');
  const t5 = await act('[data-act=s5-run]', /FIFO|STEP 5/, 'step5');
  ok('5.2 FIFO COGS runs', /xong|PASS|REVIEW/.test(t5), t5);

  // ---------- 5.3 history, NRV decision (5P), FAST tie, CLOSE
  await go('#close'); await page.waitForSelector('[data-act=s5-hist]');
  const tH = await act('[data-act=s5-hist]', /History|HISTORY|lịch sử/i, 'hist');
  if (VERBOSE) console.log('   hist', tH.slice(0, 160));
  if (!(await page.locator('#f-nrv-decision').count())) { await go('#provision'); }
  if (await page.locator('#f-nrv-decision').count()) {
    await page.selectOption('#f-nrv-decision select[name=status]', 'NO ADJUSTMENT APPROVED');
    await page.fill('#f-nrv-decision input[name=note]', 'Kiểm thử: không trích lập kỳ này'); await page.click('#f-nrv-decision button[type=submit]'); await sleep(600);
  }
  await go('#close'); await page.waitForSelector('[data-act=s5-hist]');
  await page.click('[data-tabh="fast"]'); await page.waitForSelector('#f-fast');
  const engVals = await page.$$eval('#f-fast tbody tr', (trs) => trs.map((tr) => [tr.querySelector('input').name, tr.children[2].textContent.replace(/\./g, '').replace(',', '.').replace(/[–-]$/, '0')]));
  for (const [k, v] of engVals) await page.fill(`#f-fast input[name=${k}]`, String(Math.round(+v || 0)));
  await page.click('#f-fast button[type=submit]'); await sleep(500);
  if (await page.$('#f-fast-ok input[name=note]')) { await page.fill('#f-fast-ok input[name=note]', 'Kiểm thử: khớp FAST'); await page.click('#f-fast-ok button'); await sleep(400); }
  await go('#close'); await page.waitForSelector('.result');
  const reason = ((await page.locator('.alert.review').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ');
  ok('5.3 period is closeable (no block reason)', (await page.locator('[data-act=s5-close]').count()) === 1 && !/Chưa đóng được/.test(reason), reason.slice(0, 300));
  const tC = await act('[data-act=s5-close]', /đóng|CLOSE|CLOSED/i, 'close');
  ok('CLOSE MONTH succeeds', /CLOSED|Đã đóng|đã đóng/.test(tC + (await page.textContent('.result'))), tC);

  // ---------- journal by customer (STEP 5 / control centre)
  await go('#cc'); await page.waitForSelector('table.cp');
  const je = await page.$$eval('table.cp tr', (rows) => rows.map((r) => [...r.children].map((c) => c.textContent.trim())).filter((c) => c[0] === 'JE07'));
  ok('journal: JE07 is split by customer, Tectronic spellings grouped into one line', je.length === 2 && je.some((c) => /tectronic/i.test(c[3])) && je.filter((c) => /tectronic/i.test(c[3])).length === 1, JSON.stringify(je));

  // ---------- dashboard
  await go('#dashboard'); await page.waitForSelector('.dx-kpi', { timeout: 20000 });
  const kpis = await page.$$eval('.dx-kpi', (e) => e.length);
  const custOpts = await page.$$eval('#dx-cust option', (o) => o.map((x) => x.value).filter(Boolean));
  ok('dashboard: KPI cards render from STEP 5', kpis >= 6, String(kpis));
  ok('dashboard: customer filter lists 2 customers (Tectronic once)', custOpts.length === 2 && custOpts.filter((c) => /tectronic/i.test(c)).length === 1, JSON.stringify(custOpts));

  // ---------- Bảng tổng hợp hạch toán export
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#dash-export')]);
  const f = path.join(dir, dl.suggestedFilename()); await dl.saveAs(f);
  const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer' });
  ok('export: Bảng tổng hợp hạch toán has the customer, journal, product and check sheets', ['1_TongHop_KhachHang', '2_ButToan_KhachHang', '3_TongHop_SanPham', '4_KiemTra'].every((s) => wb.SheetNames.includes(s)), wb.SheetNames.join(', '));
  const chk = XLSX.utils.sheet_to_json(wb.Sheets['4_KiemTra'], { header: 1 }).filter((r) => r && r.length).map((r) => r.join(' '));
  ok('export: the checks sheet reports JE07 by customer = JE07 (PASS)', chk.some((r) => /JE07 theo khách hàng/.test(r) && /PASS/.test(r)), chk.join(' | '));

  // ---------- REOPEN
  await go('#close'); await page.waitForSelector('[data-act=s5-reopen]');
  const tR = await act('[data-act=s5-reopen]', /mở lại|MỞ LẠI|Không thể/i, 'reopen');
  ok('REOPEN works on the closed period', /Đã mở lại/.test(tR), tR);
} catch (e) {
  ok('flow completed without an exception', false, e.message.split('\n')[0]);
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${n - fail}/${n} synthetic period browser checks passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
