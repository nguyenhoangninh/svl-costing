// Synthetic end-to-end regression (no company data): generated ERP reports → STEP 2 → 3A → 3B → 4 → 5 (MONTHLY + STRICT_DATE with rework).
// Checks the engine's own reconciliations and compares key results with test/synth.snapshot.json.
// Usage: node test/synth.mjs            (compare)
//        node test/synth.mjs --update   (rewrite the snapshot after an intended, reviewed change)
import fs from 'node:fs';
import { buildDataset } from '../src/engine/step1.js';
import { runStep2, buildReworkRegister, recheckRegisterRow } from '../src/engine/step2.js';
import { validateOpening, runStep3, step3Stale, wipJournalAmounts } from '../src/engine/step3.js';
import { deriveInput, runBuild, engineDynamic, applyControl, wipFinal, postedByLot, writeInput } from '../src/engine/step3b.js';
import { importSales, validateSaveSales, updatePriceMaster, runStep4, finalLayer } from '../src/engine/step4.js';
import * as F5 from '../src/engine/step5.js';
import { num } from '../src/engine/util.js';

import { P, ser, synthErp } from './support/synth-data.mjs';

const { reports, PROD, MAT, price, pcp } = synthErp();
const ds = {};
for (const r of reports) { const d = buildDataset([r.header, ...r.rows], `${r.name}-202608.xlsx`, P); ds[d.key] = d; }

// ---------- STEP 2 / 2B
const s2 = runStep2(ds, P);
const register = buildReworkRegister(ds, P, [], []);
for (const r of register.rows) { r.rwType = 'NORMAL'; r.rwStatus = 'OPEN'; recheckRegisterRow(r); }
// ---------- STEP 3A: opening WIP (one material ends negative → 3B)
const opening = { period: P, source: 'synthetic', rows: [...MAT.T, ...MAT.O].map((m, i) => ({ code: m, name: `Material ${m}`, unit: 'PCS', qty: i === 3 ? 0 : 40, amt: i === 3 ? 0 : 40 * price[m] })) };
validateOpening(opening, ds, P);
const s3 = runStep3(ds, opening, s2, P, '');
// ---------- STEP 3B (amount basis, approve all)
const input = writeInput([], s3, false);
const b = runBuild({ erpMap: { rows: [] }, input, control: null, reg632: [], basis: 'AMOUNT' }, { step3: s3, step2: s2, datasets: ds, period: P });
for (const r of b.control.rows) r.decision = r.status === 'PASS' ? 'APPROVE' : 'HOLD';
applyControl(b.control, s3, '');
const inD = deriveInput(input, b.erpMap, s3, P);
const eng = engineDynamic(b.engine, inD, b.control);
const wf = wipFinal(s3, b.control, b.erpMap);
// ---------- STEP 4
const HS = ['Invoice Date', 'Month', 'Customer', 'Product Number', 'Product Name', 'Exchange Rate', 'Quantity', 'Unit Price (USD)', 'Amount (USD)', 'Amount (VND)', 'Remark', 'SI Invoice No.', 'Invoice Line No.', 'Transaction Type', 'Bill Date', 'Original Invoice No.'];
const FX = 26000;
const sale = (day, cust, prod, qty, usd, inv, bill = null, orig = null) => [ser(day), 8, cust, prod, 'x', FX, qty, usd, qty * usd, qty * usd * FX, null, inv, null, qty < 0 ? 'SALES RETURN' : 'NORMAL SALE', bill, orig];
const salesGrid = [HS, sale(5, 'C1', 'SPX-100', 30, 260, 'INV-1'), sale(12, 'C1', 'SPX-200', 20, 300, 'INV-2'), sale(14, 'C2', 'OLX-300', 25, 40, 'INV-3'), sale(20, 'C2', 'OLX-400', 15, 22, 'INV-4'),
  sale(18, 'C1', 'SPX-100', 25, 262, 'INV-5', ser(19)), sale(25, 'C1', 'SPX-100', -2, 260, 'CN-1', null, 'INV-1')];
