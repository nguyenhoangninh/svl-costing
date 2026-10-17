// v1.14.92 (audit TST-01): bring the synthetic period 2026-08 to a closeable state through the real UI, so browser
// tests that used the company workbook (costing.xlsm) run on generated data in CI.
// Same path as test/e2e-synthetic.mjs: STEP 1 import → Opening WIP → STEP 2 → STEP 3 → sales / price master → FX / GL →
// STEP 4 → FG opening → STEP 5 → FG History → NRV decision → FAST tie. Returns when the CLOSE button is available.
import path from 'node:path';
import { writeSynthErp, writeSynthInputs } from './synth-files.mjs';

export async function prepareClosablePeriod(page, { root, dir, ok, period = '2026-08' }) {
  const erpFiles = writeSynthErp(path.join(dir, 'erp'), { rework: false, negative: false });
  const inp = await writeSynthInputs(path.join(dir, 'inputs'));
  const sleep = (ms) => page.waitForTimeout(ms);
  const go = async (hash) => { await page.goto(root + hash); await sleep(600); };
  const toasts = async () => ((await page.textContent('#toasts').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const clearToasts = () => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()));
  const settle = () => page.waitForFunction(() => { const b = document.getElementById('busy'); if (!b) return true; const cs = getComputedStyle(b); return cs.display === 'none' || cs.visibility === 'hidden' || b.offsetParent === null; }, null, { timeout: 240000 }).catch(() => {});
  const toastOf = async (re, timeout = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const t = await toasts(); if (re.test(t)) return t; await sleep(250); } return toasts(); };
  const act = async (sel, re) => { await settle(); await clearToasts(); await page.click(sel); return toastOf(re); };

  // a fresh device shows the "new period" form; a signed-in cloud session uses the "Kỳ mới" button (the caller's
  // dialog handler must answer the period prompt with `period`)
  // only fragment changes once the app is open: a full reload would sign the fake cloud user out and drop its data
  if (page.url().split('#')[0] !== root.split('#')[0]) await page.goto(root); else await go('#');
  if (await page.waitForSelector('#f-new', { timeout: 8000 }).then(() => true, () => false)) {
    await page.fill('#f-new input[name=p]', period); await page.click('#f-new button');
  } else {
    await go('#settings'); await page.locator('[data-act=new-period]:visible').first().click();
  }
  await page.waitForFunction((p) => (document.querySelector('#period-sel')?.value || '') === p || !!document.querySelector('.kpis'), period, { timeout: 30000 }).catch(() => {});
  await go('#step1'); await page.waitForSelector('#f-files', { state: 'attached' });
  await page.setInputFiles('#f-files', erpFiles);
  await page.waitForSelector('#plan .alert', { timeout: 120000 }); await sleep(800);
  for (let i = 0; i < 8 && (await page.$('[data-act=dq-confirm]')); i++) { await settle(); await page.click('[data-act=dq-confirm]'); await sleep(900); }
  await go('#opening'); await page.waitForSelector('#f-open', { state: 'attached' });
  await page.setInputFiles('#f-open', inp.wipFile); await sleep(1500);
  await act('[data-act=validate-wip]', /Opening|WIP|lưu|validate/i);
  await go('#step2'); await page.waitForSelector('[data-act=run-step2]');
  const t2 = await act('[data-act=run-step2]', /STEP 2 xong|STEP 2 dừng|STEP 2 bị chặn/);
  if (await page.$('[data-act=approve-step2-fallback]')) { await settle(); await page.click('[data-act=approve-step2-fallback]'); await sleep(800); }
  await go('#step3'); await page.waitForSelector('[data-act=run-step3]');
  const t3 = await act('[data-act=run-step3]', /STEP 3 xong|STEP 3 dừng|chặn/);
  await go('#sales'); await page.waitForSelector('#f-sales', { state: 'attached' });
  await page.selectOption('#s-mode', 'MONTHLY');
  await page.setInputFiles('#f-sales', inp.salesFile); await sleep(1500);
  if (process.env.DEBUG_FLOW) console.log('SALES', await page.inputValue('#period-sel').catch(() => '?'), (await page.textContent('main')).replace(/\s+/g, ' ').slice(0, 900), '| T', await toasts());
  await act('[data-act=sales-save]', /lưu|Lưu|Saved|SAVED|Không lưu|lỗi/i);
  if (!(await page.$('[data-act=pm-update]'))) { await page.click('[data-tabs="pm"]').catch(() => {}); await sleep(500); }
  await act('[data-act=pm-update]', /Price|giá|PM/i);
  await go('#gl'); await page.waitForSelector('#f-gl');
  await page.fill('#f-gl input[name=fx]', String(inp.gl.fx)); await page.fill('#f-gl input[name=gl622]', String(inp.gl.gl622)); await page.fill('#f-gl input[name=gl627]', String(inp.gl.gl627));
  await clearToasts(); await page.click('#f-gl button[type=submit]'); await sleep(800);
  await go('#step4'); await page.waitForSelector('[data-act=run-step4]');
  const t4 = await act('[data-act=run-step4]', /STEP 4/);
  await go('#fgopen'); await page.waitForSelector('#f-fgopen', { state: 'attached' });
  await page.setInputFiles('#f-fgopen', inp.fgFile); await sleep(1500);
  await act('[data-act=s5-validate]', /VALIDATED|Validate|hợp lệ|lỗi/i);
  await go('#step5'); await page.waitForSelector('[data-act=s5-run]');
  const t5 = await act('[data-act=s5-run]', /FIFO|STEP 5/);
  await go('#close'); await page.waitForSelector('[data-act=s5-hist]');
  await act('[data-act=s5-hist]', /History|HISTORY|lịch sử/i);
  if (!(await page.locator('#f-nrv-decision').count())) await go('#provision');
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
  const closeable = (await page.locator('[data-act=s5-close]').count()) === 1;
  if (ok) ok(`synthetic ${period} is closeable (STEP 2 → 5 on generated data)`, closeable, closeable ? '' : `${reason.slice(0, 200)} | ${[t2, t3, t4, t5].map((t) => t.slice(0, 60)).join(' | ')}`);
  return closeable;
}