const salesDB = validateSaveSales(importSales({ S: salesGrid }, 'synthetic.xlsx', 'YTD', P), { rows: [] }, P).db;
const pm = updatePriceMaster({ salesDB, so: [{ active: 'Y', product: 'OLX-400', price: 23, soDate: ser(2) }], manual: [], step2: s2, period: P }).pm;
const gl = { period: P, fx: FX, gl622: 90000000, gl627: 60000000 };
const s4 = runStep4({ period: P, step2: s2, step3: s3, pm, gl, directAdj: [{ active: 'Y', erp: 'O', account: 622, amount: 5000000, pc: pcp.O[0][0], prod: pcp.O[0][6], reason: 'Synthetic approved direct labor attribution' }] });
const fl = finalLayer(s4, postedByLot(eng), register);
// ---------- STEP 5
const fgOpen = { period: P, status: 'LOADED', rows: [['SPX-100', 10, 9000000], ['OLX-300', 8, 300000]].map(([prod, qty, tot], i) => ({ period: P, srcPeriod: '2026-07', lid: `OP-${i}`, source: 'OPENING', pc: `PC-2607-${i}`, date: (Date.UTC(2026, 6, 20) - Date.UTC(1899, 11, 30)) / 86400000, mo: '', prod, name: 'x', loc: '', unit: 'PCS', qty, rm: tot * 0.6, a622: tot * 0.25, a627: tot * 0.15, tot, price: 0, prov: 0, cons: '' })) };
F5.validateOpeningFG(fgOpen, P);
const run = (mode) => {
  // MONTHLY remains covered for ordinary sales-only costing. Any active rework is now an explicit STRICT_DATE workflow.
  const reg = mode === 'MONTHLY' ? { period: P, rows: [] } : JSON.parse(JSON.stringify(register));
  const salesRows = mode === 'MONTHLY' ? salesDB.rows.filter((r) => num(r.qty) >= 0) : salesDB.rows;
  const res = F5.runFIFO({ period: P, opening: fgOpen, caRows: fl.rows, salesRows, pmRows: pm.rows, fx: FX, overrides: {}, dupDecisions: {}, mode, tol: 1, register: reg, sellCostRate: 0.015,
    step4: { current: 'CURRENT', overall: fl.overall, finalCost: fl.totals.totalCost, qty: s4.recon.rows[1].result } });
  if (F5.reworkCount(reg)) F5.runReworkFIFO(res, reg, { period: P, opening: fgOpen, salesRows, step4Carry: fl.totals.carryIn });
  F5.finalizeRun(res);
  return { res, reg };
};
const M = run('MONTHLY'), St = run('STRICT_DATE');

// ---------- invariants
let fails = 0; const ok = (label, cond, info = '') => { if (!cond) { fails++; console.log(`✗ ${label} ${info}`); } };

// ---------- v1.14.75: Stock Out marked "tiêu hao" (632 / 152) stays out of Material WIP (154)
{
  const { soLineKeys } = await import('../src/engine/step2.js');
  const keyT1 = soLineKeys(ds['STOCK OUT-T'], 'T')[0]; // SO-T-1, material 2 of T, 175,000
  const s2c = runStep2(ds, P, { consumeLines: [keyT1] });
  const s3c = runStep3(ds, opening, s2c, P, '');
  const near = (x, y) => Math.abs(x - y) < 0.01;
  ok('consumption: STEP 2 posts 175,000 to 632 / 152, the rest is allocated', near(s2c.total.cons, 175000) && s2c.status === 'PASS');
  ok('consumption: STEP 3 leaves the line out of WIP (in and out both lower by 175,000)', near(s3.summary.inAmt - s3c.summary.inAmt, 175000) && near(s3.summary.outAmt - s3c.summary.outAmt, 175000) && near(s3.summary.soAmt - s3c.summary.soAmt, 175000), `${s3.summary.inAmt - s3c.summary.inAmt}`);
  ok('consumption: closing WIP unchanged', near(s3.summary.closingAmt, s3c.summary.closingAmt));
  ok('consumption: STEP 3 ties to STEP 2 (Stock Out = allocated; consumption 1 line = 175,000)', s3c.checks.soVsStep2.status === 'PASS' && s3c.checks.consVsStep2.status === 'PASS' && s3c.consumptionLinesExcluded === 1 && near(s3c.consumptionAmt, 175000));
  let s4c = null, err = '';
  try { s4c = runStep4({ period: P, step2: s2c, step3: s3c, pm, gl, directAdj: [] }); } catch (e) { err = e.message; }
  ok('consumption: STEP 4 RM bridge holds without adding consumption back', !!s4c && !err, err);
  ok('consumption: without a marked line STEP 3 has nothing left out', s3.consExcluded === true && s3.consumptionLinesExcluded === 0 && s3.checks.consVsStep2.status === 'PASS');
  // v1.14.77: the journal follows what STEP 3 put in WIP (JE02 = Stock Out in WIP, JE02B = 632 / 152 consumption)
  const J = wipJournalAmounts(s3c, s2c);
  ok('journal: JE02 equals the Stock Out STEP 3 puts in WIP, JE02B = consumption', near(J.so, s3c.summary.soAmt) && near(J.cons, 175000), JSON.stringify(J));
  ok('journal: 152 credit = full Stock Out (WIP + consumption) and 154 debit = MI + Stock Out in WIP', near(J.mi + J.so + J.cons, s3.summary.miAmt + s3.summary.soAmt) && near(J.mi + J.so, s3c.summary.miAmt + s3c.summary.soAmt));
  const Jold = wipJournalAmounts({ ...s3, consExcluded: false }, s2c);
  ok('journal: an older STEP 3 result (consumption still in its Stock Out) is taken off', near(Jold.so, s3.summary.soAmt - 175000) && near(Jold.cons, 175000));
  // a STEP 3 result built before the consumption line was marked (or on an older STEP 2) is flagged, and the flag clears on a fresh run
  ok('stale: STEP 3 built on an older STEP 2 is flagged; a fresh STEP 3 is not', step3Stale(s3, s2c) === true && step3Stale(s3c, s2c) === false && step3Stale(null, s2c) === false);
}
// v1.14.50: checkpoint 08 detail — every counted shortage is listed (none without a count, none with zero quantity)
ok('shortList empty exactly when checkpoint 08 is 0 (MONTHLY and STRICT_DATE)', [M, St].every(({ res }) => (res.shortList.length === 0) === (res.stats.shortProducts === 0)), `M=${M.res.shortList.length}/${M.res.stats.shortProducts} St=${St.res.shortList.length}/${St.res.stats.shortProducts}`);
ok('shortList rows all carry a positive shortage', [M, St].every(({ res }) => res.shortList.every((x) => x.short > 0 && x.prod)));
ok('STRICT_DATE: distinct products in shortList = checkpoint 08', new Set(St.res.shortList.map((x) => x.prod)).size === St.res.stats.shortProducts, `${new Set(St.res.shortList.map((x) => x.prod)).size} vs ${St.res.stats.shortProducts}`);
// v1.14.16: the FG rework Stock Out (SPX-100, Item Type FG) is not a WIP material row
ok('STEP 3A lists no FG-only Stock Out code', !s3.rows.some((r) => r.code === 'SPX-100'), s3.rows.map((r) => r.code).join(','));
ok('STEP 3A counts the excluded FG Stock Out line', s3.fgStockOutLinesExcluded === 1, String(s3.fgStockOutLinesExcluded));
// ---------- broad fallbacks (O other / S other / safety) split by PC RM cost, not equally
{
  const fb = s2.detail.filter((d) => ['FALLBACK RM COST', 'FALLBACK EQUAL'].includes(d[16]));
  const groups = {}; for (const d of fb) (groups[d[0] + '|' + d[1]] ||= []).push(d);
  let worst = 0;
  for (const l of Object.values(groups)) { const sum = l.reduce((a, d) => a + d[13], 0); for (const d of l) worst = Math.max(worst, Math.abs(d[14] - d[13] / sum)); }
  ok('fallback groups split proportional to PC RM cost (FAMILY mode)', fb.every((d) => d[16] === 'FALLBACK RM COST'), JSON.stringify(fb.map((d) => d[16])));
  ok('fallback pct = RM / sum RM', worst < 1e-9, `worst=${worst}`);
}
ok('step2 PASS', s2.status === 'PASS', s2.status);
ok('step3 roll-forward', Math.abs(s3.summary.opening + s3.summary.inAmt - s3.summary.outAmt - s3.summary.closingAmt) < 1);
ok('3B has amount-basis rows', b.engine.rows.some((r) => r.note === 'Actual PC-M amount ratio'));
ok('3B WIP bridge', wf.bridgeStatus === 'PASS', wf.bridgeStatus);
ok('step4 overall PASS', String(fl.overall).startsWith('PASS'), fl.overall);
for (const [n, x] of [['MONTHLY', M], ['STRICT', St]]) for (const k of [8, 9, 10, 11, 12]) ok(`${n} rec ${k}`, x.res.rec[k].status === 'PASS', JSON.stringify(x.res.rec[k]));
ok('return restored in STRICT_DATE', St.res.sales.some((s) => s.fin === 'RETURN' && s.status === 'RETURNED'));
const hStrict = F5.buildHistory(St.res, [], { period: P, opening: fgOpen, caRows: fl.rows });
const hgStrict = F5.historyGate(hStrict, St.res, P);
const recStrict = F5.step5Recon({ period: P, res: St.res, freshness: 'CURRENT', hist: hStrict, histGate: hgStrict, gl: { ytd622: null, ytd627: null }, fl, s4, gate6: fl.gate6 || 'PASS' });
ok('STEP 5R return → FG History PASS', hgStrict.gate === 'PASS', hgStrict.gate);
ok('STEP 5R return → reconciliation row 36 PASS', recStrict.rows[36] && recStrict.rows[36].status === 'PASS', JSON.stringify(recStrict.rows[36]));
ok('all accepted sales recognition dates are inside the costing period', salesDB.rows.every((r) => { const d = F5.saleDate(r); return d !== null && d <= ser(31); }));
const f154 = (x) => num(s3.openingAmt) + s3.summary.miAmt + s3.summary.soAmt + s4.alloc622 + s4.alloc627 + num(x.res.rework && x.res.rework.fifoCost) - s3.summary.mrAmt - fl.totals.totalCost - wf.finalClosing - x.reg.rows.reduce((a, r) => a + num(r.closingWIP), 0);
ok('154 bridge MONTHLY', Math.abs(f154(M)) <= 1, f154(M));
ok('154 bridge STRICT', Math.abs(f154(St)) <= 1, f154(St));
const f155 = (x) => x.res.totals.openA + fl.totals.totalCost - x.res.totals.cogsA - num(x.res.totals.rwTot) - x.res.totals.closeA;
ok('155 bridge MONTHLY', Math.abs(f155(M)) <= 1, f155(M));
ok('155 bridge STRICT', Math.abs(f155(St)) <= 1, f155(St));

// ---------- snapshot
const r2 = (x) => Math.round(num(x) * 100) / 100;
const snap = {
  step2: { alloc: r2(s2.total.alloc), fallback: s2.detail.filter((d) => String(d[17]).includes('fallback ALL') || ['FALLBACK EQUAL', 'FALLBACK RM COST'].includes(d[16])).length },
  step3: { closing: r2(s3.summary.closingAmt), final: r2(wf.finalClosing) },
  b3: eng.filter((e) => e.Y === 'Y').map((e) => [e.key, e.pc, r2(e.AA)]),
  step4: fl.rows.map((r) => [r.pc, r2(r.totalCost)]),
  strict: { cogs: r2(St.res.totals.cogsA), close: r2(St.res.totals.closeA), rw: r2(St.res.rework.fifoCost), rwStatus: St.reg.rows.map((r) => r.fifoStatus), lines: St.res.sales.map((s) => [s.inv, s.status, r2(s.tot)]) },
  revenue: r2(F5.periodRevenue(salesDB.rows, P)),
};
// ---------- v1.14.79: revenue, COGS and gross profit by customer tie to the STEP 5 totals; the journal splits JE07 by customer
{
  const { customerPL, customerJournal } = await import('../src/engine/custpl.js');
  const { journalWithCustomers, journalCheck } = await import('../src/engine/journal.js');
  const near = (a, b) => Math.abs(a - b) < 0.01;
  for (const [label, X] of [['MONTHLY', M], ['STRICT_DATE', St]]) {
    const pl = customerPL(X.res), T = X.res.totals;
    ok(`customers ${label}: COGS by customer + consumption = 632 (cogsA)`, near(pl.total.cogs, T.cogsA), `${pl.total.cogs} vs ${T.cogsA}`);
    ok(`customers ${label}: sales COGS by customer = JE07 (cogsA − consA)`, near(pl.rows.reduce((a, r) => a + r.cogs, 0), T.cogsA - T.consA));
    ok(`customers ${label}: net revenue by customer = Σ sales-line amounts`, near(pl.total.net, X.res.sales.reduce((a, s) => a + num(s.vnd), 0)));
    ok(`customers ${label}: gross profit = net revenue − COGS`, near(pl.total.gp, pl.total.net - pl.total.cogs));
    ok(`customers ${label}: all checks PASS`, pl.checks.every((c) => c.status === 'PASS'), JSON.stringify(pl.checks.map((c) => c.status)));
    const lines = journalWithCustomers({ s3, s2, s4, fl, r5: X.res });
    const je07 = lines.filter((l) => l.je === 'JE07').reduce((a, l) => a + l.amount, 0);
    ok(`journal ${label}: JE07 lines by customer add up to JE07 (within the 0,5 VND of rounding)`, Math.abs(je07 - (T.cogsA - T.consA)) <= 0.5, `${je07}`);
    ok(`journal ${label}: JE07 check PASS`, journalCheck({ r5: X.res }).status === 'PASS');
    ok(`journal ${label}: every amount is whole VND and JE07 by customer = JE07 rounded exactly (ACC-01)`, lines.every((l) => Number.isInteger(l.amount)) && je07 === Math.round(T.cogsA - T.consA), `${je07} vs ${T.cogsA - T.consA}`);
    ok(`journal ${label}: customer COGS lines are posted Nợ 632 / Có 155`, lines.filter((l) => l.je === 'JE07').every((l) => l.dr === '632' && l.cr === '155'));
  }
  const plS = customerPL(St.res);
  ok('customers STRICT_DATE: the sales return reduces the revenue of its customer C1', near(plS.rows.find((r) => r.cust === 'C1').ret, St.res.sales.filter((s) => s.acc === '5212').reduce((a, s) => a + num(s.vnd), 0)) && plS.total.ret < 0);
}

const file = new URL('./synth.snapshot.json', import.meta.url);
if (process.argv.includes('--update') || !fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify(snap, null, 1) + '\n'); console.log('snapshot written'); }
else {
  const want = JSON.parse(fs.readFileSync(file, 'utf8'));
  const diff = (a, b, path) => { if (typeof a !== 'object' || a === null) { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; if (fails < 30) console.log(`✗ snapshot ${path}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); } return; } for (const k of new Set([...Object.keys(a), ...Object.keys(b || {})])) diff(a[k], b ? b[k] : undefined, `${path}.${k}`); };
  diff(snap, want, '');
}
console.log(fails ? `${fails} synthetic checks FAILED` : 'synthetic pipeline: all checks passed');
process.exit(fails ? 1 : 0);
